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
  isTemporarilyUnlocked,
  resetCounters,
  setPlan,
  syncPlanFromServer,      // sync plan from server
} from "../lib/state.js";

import { evaluateBlock } from "../lib/rules.js";

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
// BACKGROUND SYNC: Sync plan every 10 minutes
// ─────────────────────────────────────────────────────────────
setInterval(() => {
  syncPlanFromServer().catch((err) => {
    console.warn("[FT] Background plan sync failed:", err);
  });
}, 10 * 60 * 1000); // 10 minutes

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

  if (msg?.type === "FT_SET_PLAN") {
    const plan = msg?.plan?.trim() || "";
    const { ft_user_email } = await getLocal(["ft_user_email"]);
    
    if (!ft_user_email || ft_user_email.trim() === "") {
      return { ok: false, error: "Email must be set first" };
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
          email: ft_user_email.trim(),
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

// Server URL (development)
const SERVER_URL = "http://localhost:3000";

/**
 * Classify content using AI (Pro users only)
 * @param {string} text - Text to classify (search query or video title)
 * @param {string} context - Context ("search" or "watch")
 * @returns {Promise<{category: string, allowed: boolean} | null>} - Classification result or null if error
 */
async function classifyContent(text, context = "search") {
  try {
    // Get user email and plan
    const { ft_user_email, ft_plan } = await getLocal(["ft_user_email", "ft_plan"]);
    
    // Only classify for Pro users
    if (!ft_plan || ft_plan !== "pro") {
      return null;
    }

    // Need email for user_id
    if (!ft_user_email || ft_user_email.trim() === "") {
      console.warn("[FT] No email set, cannot classify content");
      return null;
    }

    // Call AI classification endpoint
    const response = await fetch(`${SERVER_URL}/ai/classify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: ft_user_email.trim(),
        text: text.trim(),
        context: context,
      }),
    });

    if (!response.ok) {
      console.warn(`[FT] AI classification failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    // Return classification result
    return {
      category: data.category || "neutral", // "productive" | "neutral" | "distracting"
      allowed: data.allowed !== false, // Default to true if not specified
      reason: data.reason || "ai_classification",
    };
  } catch (error) {
    console.warn("[FT] Error classifying content:", error.message || error);
    // Return null on error (will be treated as neutral)
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// HANDLE NAVIGATION (main logic)
// ─────────────────────────────────────────────────────────────
async function handleNavigated({ pageType = "OTHER", url = "", videoTitle = null }) {
  // 1. Always make sure defaults + rotation are up-to-date
  await ensureDefaults();
  await maybeRotateCounters();

  // 2. Sync plan from server (debounced to once per 30 seconds)
  syncPlanFromServer().catch((err) => {
    console.warn("[FT] Plan sync failed on navigation:", err);
  });

  // 3. Count the page view
  await countForPageType(pageType);

  // 4. Get current counters and unlock info
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

  // 4. Read plan + limits
  const { plan, config } = await getPlanConfig();

  // 5. AI Classification (Pro users only) - for search and watch pages
  let aiClassification = null;
  if (plan === "pro") {
    if (pageType === "SEARCH" && url) {
      // Extract search query from URL
      try {
        const urlObj = new URL(url);
        const searchQuery = urlObj.searchParams.get("search_query");
        if (searchQuery) {
          // Classify search query
          aiClassification = await classifyContent(decodeURIComponent(searchQuery), "search");
          if (aiClassification) {
            // Store classification result
            await setLocal({
              ft_last_search_classification: {
                category: aiClassification.category,
                allowed: aiClassification.allowed,
                query: searchQuery,
                timestamp: Date.now(),
              },
            });
            LOG("AI Search Classification:", { query: searchQuery.substring(0, 30), ...aiClassification });
          }
        }
      } catch (e) {
        console.warn("[FT] Error extracting search query:", e.message || e);
      }
    } else if (pageType === "WATCH" && videoTitle) {
      // Classify video title
      aiClassification = await classifyContent(videoTitle, "watch");
      if (aiClassification) {
        // Store classification result
        await setLocal({
          ft_last_watch_classification: {
            category: aiClassification.category,
            allowed: aiClassification.allowed,
            title: videoTitle,
            timestamp: Date.now(),
          },
        });
        LOG("AI Watch Classification:", { title: videoTitle.substring(0, 50), ...aiClassification });
      }
    }
  }

  // 6. Check unlock status
  const now = Date.now();
  const unlocked = await isTemporarilyUnlocked(now);

  // 7. Build context for evaluateBlock()
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

  // 8. Check AI classification and allowance (Pro users only)
  let finalBlocked = false;
  let finalScope = "none";
  let finalReason = "ok";

  // If AI classified content as distracting, check allowance
  if (aiClassification && aiClassification.category === "distracting") {
    const allowanceVideosLeft = Number(state.ft_allowance_videos_left || 1);
    const allowanceSecondsLeft = Number(state.ft_allowance_seconds_left || 600);

    if (pageType === "WATCH") {
      // For watch pages: check video allowance
      if (allowanceVideosLeft > 0) {
        // Allow but decrement allowance
        await setLocal({ ft_allowance_videos_left: allowanceVideosLeft - 1 });
        LOG("AI Distracting Video Allowed (allowance decremented):", { remaining: allowanceVideosLeft - 1 });
        finalBlocked = false;
        finalScope = "none";
        finalReason = "ai_allowance_used";
      } else {
        // Block - no allowance left
        LOG("AI Distracting Video Blocked (no allowance):", { remaining: 0 });
        finalBlocked = true;
        finalScope = "search"; // Use search scope for AI-blocked content
        finalReason = "ai_distracting_no_allowance";
      }
    } else if (pageType === "SEARCH") {
      // For search pages: check time allowance (we'll track time watched)
      // For now, allow if seconds allowance > 0, but we'll need to track time
      // This is a simplified version - full implementation would track time watched
      if (allowanceSecondsLeft > 0) {
        // Allow for now (time tracking will be handled separately)
        finalBlocked = false;
        finalScope = "none";
        finalReason = "ai_allowance_used";
      } else {
        // Block - no time allowance left
        LOG("AI Distracting Search Blocked (no time allowance):", { remaining: 0 });
        finalBlocked = true;
        finalScope = "search";
        finalReason = "ai_distracting_no_allowance";
      }
    }
  } else {
    // Not distracting or no AI classification - use normal block logic
    const blockResult = evaluateBlock(ctx);
    finalBlocked = blockResult.blocked;
    finalScope = blockResult.scope;
    finalReason = blockResult.reason;
  }

  // 9. If global block triggered, mark it
  if (finalBlocked && finalScope === "global" && !state.ft_blocked_today) {
    await setLocal({ ft_blocked_today: true });
  }

  // 10. Respond to content.js
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
      category: aiClassification.category,
      allowed: aiClassification.allowed
    } : null
  };

  LOG("NAV:", { url, ...resp });
  return resp;
}
