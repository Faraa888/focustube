// background/background.js
// The "brain" of FocusTube. It runs in the background and
// decides whether YouTube pages should be blocked or allowed.

// ─────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────
import {
  ensureDefaults,          // creates default storage keys
  maybeRotateCounters,     // resets counters if day/week/month changed
  getLocal, setLocal,      // storage helpers
  bumpSearches, bumpShorts, bumpWatch, // counter helpers
  incrementEngagedShorts,   // increment engaged Shorts counter
  getSnapshot,             // debug snapshot (optional)
  getPlanConfig,           // read plan + limits
  getTrialStatus,          // get trial status (checks expiration)
  isTemporarilyUnlocked,
  resetCounters,
  setPlan,
  syncPlanFromServer,      // sync plan from server
} from "../lib/state.js";

import { evaluateBlock } from "../lib/rules.js";
import { getServerUrlForBackground } from "../lib/config.js";

// ─────────────────────────────────────────────────────────────
// DEBUG MODE (set false when you ship)
// ─────────────────────────────────────────────────────────────
const DEBUG = true;
async function LOG(...a) {
  if (!DEBUG) return;
  const { ft_plan = "free" } = await chrome.storage.local.get(["ft_plan"]);
  console.log(
    `%c[FocusTube BG]%c [${ft_plan.toUpperCase()}]`,
    "color: #0ff; font-weight: bold;",
    "color: #ff0; font-weight: bold;",
    ...a
  );
}
// ─────────────────────────────────────────────────────────────
// BOOT: Called on install or startup
// ─────────────────────────────────────────────────────────────
async function boot() {
  await ensureDefaults();
  await maybeRotateCounters();
  
  // Sync plan from server on startup
  await syncPlanFromServer(true).catch((err) => {
    console.warn("[FT] Failed to sync plan on startup:", err);
  });
  
  const snap = await getSnapshot();
  LOG("boot complete:", snap);
}

chrome.runtime.onInstalled.addListener(() => boot().catch(console.error));
chrome.runtime.onStartup.addListener(() => boot().catch(console.error));

// ─────────────────────────────────────────────────────────────
// REQUEST TRACKING: Prevents race conditions from quick video switching
// ─────────────────────────────────────────────────────────────
let lastClassificationRequest = {
  videoId: null,
  timestamp: 0
};

// ─────────────────────────────────────────────────────────────
// USER ID HELPER (Migration-Friendly)
// ─────────────────────────────────────────────────────────────
/**
 * Get user ID for API requests
 * Currently returns email, but will read from website session token when ready
 * This makes migration easy - just swap this function
 * @returns {Promise<string|null>} User ID (email for now) or null if not set
 */
async function getUserId() {
  const { ft_user_email } = await getLocal(["ft_user_email"]);
  if (!ft_user_email || ft_user_email.trim() === "") {
    return null;
  }
  return ft_user_email.trim();
}

// ─────────────────────────────────────────────────────────────
// BACKGROUND SYNC: Sync plan every 6 hours
// ─────────────────────────────────────────────────────────────
setInterval(() => {
  syncPlanFromServer().catch((err) => {
    console.warn("[FT] Background plan sync failed:", err);
  });
}, 6 * 60 * 60 * 1000); // 6 hours

// ─────────────────────────────────────────────────────────────
// WATCH EVENT BATCH SENDER
// ─────────────────────────────────────────────────────────────
/**
 * Send batched watch events to server
 * @returns {Promise<boolean>} true if sent successfully, false otherwise
 */
async function sendWatchEventBatch() {
  try {
    const userId = await getUserId();
    if (!userId || !SERVER_URL) {
      return false;
    }

    const { ft_watch_event_queue } = await getLocal(["ft_watch_event_queue"]);
    const queue = Array.isArray(ft_watch_event_queue) ? ft_watch_event_queue : [];

    if (queue.length === 0) {
      return true; // Nothing to send
    }

    // Send batch to server
    const response = await fetch(`${SERVER_URL}/events/watch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        events: queue,
      }),
    });

    if (!response.ok) {
      console.warn(`[FT] Failed to send watch event batch: ${response.status} ${response.statusText}`);
      return false;
    }

    const data = await response.json();
    if (!data.ok) {
      console.warn("[FT] Server returned error for watch event batch:", data.error);
      return false;
    }

    // Clear queue after successful send
    await setLocal({ ft_watch_event_queue: [] });
    LOG("Watch event batch sent:", { count: queue.length });
    return true;
  } catch (error) {
    console.warn("[FT] Error sending watch event batch:", error?.message || error);
    return false;
  }
}

// Send batch every 15 minutes
setInterval(() => {
  sendWatchEventBatch().catch((err) => {
    console.warn("[FT] Background watch event batch failed:", err);
  });
}, 15 * 60 * 1000); // 15 minutes

// Send batch on extension unload (fire-and-forget)
chrome.runtime.onSuspend.addListener(() => {
  sendWatchEventBatch().catch((err) => {
    console.warn("[FT] Unload watch event batch failed:", err);
  });
});

// ─────────────────────────────────────────────────────────────
// COUNTER UPDATER: bump the correct counter for page type
// ─────────────────────────────────────────────────────────────
// Note: Shorts counting is handled by content.js (scrolled + engaged tracking)
async function countForPageType(pageType) {
  if (pageType === "SEARCH") await bumpSearches();
  // SHORTS handled by content.js via FT_BUMP_SHORTS message
  else if (pageType === "WATCH") await bumpWatch();
  // HOME or OTHER don't increment anything for now
}

// ─────────────────────────────────────────────────────────────
// MESSAGE HANDLER: listens to content.js messages
// ─────────────────────────────────────────────────────────────
// Message handler function
async function handleMessage(msg) {
  if (msg?.type === "FT_NAVIGATED") {
    return await handleNavigated(msg);
  }

  if (msg?.type === "FT_PING") {
    return { ok: true, from: "background" };
  }

  if (msg?.type === "FT_BUMP_SHORTS") {
    await bumpShorts();
    return { ok: true };
  }

  if (msg?.type === "FT_INCREMENT_ENGAGED_SHORTS") {
    const newCount = await incrementEngagedShorts();
    return { ok: true, engagedCount: newCount };
  }

  if (msg?.type === "FT_SET_EMAIL") {
    const email = msg?.email?.trim() || "";
    if (!email) {
      return { ok: false, error: "Email is required" };
    }
    await setLocal({ ft_user_email: email });
    LOG("Email saved:", email);
    // Just save email, no sync (sync happens when Set Plan is clicked)
    return { ok: true, email };
  }

  if (msg?.type === "FT_SET_GOALS") {
    const goals = msg?.goals || [];
    if (!Array.isArray(goals)) {
      return { ok: false, error: "Goals must be an array" };
    }
    await setLocal({ ft_user_goals: goals });
    LOG("Goals saved:", { count: goals.length, goals });
    
    // Verify they were saved
    const { ft_user_goals: savedGoals } = await getLocal(["ft_user_goals"]);
    LOG("Goals verification:", { saved: savedGoals });
    
    return { ok: true, goals };
  }

  if (msg?.type === "FT_SET_PLAN") {
    const plan = msg?.plan?.trim() || "";
    const userId = await getUserId();
    
    if (!userId) {
      return { ok: false, error: "User ID must be set first" };
    }
    
    if (!plan || !["free", "pro"].includes(plan)) {
      return { ok: false, error: "Plan must be 'free' or 'pro'" };
    }
    
    try {
      // Update plan in Supabase via server
      const SERVER_URL = "http://localhost:3000";
      const response = await fetch(`${SERVER_URL}/user/update-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userId, // For now, userId is email
          plan: plan,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update plan");
      }
      
      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || "Failed to update plan");
      }
      
      // Now sync plan from server (this will get the updated plan)
      const synced = await syncPlanFromServer(true);
      if (synced) {
        // Get updated plan
        const { ft_plan } = await getLocal(["ft_plan"]);
        // Notify all YouTube tabs of plan change
        const tabs = await chrome.tabs.query({ url: "*://*.youtube.com/*" });
        for (const t of tabs) {
          try {
            chrome.tabs.sendMessage(t.id, { type: "FT_PLAN_CHANGED", plan: ft_plan || "free" });
          } catch (e) {
            // Tab might not be ready, ignore
          }
        }
        return { ok: true, message: "Plan set and synced successfully", plan: ft_plan || plan };
      } else {
        return { ok: false, error: "Plan updated in Supabase but sync failed" };
      }
    } catch (err) {
      console.error("[FT] Set Plan error:", err);
      return { ok: false, error: String(err) };
    }
  }

  if (msg?.type === "FT_RESET_COUNTERS") {
    try {
      await resetCounters();
      LOG("All counters reset");
      return { ok: true, message: "All counters reset successfully" };
    } catch (err) {
      console.error("[FT] Reset counters error:", err);
      return { ok: false, error: String(err) };
    }
  }

  if (msg?.type === "FT_GET_STATUS") {
    try {
      const status = await getTrialStatus();
      return { ok: true, plan: status.plan, days_left: status.days_left };
    } catch (err) {
      console.error("[FT] Get status error:", err);
      return { ok: false, error: String(err) };
    }
  }

  if (msg?.type === "FT_SAVE_JOURNAL") {
    try {
      const { note, context } = msg;
      if (!note || typeof note !== "string" || note.trim() === "") {
        return { ok: false, error: "Note is required" };
      }

      const userId = await getUserId();
      if (!userId || !SERVER_URL) {
        return { ok: false, error: "User ID or server URL not set" };
      }

      // Send to server
      const response = await fetch(`${SERVER_URL}/journal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          note: note.trim(),
          context: context || {},
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save journal entry");
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || "Failed to save journal entry");
      }

      LOG("Journal entry saved:", { note: note.substring(0, 50) + "..." });
      return { ok: true, message: "Journal entry saved" };
    } catch (err) {
      console.error("[FT] Save journal error:", err);
      return { ok: false, error: String(err) };
    }
  }

  if (msg?.type === "FT_CLASSIFY_VIDEO") {
    try {
      const videoMetadata = msg?.videoMetadata;
      if (!videoMetadata || !videoMetadata.video_id) {
        return { ok: false, error: "Missing videoMetadata or video_id" };
      }
      
      const result = await classifyVideo(videoMetadata);
      return { ok: true, classification: result };
    } catch (err) {
      console.error("[FT] Classify video error:", err);
      return { ok: false, error: String(err) };
    }
  }

  return { ok: false, error: "unknown message type" };
}

// Message listener with proper promise handling
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg)
    .then((response) => {
      sendResponse(response);
    })
    .catch((err) => {
      console.error("Error in background listener:", err);
      sendResponse({ ok: false, error: String(err) });
    });
  return true; // Keep channel open for async
});

// ─────────────────────────────────────────────────────────────
// AI CLASSIFICATION (Pro users only)
// ─────────────────────────────────────────────────────────────

// Server URL (auto-detected based on environment)
const SERVER_URL = getServerUrlForBackground();

/**
 * Classify video with caching (24h per video_id + date)
 * @param {object} videoMetadata - Video metadata object
 * @returns {Promise<object|null>} - Classification result or null if error
 */
async function classifyVideo(videoMetadata) {
  if (!videoMetadata || !videoMetadata.video_id) {
    console.warn("[FT] classifyVideo: Missing video_id");
    return null;
  }

  // Build cache key: video_id + today's date
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const cacheKey = `ft_ai_cache_${videoMetadata.video_id}_${today}`;

  // Check cache first
  try {
    const cached = await getLocal([cacheKey]);
    if (cached[cacheKey]) {
      const cachedData = cached[cacheKey];
      // Check if cache is still valid (within 24 hours)
      const cacheAge = Date.now() - (cachedData.timestamp || 0);
      const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
      
      if (cacheAge < CACHE_TTL_MS) {
        LOG("AI classification cache hit:", { video_id: videoMetadata.video_id.substring(0, 10), age: `${Math.round(cacheAge / 1000)}s` });
        return cachedData.result;
      } else {
        // Cache expired, remove it
        await setLocal({ [cacheKey]: null });
      }
    }
  } catch (e) {
    console.warn("[FT] Error checking cache:", e.message);
  }

  // Not cached or expired - call classifyContent
  const result = await classifyContent(videoMetadata, "watch");
  
  if (result) {
    // Save to cache
    try {
      await setLocal({
        [cacheKey]: {
          result: result,
          timestamp: Date.now(),
        },
      });
      LOG("AI classification cached:", { video_id: videoMetadata.video_id.substring(0, 10) });
    } catch (e) {
      console.warn("[FT] Error saving cache:", e.message);
    }
  }

  return result;
}

/**
 * Classify content using AI (Pro users only)
 * @param {string|object} input - Text to classify (search query string) or video metadata object
 * @param {string} context - Context ("search" or "watch")
 * @returns {Promise<{category: string, allowed: boolean} | null>} - Classification result or null if error
 */
async function classifyContent(input, context = "search") {
  try {
    // Get user ID, plan, and goals
    const userId = await getUserId();
    const { ft_plan, ft_user_goals } = await getLocal(["ft_plan", "ft_user_goals"]);
    
    // Only classify for Pro or Trial users (trial gets Pro features)
    if (!ft_plan || (ft_plan !== "pro" && ft_plan !== "trial")) {
      return null;
    }

    // Need user_id for classification
    if (!userId) {
      console.warn("[FT] No user ID set, cannot classify content");
      return null;
    }

    // Prepare request body
    let requestBody = {
      user_id: userId,
      context: context,
    };
    
    // Handle different input types
    if (typeof input === "string") {
      // Search query - just send text
      requestBody.text = input.trim();
    } else if (typeof input === "object" && input !== null) {
      // Video metadata - send all fields matching new schema
      requestBody.video_id = input.video_id || null;
      requestBody.video_title = input.title || "";
      requestBody.video_description = input.description || "";
      requestBody.video_tags = Array.isArray(input.tags) ? input.tags : [];
      requestBody.channel_name = input.channel || "";
      requestBody.video_category = input.category || null;
      requestBody.is_shorts = input.is_shorts || false;
      requestBody.duration_seconds = input.duration_seconds || null;
      // Phase 2: Include URL for server-side validation
      requestBody.video_url = input.url || null;
      // Related videos as array of objects with title, channel_name, is_shorts
      requestBody.related_videos = Array.isArray(input.related_videos) 
        ? input.related_videos.map(rv => ({
            title: typeof rv === "string" ? rv : (rv.title || ""),
            channel_name: typeof rv === "object" ? (rv.channel_name || "") : "",
            is_shorts: typeof rv === "object" ? (rv.is_shorts || false) : false
          }))
        : [];
    } else {
      console.warn("[FT] Invalid input for classifyContent:", input);
      return null;
    }
    
    // Include goals if available
    if (ft_user_goals && Array.isArray(ft_user_goals) && ft_user_goals.length > 0) {
      requestBody.user_goals = ft_user_goals;
      LOG("Sending goals to AI:", { count: ft_user_goals.length, goals: ft_user_goals });
    } else {
      LOG("No goals available for AI classification");
    }

    // Call AI classification endpoint
    const response = await fetch(`${SERVER_URL}/ai/classify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.warn(`[FT] AI classification failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    // Return classification result with both new and old schema
    return {
      // New schema fields (full)
      category_primary: data.category_primary || "Other",
      category_secondary: data.category_secondary || [],
      distraction_level: data.distraction_level || data.category || "neutral",
      confidence_category: data.confidence_category || data.confidence || 0.5,
      confidence_distraction: data.confidence_distraction || data.confidence || 0.5,
      goals_alignment: data.goals_alignment || "unknown",
      reasons: Array.isArray(data.reasons) ? data.reasons : (data.reason ? [data.reason] : ["No reason provided"]),
      suggestions_summary: data.suggestions_summary || {
        on_goal_ratio: 0.0,
        shorts_ratio: 0.0,
        dominant_themes: data.tags || []
      },
      flags: data.flags || {
        is_shorts: false,
        clickbait_likelihood: 0.0,
        time_sink_risk: 0.0
      },
      // Old schema fields (for compatibility)
      category: data.distraction_level || data.category || "neutral",
      allowed: data.allowed !== false,
      reason: Array.isArray(data.reasons) ? data.reasons.join("; ") : (data.reason || "ai_classification"),
      confidence: data.confidence_distraction || data.confidence || 0.5,
      tags: data.suggestions_summary?.dominant_themes || data.tags || [],
      block_reason_code: data.block_reason_code || "ok",
      action_hint: data.action_hint || "allow",
      allowance_cost: data.allowance_cost || { type: "none", amount: 0 },
    };
  } catch (error) {
    console.warn("[FT] Error classifying content:", error.message || error);
    // Return null on error (will be treated as neutral)
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// VIDEO TIME TRACKING (for allowance decrement + analytics)
// ─────────────────────────────────────────────────────────────

/**
 * Extract video ID from YouTube URL
 * @param {string} url - YouTube URL
 * @returns {string|null} - Video ID or null
 */
function extractVideoId(url) {
  try {
    const urlObj = new URL(url);
    const videoId = urlObj.searchParams.get("v");
    return videoId || null;
  } catch (e) {
    return null;
  }
}

/**
 * Track time spent on a video, update allowance if distracting, and queue analytics
 * Called when user navigates away from a WATCH page
 * @param {string} videoId - Video ID
 * @param {number} startTime - Timestamp when video started
 * @param {string} category - Video category ("distracting" | "neutral" | "productive")
 * @returns {Promise<number>} - Time watched in seconds
 */
async function finalizeVideoWatch(videoId, startTime, category) {
  if (!videoId || !startTime) {
    return 0;
  }

  const endTime = Date.now();
  const durationSeconds = Math.floor((endTime - startTime) / 1000);

  if (durationSeconds <= 0) {
    return 0;
  }

  if (category === "distracting") {
    const { ft_allowance_seconds_left } = await getLocal(["ft_allowance_seconds_left"]);
    const currentAllowance = Number(ft_allowance_seconds_left || 600);

    const newAllowance = Math.max(0, currentAllowance - durationSeconds);

    await setLocal({ ft_allowance_seconds_left: newAllowance });

    LOG("Distracting video time tracked:", {
      videoId: videoId.substring(0, 10),
      duration: `${durationSeconds}s`,
      allowanceBefore: currentAllowance,
      allowanceAfter: newAllowance,
    });
  }

  // Get video title and channel from current video classification
  const { ft_current_video_classification } = await getLocal(["ft_current_video_classification"]);
  const title = ft_current_video_classification?.title || "Unknown";
  const channel = ft_current_video_classification?.channel || "Unknown";

  // Create watch event object
  const watchEvent = {
    video_id: videoId,
    title: title,
    channel: channel,
    seconds: durationSeconds,
    started_at: new Date(startTime).toISOString(),
    finished_at: new Date(endTime).toISOString(),
  };

  // Add to queue (will be batched and sent later)
  const { ft_watch_event_queue } = await getLocal(["ft_watch_event_queue"]);
  const queue = Array.isArray(ft_watch_event_queue) ? ft_watch_event_queue : [];
  queue.push(watchEvent);
  await setLocal({ ft_watch_event_queue: queue });

  LOG("Watch event queued:", {
    videoId: videoId.substring(0, 10),
    title: title.substring(0, 30),
    duration: `${durationSeconds}s`,
    queueSize: queue.length,
  });

  // Also send to legacy endpoint (for backward compatibility)
  sendWatchTimeToServer(videoId, durationSeconds, category).catch((err) => {
    console.warn("[FT] Failed to send watch time to server:", err?.message || err);
  });

  return durationSeconds;
}

/**
 * Send watch time analytics to server (best-effort)
 */
async function sendWatchTimeToServer(videoId, durationSeconds, category) {
  try {
    if (!videoId || !durationSeconds || durationSeconds <= 0) {
      return;
    }

    const userId = await getUserId();
    if (!userId || !SERVER_URL) {
      return;
    }

    await fetch(`${SERVER_URL}/video/update-watch-time`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        video_id: videoId,
        watch_seconds: durationSeconds,
        category,
      }),
    });
  } catch (error) {
    console.warn("[FT] Error sending watch time to server:", error?.message || error);
  }
}

// ─────────────────────────────────────────────────────────────
// HANDLE NAVIGATION (main logic)
// ─────────────────────────────────────────────────────────────
async function handleNavigated({ pageType = "OTHER", url = "", videoMetadata = null }) {
  // 1. Always make sure defaults + rotation are up-to-date
  await ensureDefaults();
  await maybeRotateCounters();

  // 2. Sync plan from server (debounced to once per 30 seconds)
  syncPlanFromServer().catch((err) => {
    console.warn("[FT] Plan sync failed on navigation:", err);
  });

  // 3. Count the page view
  await countForPageType(pageType);

  // 4. Handle video time tracking (finalize previous video if any)
  // This happens when:
  // - User leaves a WATCH page (navigates to non-WATCH page)
  // - User enters a new WATCH page (need to finalize previous video first)
  const { ft_current_video_classification: prevVideo } = await getLocal(["ft_current_video_classification"]);
  if (prevVideo && prevVideo.startTime) {
    const { videoId, category, startTime } = prevVideo;
    // Only finalize if:
    // - We're leaving WATCH page (going to different page type)
    // - OR we're entering a new WATCH page (different video ID)
    const currentVideoId = pageType === "WATCH" ? extractVideoId(url) : null;
    const isNewVideo = pageType === "WATCH" && currentVideoId && currentVideoId !== videoId;
    const isLeavingWatchPage = pageType !== "WATCH";
    
    if (isLeavingWatchPage || isNewVideo) {
      await finalizeVideoWatch(videoId, startTime, category);
      // Clear previous video tracking
      await setLocal({ ft_current_video_classification: null });
    }
  }

  // 5. Get current counters and unlock info
  const state = await getLocal([
    "ft_searches_today",
    "ft_short_visits_today",
    "ft_shorts_engaged_today",
    "ft_watch_visits_today",
    "ft_watch_seconds_today",
    "ft_shorts_seconds_today",
    "ft_blocked_today",
    "ft_block_shorts_today",
    "ft_unlock_until_epoch",
    "ft_allowance_videos_left",
    "ft_allowance_seconds_left"
  ]);

  // 6. Read plan + limits
  const { plan, config } = await getPlanConfig();

  // 7. AI Classification (Pro users only)
  // Strategy: Search = logging only, Watch = primary action point (block/warn)
  let aiClassification = null;
  if (plan === "pro") {
    if (pageType === "SEARCH" && url) {
      // Search classification: Log only (no blocking)
      // This helps with context but doesn't block search results
      try {
        const urlObj = new URL(url);
        const searchQuery = urlObj.searchParams.get("search_query");
        if (searchQuery) {
          // Classify search query for logging/context only
          const searchClassification = await classifyContent(decodeURIComponent(searchQuery), "search");
          if (searchClassification) {
            // Store classification result for dev panel/logging only (with new schema)
            await setLocal({
              ft_last_search_classification: {
                // New schema fields (full)
                category_primary: searchClassification.category_primary,
                category_secondary: searchClassification.category_secondary,
                distraction_level: searchClassification.distraction_level,
                confidence_category: searchClassification.confidence_category,
                confidence_distraction: searchClassification.confidence_distraction,
                goals_alignment: searchClassification.goals_alignment,
                reasons: searchClassification.reasons,
                suggestions_summary: searchClassification.suggestions_summary,
                flags: searchClassification.flags,
                // Old schema fields (for compatibility)
                category: searchClassification.category,
                allowed: searchClassification.allowed,
                confidence: searchClassification.confidence,
                reason: searchClassification.reason,
                tags: searchClassification.tags,
                block_reason_code: searchClassification.block_reason_code,
                action_hint: searchClassification.action_hint,
                allowance_cost: searchClassification.allowance_cost,
                // Metadata
                query: searchQuery,
                timestamp: Date.now(),
              },
            });
            LOG("AI Search Classification (logging only):", { query: searchQuery.substring(0, 30), ...searchClassification });
            // Don't set aiClassification - search doesn't trigger blocking
          }
        }
      } catch (e) {
        console.warn("[FT] Error extracting search query:", e.message || e);
      }
    } else if (pageType === "WATCH" && videoMetadata && videoMetadata.title) {
      // Timestamp-based request tracking (prevents race conditions from quick video switching)
      const videoId = videoMetadata.video_id || extractVideoId(url);
      const requestTimestamp = Date.now();
      
      // Store this request as the latest
      lastClassificationRequest = { videoId, timestamp: requestTimestamp };
      
      // Classify video with full metadata
      aiClassification = await classifyContent(videoMetadata, "watch");
      
      // Only use classification if this is still the latest request (video hasn't changed)
      if (aiClassification && lastClassificationRequest.timestamp === requestTimestamp) {
        // Store classification result (full data for dev panel and analytics)
        await setLocal({
          ft_last_watch_classification: {
            // New schema fields (full)
            category_primary: aiClassification.category_primary,
            category_secondary: aiClassification.category_secondary,
            distraction_level: aiClassification.distraction_level,
            confidence_category: aiClassification.confidence_category,
            confidence_distraction: aiClassification.confidence_distraction,
            goals_alignment: aiClassification.goals_alignment,
            reasons: aiClassification.reasons,
            suggestions_summary: aiClassification.suggestions_summary,
            flags: aiClassification.flags,
            // Old schema fields (for compatibility)
            category: aiClassification.category,
            allowed: aiClassification.allowed,
            confidence: aiClassification.confidence,
            reason: aiClassification.reason,
            tags: aiClassification.tags,
            block_reason_code: aiClassification.block_reason_code,
            action_hint: aiClassification.action_hint,
            allowance_cost: aiClassification.allowance_cost,
            // Metadata
            title: videoMetadata.title,
            video_id: videoId,
            timestamp: Date.now(),
          },
        });
        LOG("AI Watch Classification:", { title: videoMetadata.title?.substring(0, 50) || "unknown", ...aiClassification });

        // Track current video for watch-time analytics
        if (videoId && aiClassification.allowed !== false) {
          await setLocal({
            ft_current_video_classification: {
              videoId,
              category: aiClassification.category,
              startTime: Date.now(),
              title: videoMetadata.title || "Unknown",
              channel: videoMetadata.channel || "Unknown",
            },
          });
          LOG("Started tracking video watch:", {
            videoId: videoId.substring(0, 10),
            category: aiClassification.category,
            title: videoMetadata.title?.substring(0, 30) || "unknown",
            channel: videoMetadata.channel?.substring(0, 30) || "unknown",
          });
        }
      } else {
        // Request was superseded by newer video - don't store or use
        if (aiClassification) {
          LOG("AI Classification ignored (video changed during classification):", { 
            requestVideoId: videoId?.substring(0, 10), 
            currentVideoId: lastClassificationRequest.videoId?.substring(0, 10),
            requestTime: requestTimestamp,
            currentTime: lastClassificationRequest.timestamp
          });
          aiClassification = null; // Don't include in response
        }
      }
    }
  }

  // 8. Check unlock status
  const now = Date.now();
  const unlocked = await isTemporarilyUnlocked(now);

  // 9. Build context for evaluateBlock()
  const ctx = {
    plan,
    config,
    pageType,
    searchesToday: Number(state.ft_searches_today || 0),
    watchSecondsToday: Number(state.ft_watch_seconds_today || 0),
    ft_blocked_today: state.ft_blocked_today || false,
    ft_block_shorts_today: state.ft_block_shorts_today || false,
    unlocked,
    now,
    aiClassification, // Add AI classification to context
  };

  // 10. Check AI classification and allowance (Pro users only)
  let finalBlocked = false;
  let finalScope = "none";
  let finalReason = "ok";

  // If AI classified content, use action_hint and allowance_cost from response
  if (aiClassification) {
    const actionHint = aiClassification.action_hint || "allow";
    const allowanceCost = aiClassification.allowance_cost || { type: "none", amount: 0 };
    const category = aiClassification.category;

    // Use action_hint to determine blocking
    if (actionHint === "block") {
      finalBlocked = true;
      // Set scope based on actual page type, not always "search"
      if (pageType === "SEARCH") {
        finalScope = "search";
      } else if (pageType === "WATCH") {
        finalScope = "watch"; // AI-blocked video
      } else {
        finalScope = "global"; // Fallback for other page types
      }
      finalReason = aiClassification.block_reason_code || "ai_distracting_blocked";
      LOG("AI Content Blocked:", { category, reason: aiClassification.reason, actionHint, scope: finalScope });
    } else if (actionHint === "soft-warn" || category === "distracting") {
      // Check allowance for distracting content
      const allowanceVideosLeft = Number(state.ft_allowance_videos_left || 1);
      const allowanceSecondsLeft = Number(state.ft_allowance_seconds_left || 600);

      if (pageType === "WATCH") {
        // For watch pages: check video allowance
        if (allowanceCost.type === "video" && allowanceVideosLeft >= allowanceCost.amount) {
          // Allow but will decrement allowance when video ends (tracked separately)
          finalBlocked = false;
          finalScope = "none";
          finalReason = "ai_allowance_used";
          LOG("AI Distracting Video Allowed (will use allowance):", { remaining: allowanceVideosLeft, cost: allowanceCost.amount });
        } else if (allowanceVideosLeft > 0) {
          // Legacy support: if no allowance_cost specified, use old logic
          finalBlocked = false;
          finalScope = "none";
          finalReason = "ai_allowance_used";
        } else {
          // Block - no allowance left
          finalBlocked = true;
          finalScope = "watch"; // Blocked video, not search
          finalReason = "ai_distracting_no_allowance";
          LOG("AI Distracting Video Blocked (no allowance):", { remaining: 0 });
        }
      } else if (pageType === "SEARCH") {
        // Search pages: Don't block based on AI classification
        // Search classification is for logging/context only
        // Blocking happens on watch pages when user actually clicks a video
        finalBlocked = false;
        finalScope = "none";
        finalReason = "ok";
        LOG("AI Search Classification (no blocking):", { category, reason: aiClassification.reason });
      }
    } else {
      // Allow - not distracting or action_hint is "allow"
      finalBlocked = false;
      finalScope = "none";
      finalReason = "ok";
    }
  } else {
    // Not distracting or no AI classification - use normal block logic
    const blockResult = evaluateBlock(ctx);
    finalBlocked = blockResult.blocked;
    finalScope = blockResult.scope;
    finalReason = blockResult.reason;
  }

  // 11. If global block triggered, mark it
  if (finalBlocked && finalScope === "global" && !state.ft_blocked_today) {
    await setLocal({ ft_blocked_today: true });
  }

  // 12. Respond to content.js
  const resp = {
    ok: true,
    pageType,
    blocked: finalBlocked,
    scope: finalScope,       // "none" | "shorts" | "search" | "global"
    reason: finalReason,      // why blocked
    plan,
    counters: {
      searches: ctx.searchesToday,
      watchSeconds: ctx.watchSecondsToday,
      watchVisits: Number(state.ft_watch_visits_today || 0),
      shortsVisits: Number(state.ft_short_visits_today || 0),
      shortsEngaged: Number(state.ft_shorts_engaged_today || 0),
      shortsSeconds: Number(state.ft_shorts_seconds_today || 0),
      allowanceVideosLeft: Number(state.ft_allowance_videos_left || 1),
      allowanceSecondsLeft: Number(state.ft_allowance_seconds_left || 600)
    },
    unlocked,
    aiClassification: aiClassification ? {
      // Include video_id for client-side validation
      video_id: lastClassificationRequest.videoId,
      // New schema fields (full)
      category_primary: aiClassification.category_primary,
      category_secondary: aiClassification.category_secondary,
      distraction_level: aiClassification.distraction_level,
      confidence_category: aiClassification.confidence_category,
      confidence_distraction: aiClassification.confidence_distraction,
      goals_alignment: aiClassification.goals_alignment,
      reasons: aiClassification.reasons,
      suggestions_summary: aiClassification.suggestions_summary,
      flags: aiClassification.flags,
      // Old schema fields (for compatibility)
      category: aiClassification.category,
      allowed: aiClassification.allowed,
      confidence: aiClassification.confidence,
      reason: aiClassification.reason,
      tags: aiClassification.tags,
      block_reason_code: aiClassification.block_reason_code,
      action_hint: aiClassification.action_hint,
      allowance_cost: aiClassification.allowance_cost
    } : null
  };

  LOG("NAV:", { url, ...resp });
  return resp;
}
