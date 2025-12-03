// content/content.js
// ROLE: The "eyes and hands" of FocusTube.
// Watches YouTube pages, tells the background what's happening,
// and enforces the decision (pause, overlay, redirect).

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// DEBUG MODE (set false when you ship)
// ─────────────────────────────────────────────────────────────
const DEBUG = false;
function LOG(...a) {
  if (!DEBUG) return;
  console.log(`%c[FocusTube Content]`, "color: #0ff; font-weight: bold;", ...a);
}

/**
 * Get server URL - checks storage for override, defaults to localhost
 * Cross-browser compatible (no imports needed for content scripts)
 * @returns {Promise<string>} Server URL
 */
async function getServerUrl() {
  try {
    // Check if chrome.storage is available
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const storage = await chrome.storage.local.get(["ft_server_url"]);
      if (storage.ft_server_url && typeof storage.ft_server_url === 'string') {
        return storage.ft_server_url.trim();
      }
    }
  } catch (e) {
    console.warn("[FT] Error reading server URL from storage:", e.message);
  }
  
  // Default to production backend URL
  return "https://focustube-backend-4xah.onrender.com";
}

// ─────────────────────────────────────────────────────────────
// BASIC HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Detect what kind of YouTube page we're on.
 * This function looks at the URL to classify:
 *  - /shorts/...  → SHORTS
 *  - /results?... → SEARCH
 *  - /watch?...   → WATCH
 *  - /            → HOME
 *  - else         → OTHER
 */
function detectPageType() {
  const path = location.pathname;

  if (path.startsWith("/shorts")) return "SHORTS";
  if (path.startsWith("/results")) return "SEARCH";
  if (path.startsWith("/watch")) return "WATCH";
  if (path === "/") return "HOME";

  return "OTHER";
}

/**
 * Get effective plan (pro or free) based on current state
 * - Trial (active) → "pro"
 * - Trial (expired) → "free"
 * - Pro → "pro"
 * - Free → "free"
 * @returns {Promise<"pro"|"free">} Effective plan
 */
async function getEffectivePlan() {
  try {
    const { ft_plan, ft_days_left } = await chrome.storage.local.get(["ft_plan", "ft_days_left"]);
    const plan = ft_plan || "free";
    
    // If trial, check if expired
    if (plan === "trial") {
      const daysLeft = typeof ft_days_left === "number" ? ft_days_left : null;
      if (daysLeft !== null && daysLeft <= 0) {
        // Trial expired → free
        return "free";
      }
      // Trial active → pro
      return "pro";
    }
    
    // Pro or Free → return as-is
    return plan === "pro" ? "pro" : "free";
  } catch (error) {
    console.warn("[FT] Error getting effective plan:", error);
    return "free"; // Default to free on error
  }
}

/* COMMENTED OUT: Generic block overlay - removed per user request
 * Simple overlay creator. Shown when user is blocked (search/global scope).
 * Uses CSS classes from overlay.css instead of inline styles.
 */
/*
function showOverlay(reason, scope) {
  removeOverlay(); // ensure no duplicates

  const overlay = document.createElement("div");
  overlay.id = "ft-overlay";

  overlay.innerHTML = `
    <div class="ft-box">
      <h1>FocusTube Active</h1>
      <p id="ft-overlay-message">You're blocked from ${scope.toLowerCase()} content.</p>
      <p><strong>Reason:</strong> ${reason}</p>
    </div>
  `;

  document.body.appendChild(overlay);
}
*/

// Add this helper function before openStripeCheckout:
async function checkServerHealth(serverUrl) {
  try {
    const response = await fetch(`${serverUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });
    return response.ok;
  } catch (error) {
    console.warn("[FT] Server health check failed:", error.message);
    return false;
  }
}

/**
 * Opens Stripe Checkout by calling server endpoint
 * Gets user email from storage and creates checkout session
 * @param planType - "monthly", "annual", or "lifetime" (defaults to "monthly")
 */
async function openStripeCheckout(planType = "monthly") {
    try {
    // Get user email from storage
    const storage = await chrome.storage.local.get(["ft_user_email"]);
    const email = storage.ft_user_email;

    if (!email || email.trim() === "") {
      alert("Email not set.\n\nPlease set your email using the dev panel (bottom right corner) or extension settings.\n\nAfter setting your email, try upgrading again.");
        return;
      }

    // Get server URL (checks storage for override, defaults to localhost)
    const serverUrl = await getServerUrl();
    
    // Check if server is reachable
    const serverHealthy = await checkServerHealth(serverUrl);
    if (!serverHealthy) {
      alert("Cannot connect to server.\n\nPlease ensure:\n1. Server is running (cd server && npm run dev)\n2. Server is on port 3000\n3. Check server terminal for errors");
        return;
      }
    
    // Call server to create checkout session
    const response = await fetch(`${serverUrl}/stripe/create-checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.trim(),
        planType: planType,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to create checkout session");
    }

    const data = await response.json();

    if (!data.ok || !data.checkoutUrl) {
      throw new Error("Invalid response from server");
    }

    // Open checkout URL in new tab
    try {
      window.open(data.checkoutUrl, "_blank");
    } catch (e) {
      console.warn("[FT] Error opening Stripe Checkout:", e.message);
      // Fallback: try opening in same tab if popup blocked
      window.location.href = data.checkoutUrl;
    }
  } catch (error) {
    console.error("[FT] Error creating Stripe checkout:", error);
    let errorMsg = "Failed to create checkout session";
    
    // Safely extract error message
    if (error && typeof error === "object") {
      if (error.message) {
        errorMsg = error.message;
      } else if (error.error) {
        errorMsg = error.error;
      } else if (typeof error.toString === "function") {
        errorMsg = error.toString();
      }
    } else if (typeof error === "string") {
      errorMsg = error;
    }
    
    alert(`Failed to open checkout: ${errorMsg}\n\nPlease try again. If the problem persists:\n1. Check your email is set (dev panel bottom right)\n2. Ensure server is running (localhost:3000)\n3. Contact support if issue continues.`);
  }
}

/**
 * Shows Shorts-specific blocking overlay for Free plan users.
 * Displays explanation and two action buttons.
 */
function showShortsBlockedOverlay() {
  removeOverlay(); // ensure no duplicates

  const overlay = document.createElement("div");
  overlay.id = "ft-overlay";

  overlay.innerHTML = `
    <div class="ft-box">
      <h1>FocusTube Active</h1>
      <p id="ft-overlay-message">
        Shorts are blocked on the Free plan to help you stay focused. Upgrade to Pro to watch Shorts with smart tracking and controls.
      </p>
      <div class="ft-button-container">
        <button id="ft-back-home" class="ft-button ft-button-secondary">Back to Home Screen</button>
        <button id="ft-upgrade-pro" class="ft-button ft-button-primary">Upgrade to Pro</button>
      </div>
    </div>
  `;

  // Back to Home button - just dismiss overlay (user already on home)
  overlay.querySelector("#ft-back-home").addEventListener("click", () => {
    removeOverlay();
  });

  // Upgrade to Pro button - opens Stripe Checkout
  overlay.querySelector("#ft-upgrade-pro").addEventListener("click", () => {
    openStripeCheckout("monthly").catch((err) => {
      console.error("[FT] Checkout error:", err);
    });
  });

  document.body.appendChild(overlay);
}

/**
 * Shows onboarding overlay for first-time users
 * Prompts user to click extension icon to sign up/sign in
 */
function showOnboardingOverlay() {
  removeOverlay(); // ensure no duplicates

  const overlay = document.createElement("div");
  overlay.id = "ft-overlay";
  overlay.className = "ft-onboarding-overlay";

  overlay.innerHTML = `
    <div class="ft-box ft-onboarding-box">
      <h1>🎯 Welcome to FocusTube!</h1>
      <p class="ft-onboarding-intro" style="font-size:16px;margin-bottom:20px;">
        Get started by connecting your account to unlock Pro features.
      </p>
      
      <div style="padding:20px;background:rgba(100,150,255,0.1);border-radius:8px;border:1px solid rgba(100,150,255,0.3);margin-bottom:20px;">
        <p style="font-size:14px;line-height:1.6;color:#ffffff;">
          <strong>Click the FocusTube extension icon</strong> (top right of your browser) to:
        </p>
        <ul style="margin-top:12px;padding-left:20px;font-size:14px;line-height:1.8;color:#ffffff;">
          <li>Start your 14-day free Pro trial</li>
          <li>Sign in to an existing account</li>
          <li>Continue with Free plan</li>
        </ul>
      </div>
      
      <div class="ft-button-container" style="margin-top:24px;">
        <button id="ft-onboarding-dismiss" class="ft-button ft-button-primary">Got it, I'll click the icon</button>
        <button id="ft-onboarding-skip" class="ft-button" style="margin-top:12px;background:transparent;border:1px solid rgba(255,255,255,0.3);">Skip for now</button>
      </div>
    </div>
  `;

  // Dismiss button - marks onboarding as completed
  overlay.querySelector("#ft-onboarding-dismiss").addEventListener("click", async () => {
    try {
      if (!isChromeContextValid()) {
        alert("Extension context invalidated. Please reload the page.");
        return;
      }
      
      await chrome.storage.local.set({
        ft_onboarding_completed: true
      });
      
      // Dismiss overlay
      removeOverlay();
      
      // Trigger navigation check to show normal extension flow
      handleNavigation().catch(console.error);
    } catch (e) {
      console.error("[FT] Error dismissing onboarding:", e);
      alert("Error saving. Please try again.");
    }
  });

  // Skip button - also marks onboarding as completed
  overlay.querySelector("#ft-onboarding-skip").addEventListener("click", async () => {
    try {
      if (!isChromeContextValid()) {
        return;
      }
      
      await chrome.storage.local.set({
        ft_onboarding_completed: true
      });
      
      removeOverlay();
      handleNavigation().catch(console.error);
    } catch (e) {
      console.error("[FT] Error skipping onboarding:", e);
      removeOverlay();
    }
  });

  document.body.appendChild(overlay);
}

/**
 * Shows Shorts blocking overlay for Pro plan users who manually blocked Shorts.
 * Displays encouraging message about choosing discipline.
 */
function showProManualBlockOverlay() {
  removeOverlay(); // ensure no duplicates

  const overlay = document.createElement("div");
  overlay.id = "ft-overlay";

  overlay.innerHTML = `
    <div class="ft-box">
      <h1>🎯 Shorts Blocked!</h1>
      <p id="ft-overlay-message">
        You have chosen to block Shorts for today and have chosen discipline. This decision will help you stay focused and productive.
      </p>
      <div class="ft-button-container">
        <button id="ft-continue" class="ft-button ft-button-primary">Continue</button>
      </div>
    </div>
  `;

  // Continue button - dismiss overlay (user already on home)
  overlay.querySelector("#ft-continue").addEventListener("click", () => {
    removeOverlay();
  });

  document.body.appendChild(overlay);
}

/**
 * Shows channel blocked confirmation overlay (2 seconds, auto-dismiss, then redirect)
 * @param {string} channelName - Name of the blocked channel
 */
function showChannelBlockedOverlay(channelName) {
  removeOverlay(); // ensure no duplicates
  
  // Pause and mute video before showing overlay
  pauseAndMuteVideo();

  // DOM safety check
  if (!document.body) {
    // Fallback: immediate redirect if DOM not ready
    window.location.href = "https://www.youtube.com/";
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "ft-overlay";
  overlay.className = "ft-channel-blocked-overlay";

  overlay.innerHTML = `
    <div class="ft-box">
      <h1>✅ Channel Blocked</h1>
      <p id="ft-overlay-message">
        ${channelName} has been blocked to help you stay focused. Redirecting to YouTube home...
      </p>
    </div>
  `;

  document.body.appendChild(overlay);

  // Auto-dismiss and redirect after 3 seconds
  setTimeout(() => {
    removeOverlay();
    window.location.href = "https://www.youtube.com/";
  }, 2000);
}

/** Removes the overlay if it exists */
function removeOverlay() {
  const el = document.getElementById("ft-overlay");
  if (el) el.remove();
}

/** Pauses any active video on the page */
function pauseVideos() {
  document.querySelectorAll("video").forEach(v => v.pause());
}

/**
 * Checks if Chrome runtime is still valid
 * Returns true if context is valid, false if invalidated
 */
function isChromeContextValid() {
  try {
    // Check if chrome.runtime exists and hasn't been invalidated
    return chrome && chrome.runtime && chrome.runtime.id !== undefined;
  } catch (e) {
    return false;
  }
}

/**
 * Computes plan-aware settings (mirrors background getEffectiveSettings)
 * Handles older fields like block_shorts/daily_limit for backward compatibility.
 */
function computeEffectiveSettings(plan = "free", rawSettings = {}) {
  const effective = { ...(rawSettings || {}) };
  const normalizedPlan = (plan || "free").toLowerCase();

  // Convert legacy fields to the new schema if needed
  if (rawSettings && rawSettings.block_shorts !== undefined && effective.shorts_mode === undefined) {
    effective.shorts_mode = rawSettings.block_shorts ? "hard" : "timed";
  }
  if (rawSettings && rawSettings.daily_limit !== undefined && effective.daily_limit_minutes === undefined) {
    effective.daily_limit_minutes = rawSettings.daily_limit;
  }

  if (!effective.shorts_mode) {
    effective.shorts_mode = "timed";
  }

  if (normalizedPlan === "free") {
    // Free plan enforces defaults regardless of stored values
    effective.shorts_mode = "hard";
    effective.hide_recommendations = true;
    effective.daily_limit_minutes = 60;
  } else if (normalizedPlan === "trial" || normalizedPlan === "pro") {
    effective.hide_recommendations = effective.hide_recommendations ?? true;
    const dailyLimit = effective.daily_limit_minutes ?? 60;
    effective.daily_limit_minutes = dailyLimit;
  } else {
    // Test/unknown plans - use stored values with safe defaults
    effective.hide_recommendations = effective.hide_recommendations ?? false;
    effective.daily_limit_minutes = effective.daily_limit_minutes ?? 90;
  }

  // Keep legacy field in sync for any downstream usage
  effective.daily_limit = effective.daily_limit_minutes;

  return effective;
}

/** Stores original video state for restoration */
let savedVideoStates = null;

/**
 * Pauses and mutes all videos on the page, storing their original state
 * @returns {Array} Array of video states [{video, wasPaused, wasMuted}, ...]
 */
function pauseAndMuteVideo() {
  const videos = document.querySelectorAll("video");
  savedVideoStates = [];
  
  videos.forEach(video => {
    const state = {
      video: video,
      wasPaused: video.paused,
      wasMuted: video.muted
    };
    savedVideoStates.push(state);
    
    // Pause and mute the video
    video.pause();
    video.muted = true;
  });
  
  return savedVideoStates;
}

/**
 * Restores original video muted state (does not auto-play)
 * This restores muted state but keeps videos paused - user must manually resume
 */
function restoreVideoState() {
  if (!savedVideoStates) return;
  
  savedVideoStates.forEach(({ video, wasMuted }) => {
    // Restore muted state (but don't auto-play - YouTube best practice)
    if (video && !video.paused) {
      // If video somehow started playing, restore muted state
      video.muted = wasMuted;
    } else {
      // Video is paused, just restore muted state
      video.muted = wasMuted;
    }
  });
  
  savedVideoStates = null;
}

// ─────────────────────────────────────────────────────────────
// PRO MODE SHORTS COUNTER BADGE
// ─────────────────────────────────────────────────────────────

let shortsTimeTracker = null; // Interval timer for time tracking
let shortsTimeStart = null; // When time tracking started
let shortsEngagementTimer = null; // Timer to check if user stays > 5 seconds
let shortsPageEntryTime = null; // When user entered current Shorts page
let shortsCurrentVideoId = null; // Current Shorts video ID being tracked
let lastKnownBadgeValues = { engaged: 0, scrolled: 0, seconds: 0 }; // Last known badge values (prevents false 0,0 display)

// Global time tracking (all YouTube pages)
let globalTimeTracker = null; // Interval timer for global time tracking
let globalTimeStart = null; // When global time tracking started
let lastGlobalSaveTime = null; // Last time we saved global time
let globalBaseSeconds = 0; // Base seconds for global time tracking (synced with storage)
let focusWindowCheckInterval = null; // Interval timer for focus window check during video playback

// Video watch time tracking for AI classification (45 seconds trigger)
let videoWatchTimer = null; // Timer for 45-second watch trigger
let currentWatchVideoId = null; // Current video being watched
let videoWatchStartTime = null; // When current video watch started
let videoClassified = false; // Whether current video has been classified

// Journal nudge tracking (1 minute trigger for distracting content)
let journalNudgeTimer = null; // Timer for 1-minute journal nudge trigger
let journalNudgeShown = false; // Whether journal nudge has been shown for current video
let currentVideoAIClassification = null; // Store AI classification for journal nudge check

// Behavior loop awareness tracking
let behaviorLoopTimer = null; // 60-second interval timer for watch time tracking
let behaviorLoopStartTime = null; // When current video watch started (for behavior tracking)
let behaviorLoopPausedTime = 0; // Accumulated paused time (to subtract from total)
let behaviorLoopLastPauseTime = null; // When video was last paused (null if playing)
let behaviorLoopTabHidden = false; // Whether tab is currently hidden
let behaviorLoopCurrentClassification = null; // Current video classification (distracting/productive/neutral)
let behaviorLoopNudgeShown = false; // Whether a nudge has been shown for current video
let behaviorLoopLastUpdateTime = null; // Last time we updated counters (to track incremental time)
let behaviorLoopAccumulatedTime = 0; // Total time accumulated for current video (to avoid double-counting)

/**
 * Extracts video ID from YouTube Shorts URL
 * @param {string} pathname - Location pathname (e.g., "/shorts/ABC123")
 * @returns {string|null} - Video ID or null if not a Shorts URL
 */
function getShortsVideoId(pathname = location.pathname) {
  const match = pathname.match(/^\/shorts\/([^/?]+)/);
  return match ? match[1] : null;
}

/**
 * Extracts comprehensive video metadata from YouTube watch page
 * Returns all available data for AI classification
 */
/**
 * Extracts video ID from YouTube URL
 * @param {string} url - Full URL or pathname
 * @returns {string|null} - Video ID or null
 */
function extractVideoIdFromUrl(url = location.href) {
  try {
    const urlObj = new URL(url);
    const videoId = urlObj.searchParams.get("v");
    return videoId || null;
  } catch (e) {
    // Fallback: try regex if URL parsing fails
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  }
}

/**
 * Fast channel extraction for blocking check (meta tags first, then DOM)
 * This is optimized for speed - tries meta tags first (instant), falls back to DOM
 * @returns {string|null} Channel name or null if not found
 */
function extractChannelFast() {
  const currentVideoId = extractVideoIdFromUrl();
  
  // Helper: Extract first channel from text (handles "Channel A & Channel B" or "A, B, C")
  function extractFirstChannel(channelText) {
    if (!channelText) return null;
    
    // Split by common separators: &, comma
    const separators = /[&,]/;
    if (separators.test(channelText)) {
      const parts = channelText.split(separators).map(s => s.trim()).filter(s => s.length > 0);
      return parts[0] || channelText.trim(); // Return first part, or original if split failed
    }
    return channelText.trim();
  }
  
  // Method 1: YouTube internal data structure (MOST RELIABLE - NEW)
  // This is the primary source - available immediately and always accurate
  if (window.ytInitialPlayerResponse?.videoDetails?.author) {
    const channelName = window.ytInitialPlayerResponse.videoDetails.author.trim();
    const playerVideoId = window.ytInitialPlayerResponse.videoDetails.videoId;
    // Verify it's for the current video (prevents stale data from previous navigation)
    if (channelName && (playerVideoId === currentVideoId || !currentVideoId)) {
      return extractFirstChannel(channelName); // ✅ Handles multi-channel automatically
    }
  }
  
  // Method 2: Meta tags (fast, reliable fallback)
  const metaChannel = document.querySelector('meta[property="og:video:channel_name"]');
  const metaUrl = document.querySelector('meta[property="og:url"]');
  
  if (metaChannel && metaUrl) {
    const channelName = metaChannel.getAttribute("content")?.trim();
    const metaVideoId = extractVideoIdFromUrl(metaUrl.getAttribute("content"));
    
    // Verify meta tag is for CURRENT video (not stale from previous navigation)
    if (metaVideoId === currentVideoId && channelName) {
      return extractFirstChannel(channelName); // ✅ Extract first channel
    }
    // If video IDs don't match, meta tag is stale → skip it
  } else if (metaChannel) {
    // Meta channel exists but no URL meta tag - trust it (meta tags are usually fresh)
    const channelName = metaChannel.getAttribute("content")?.trim();
    if (channelName) {
      return extractFirstChannel(channelName);
    }
  }
  
  // Method 3: DOM fallback - try querySelectorAll to find first valid channel
  const mainVideoContainer = document.querySelector(
    "#primary-inner, ytd-watch-metadata, ytd-video-owner-renderer"
  );
  
  if (mainVideoContainer) {
    // Try querySelectorAll to get all channel elements, then pick first with text
    const channelElements = mainVideoContainer.querySelectorAll(
      "ytd-channel-name a, #channel-name a, #owner-sub-count a"
    );
    
    for (const channelEl of channelElements) {
      const isVisible = channelEl.offsetParent !== null;
      const isInMainVideo = mainVideoContainer.contains(channelEl);
      
      if (isVisible && isInMainVideo) {
        const channelText = channelEl.textContent?.trim();
        if (channelText && channelText.length > 0) {
          return extractFirstChannel(channelText); // ✅ Extract first channel
        }
      }
    }
  }
  
  // Method 4: Last resort - try more specific DOM selectors with querySelectorAll
  const candidates = document.querySelectorAll(
    "ytd-watch-metadata ytd-channel-name a, " +
    "ytd-video-owner-renderer #channel-name a"
  );
  
  for (const candidate of candidates) {
    const isVisible = candidate.offsetParent !== null;
    const isInMainVideo = candidate.closest("#primary, ytd-watch-metadata, ytd-video-owner-renderer");
    
    if (isVisible && isInMainVideo) {
      const channelText = candidate.textContent?.trim();
      if (channelText && channelText.length > 0) {
        return extractFirstChannel(channelText); // ✅ Extract first channel
      }
    }
  }
  
  return null; // Not found - don't block (safer than false positive)
}

/**
 * Step 1: Wait for DOM element to appear (for YouTube SPA async loading)
 * @param {string} selector - CSS selector to wait for
 * @param {number} timeout - Maximum time to wait in milliseconds (default: 2000)
 * @returns {Promise<boolean>} - Resolves to true if element found, false if timeout
 */
function waitForElement(selector, timeout = 2000) {
  return new Promise((resolve) => {
    // Check immediately
    if (document.querySelector(selector)) {
      resolve(true);
      return;
    }
    
    // Set up MutationObserver to watch for element
    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(true);
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Timeout fallback
    setTimeout(() => {
      observer.disconnect();
      resolve(false);
    }, timeout);
  });
}

let lastDescriptionExpandedVideoId = null;

async function expandDescriptionIfCollapsed(videoId) {
  try {
    // Skip if we already expanded for this video
    if (videoId && lastDescriptionExpandedVideoId === videoId) {
      return;
    }

    // Wait for description container to exist first
    const descContainer = await waitForElement(
      'ytd-video-secondary-info-renderer, #description, #watch-description',
      2000
    );

    if (!descContainer) {
      console.log("[FT] Description container not found, skipping expansion");
      return;
    }

    // Try multiple selectors for "Show more" button (YouTube uses different ones)
    const selectors = [
      'button[aria-label*="show more" i]',
      'button[aria-label*="SHOW MORE" i]',
      '#expand',
      '#more',
      'tp-yt-paper-button#expand',
      'yt-formatted-string[role="button"][id="expand"]',
      'ytd-video-secondary-info-renderer #expand',
      'ytd-video-secondary-info-renderer #more',
      'ytd-video-secondary-info-renderer button',
      'ytd-expander button',
      'ytd-expander #expand',
      'ytd-expander #more'
    ];

    let showMoreBtn = null;
    for (const selector of selectors) {
      showMoreBtn = document.querySelector(selector);
      if (showMoreBtn) {
        const label = (showMoreBtn.getAttribute("aria-label") || showMoreBtn.textContent || "").toLowerCase();
        if (label.includes("more") || selector.includes("expand") || selector.includes("more")) {
          console.log(`[FT] Found "Show more" button with selector: ${selector}`);
          break;
        }
      }
    }

    if (!showMoreBtn) {
      console.log("[FT] No 'Show more' button found (description may already be expanded)");
      return;
    }

    // Check if already expanded
    const ariaExpanded = showMoreBtn.getAttribute("aria-expanded");
    const label = (showMoreBtn.getAttribute("aria-label") || showMoreBtn.textContent || "").toLowerCase();
    const alreadyExpanded = ariaExpanded === "true" || label.includes("show less") || label.includes("less");

    if (alreadyExpanded) {
      console.log("[FT] Description already expanded");
      return;
    }

    // Click the button
    console.log("[FT] Clicking 'Show more' button to expand description");
    showMoreBtn.click();
    
    if (videoId) {
      lastDescriptionExpandedVideoId = videoId;
    }

    // Wait longer for YouTube's animation to complete
    await new Promise((resolve) => setTimeout(resolve, 700));
    console.log("[FT] Description expansion complete");
  } catch (error) {
    console.warn("[FT] Failed to expand description:", error?.message || error);
  }
}

function extractVideoMetadata() {
  const metadata = {
    video_id: null,
    title: null,
    description: null,
    tags: [],
    channel: null,
    category: null,
    related_videos: [],
    duration_seconds: null,
    is_shorts: false
  };

  try {
    // 0. Extract Video ID from URL
    metadata.video_id = extractVideoIdFromUrl();
    
    // 0.5. Detect if this is a Shorts video
    const pathname = location.pathname;
    metadata.is_shorts = pathname.startsWith("/shorts/") || pathname.includes("/shorts/");
    
    // Helper: Extract first channel from text (handles "Channel A & Channel B" or "A, B, C")
    function extractFirstChannel(channelText) {
      if (!channelText) return null;
      const separators = /[&,]/;
      if (separators.test(channelText)) {
        const parts = channelText.split(separators).map(s => s.trim()).filter(s => s.length > 0);
        return parts[0] || channelText.trim();
      }
      return channelText.trim();
    }
    
    // PRIMARY SOURCE: YouTube internal data structure (MOST RELIABLE)
    // Extract all available data from ytInitialPlayerResponse.videoDetails
    const videoDetails = window.ytInitialPlayerResponse?.videoDetails;
    const currentVideoId = metadata.video_id;
    
    if (videoDetails && videoDetails.videoId === currentVideoId) {
      // Verify it's for the current video (prevents stale data from previous navigation)
      if (videoDetails.title) {
        metadata.title = videoDetails.title.trim();
      }
      if (videoDetails.shortDescription) {
        metadata.description = videoDetails.shortDescription.trim().substring(0, 500);
      }
      if (Array.isArray(videoDetails.keywords) && videoDetails.keywords.length > 0) {
        metadata.tags = videoDetails.keywords;
      }
      if (videoDetails.author) {
        metadata.channel = extractFirstChannel(videoDetails.author.trim());
      }
      if (videoDetails.lengthSeconds) {
        metadata.duration_seconds = parseInt(videoDetails.lengthSeconds, 10) || null;
      }
    }
    
    // 1. Video Title (fallback if not from videoDetails)
    if (!metadata.title) {
      const titleElement = document.querySelector("h1.ytd-watch-metadata yt-formatted-string, h1.ytd-video-primary-info-renderer, h1.title");
      if (titleElement) {
        metadata.title = titleElement.textContent?.trim() || null;
      } else {
        // Fallback: try meta tag
        const metaTitle = document.querySelector('meta[property="og:title"]');
        if (metaTitle) {
          metadata.title = metaTitle.getAttribute("content")?.trim() || null;
        }
      }
    }

    // 2. Video Description (fallback if not from videoDetails)
    if (!metadata.description) {
      const descElement = document.querySelector("#description, ytd-video-secondary-info-renderer #description, #watch-description-text");
      if (descElement) {
        const descText = descElement.textContent?.trim() || "";
        metadata.description = descText.substring(0, 500); // Truncate to 500 chars
      } else {
        // Fallback: try meta tag
        const metaDesc = document.querySelector('meta[property="og:description"]');
        if (metaDesc) {
          metadata.description = metaDesc.getAttribute("content")?.trim()?.substring(0, 500) || null;
        }
      }
    }

    // 3. Video Tags (fallback if not from videoDetails)
    if (!metadata.tags || metadata.tags.length === 0) {
      // Try multiple selectors for tags
      const tagElements = document.querySelectorAll(
        'ytd-watch-metadata #container ytd-badge-supported-renderer, ' +
        'meta[property="og:video:tag"], ' +
        'ytd-metadata-row-renderer[has-metadata-layout="COMPACT"] a'
      );
      if (tagElements.length > 0) {
        metadata.tags = [];
        tagElements.forEach(el => {
          const tagText = el.textContent?.trim() || el.getAttribute("content")?.trim();
          if (tagText && tagText.length > 0) {
            metadata.tags.push(tagText);
          }
        });
      }
    }

    // 4. Channel Name - Use YouTube internal data first, then fallbacks
    // (Already extracted from videoDetails above if available)
    if (!metadata.channel) {
      let channelElement = null;

      // Method 1: Meta tags (reliable fallback)
      const metaChannel = document.querySelector('meta[property="og:video:channel_name"]');
      const metaUrl = document.querySelector('meta[property="og:url"]');
      
      if (metaChannel && metaUrl) {
        const channelName = metaChannel.getAttribute("content")?.trim();
        const metaVideoId = extractVideoIdFromUrl(metaUrl.getAttribute("content"));
        
        if (metaVideoId === currentVideoId && channelName) {
          metadata.channel = extractFirstChannel(channelName);
        }
      } else if (metaChannel) {
        const channelName = metaChannel.getAttribute("content")?.trim();
        if (channelName) {
          metadata.channel = extractFirstChannel(channelName);
        }
      }

      // Method 2: DOM fallback - look within main video container
      if (!metadata.channel) {
        const mainVideoContainer = document.querySelector(
          "#primary-inner, ytd-watch-metadata, ytd-video-owner-renderer"
        );

        if (mainVideoContainer) {
          const channelElements = mainVideoContainer.querySelectorAll(
            "ytd-channel-name a, #channel-name a, #owner-sub-count a"
          );
          
          for (const channelEl of channelElements) {
            const isVisible = channelEl.offsetParent !== null;
            const isInMainVideo = mainVideoContainer.contains(channelEl);
            
            if (isVisible && isInMainVideo) {
              const channelText = channelEl.textContent?.trim();
              if (channelText && channelText.length > 0) {
                channelElement = channelEl;
                break;
              }
            }
          }
        }

        // Method 3: Try more specific selectors
        if (!channelElement) {
          const candidates = document.querySelectorAll(
            "ytd-watch-metadata ytd-channel-name a, " +
            "ytd-video-owner-renderer #channel-name a, " +
            "#owner-sub-count a"
          );
          
          for (const candidate of candidates) {
            const isVisible = candidate.offsetParent !== null;
            const isInMainVideo = candidate.closest("#primary, ytd-watch-metadata, ytd-video-owner-renderer");
            
            if (isVisible && isInMainVideo) {
              const channelText = candidate.textContent?.trim();
              if (channelText && channelText.length > 0) {
                channelElement = candidate;
                break;
              }
            }
          }
        }
        
        // Extract channel from found element
        if (channelElement) {
          const channelText = channelElement.textContent?.trim();
          if (channelText) {
            metadata.channel = extractFirstChannel(channelText);
          }
        }
      }
    }

    // 5. Video Category (YouTube's category)
    const categoryElement = document.querySelector('meta[itemprop="genre"]');
    if (categoryElement) {
      metadata.category = categoryElement.getAttribute("content")?.trim() || null;
    } else {
      // Try alternative selector
      const categoryText = document.querySelector("#watch-description-extras ytd-metadata-row-renderer");
      if (categoryText) {
        const categoryLabel = categoryText.querySelector("#label");
        if (categoryLabel && categoryLabel.textContent?.toLowerCase().includes("category")) {
          const categoryValue = categoryText.querySelector("#content");
          if (categoryValue) {
            metadata.category = categoryValue.textContent?.trim() || null;
          }
        }
      }
    }

    // 6. Related Videos (first 3-5, with channel_name and is_shorts)
    const relatedVideoContainers = document.querySelectorAll(
      "ytd-watch-next-secondary-results-renderer ytd-compact-video-renderer"
    );
    if (relatedVideoContainers.length > 0) {
      const maxRelated = Math.min(5, Math.max(3, relatedVideoContainers.length)); // At least 3, up to 5
      for (let i = 0; i < maxRelated; i++) {
        const container = relatedVideoContainers[i];
        const titleEl = container.querySelector("#video-title, a#video-title");
        const channelEl = container.querySelector("#channel-name a, #channel-name yt-formatted-string, ytd-channel-name a");
        
        const title = titleEl?.textContent?.trim() || null;
        const channelName = channelEl?.textContent?.trim() || null;
        
        // Detect if related video is Shorts (check for Shorts indicator or URL)
        let isShorts = false;
        const linkEl = container.querySelector("a#video-title");
        if (linkEl) {
          const href = linkEl.getAttribute("href") || "";
          isShorts = href.includes("/shorts/");
        }
        
        if (title) {
          metadata.related_videos.push({
            title: title,
            channel_name: channelName || "",
            is_shorts: isShorts
          });
        }
      }
    }

    // 7. Video Duration (fallback if not from videoDetails)
    if (!metadata.duration_seconds) {
      // Try meta tag first
      const durationMeta = document.querySelector('meta[itemprop="duration"]');
      if (durationMeta) {
        const durationContent = durationMeta.getAttribute("content");
        // ISO 8601 duration format: PT4M13S → 253 seconds
        if (durationContent && durationContent.startsWith("PT")) {
          const match = durationContent.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
          if (match) {
            const hours = parseInt(match[1] || 0);
            const minutes = parseInt(match[2] || 0);
            const seconds = parseInt(match[3] || 0);
            metadata.duration_seconds = hours * 3600 + minutes * 60 + seconds;
          }
        }
      } else {
        // Fallback: try DOM element
        const durationElement = document.querySelector("span.ytp-time-duration, .ytp-time-duration");
        if (durationElement) {
          const durationText = durationElement.textContent?.trim();
          if (durationText) {
            // Parse "4:13" or "1:23:45" format
            const parts = durationText.split(":").map(Number);
            if (parts.length === 2) {
              metadata.duration_seconds = parts[0] * 60 + parts[1];
            } else if (parts.length === 3) {
              metadata.duration_seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            }
          }
        }
      }
    }

  } catch (e) {
    console.warn("[FT] Error in extractVideoMetadata:", e.message || e);
  }

  // Step 3: Log extracted metadata for debugging
  console.log("[FT] Metadata extracted:", {
    video_id: metadata.video_id || "MISSING",
    title: metadata.title?.substring(0, 50) || "MISSING",
    description: metadata.description ? `${metadata.description.substring(0, 50)}...` : "MISSING",
    tags_count: metadata.tags.length,
    channel: metadata.channel || "MISSING",
    related_videos_count: metadata.related_videos.length,
    category: metadata.category || "MISSING",
    is_shorts: metadata.is_shorts
  });

  return metadata;
}

/**
 * Formats seconds into readable time (e.g., "5m 23s")
 */
function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) return `${minutes}m`;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Formats seconds into minutes for milestone display
 */
function formatMinutes(seconds) {
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return "1 min";
  return `${minutes} mins`;
}

/**
 * Gets realistic productivity examples for 2, 5, 10, 15, and 20 minutes.
 */
function getProductivityExamples(totalMinutes) {
  const buckets = [2, 5, 10, 15, 20];
  const bucket = buckets.filter(b => totalMinutes >= b).pop() ?? 2;

  const examplesByBucket = {
    2: [
      "☕ Grab a drink and look away from your screen",
      "💨 Step outside for a minute of fresh air",
      "🧘 Take two deep breaths and stretch your body",
      "📱 Reply to that one message you've been ignoring",
      "🧠 Think about one thing you actually want to get done today",
    ],
    5: [
      "🚶 Take a short walk around your room or hallway",
      "🧼 Tidy up your desk or clear some clutter",
      "📖 Read a couple pages of a book",
      "🍎 Grab a quick snack or drink some water",
      "💬 Text a friend something positive",
    ],
    10: [
      "🍳 Make a quick snack or coffee",
      "🧘 Do a short stretch or light workout",
      "🗒️ Plan the rest of your day on paper",
      "📞 Call your mum or dad",
      "📚 Read a short article or learn one new thing",
    ],
    15: [
      "🏃 Go for a quick walk outside",
      "📦 Do a small chore you've been putting off",
      "🎧 Listen to a short podcast or playlist",
      "👥 Make plans with a friend",
      "📓 Write or journal for a few minutes",
    ],
    20: [
      "🌳 Go outside and take a proper break from screens",
      "🍝 Cook and eat something simple",
      "📖 Read a full chapter of a book",
      "💡 Sketch out an idea you've been thinking about",
      "🧺 Start a small household task like laundry or dishes",
    ],
  };

  return examplesByBucket[bucket];
}
 
/**
 * Updates the Shorts counter badge text
 * Format: Two lines - "Total Shorts Watched X (Y Skipped)" and "Total Time on Shorts 5m 20s"
 * Uses lastKnownBadgeValues as fallback if new values are invalid
 */
async function updateShortsBadge(shortsEngaged, shortsScrolled, shortsSeconds) {
  const badge = document.getElementById("ft-shorts-counter");
  if (!badge) return;

  // Use last known values as fallback if new values are invalid/undefined
  const engaged = (shortsEngaged !== undefined && shortsEngaged !== null) ? shortsEngaged : lastKnownBadgeValues.engaged;
  const scrolled = (shortsScrolled !== undefined && shortsScrolled !== null) ? shortsScrolled : lastKnownBadgeValues.scrolled;
  const seconds = (shortsSeconds !== undefined && shortsSeconds !== null) ? shortsSeconds : lastKnownBadgeValues.seconds;

  // Update lastKnownBadgeValues only if we got valid new values
  if (shortsEngaged !== undefined && shortsEngaged !== null) {
    lastKnownBadgeValues.engaged = engaged;
  }
  if (shortsScrolled !== undefined && shortsScrolled !== null) {
    lastKnownBadgeValues.scrolled = scrolled;
  }
  if (shortsSeconds !== undefined && shortsSeconds !== null) {
    lastKnownBadgeValues.seconds = seconds;
  }

  const skipped = Math.max(0, scrolled - engaged);
  const timeText = formatTime(seconds);
  
  badge.innerHTML = `
    <div class="ft-counter-line">
      Total Shorts Watched <span class="ft-counter-highlight">${engaged}</span>${skipped > 0 ? ` (<span class="ft-counter-highlight">${skipped}</span> Skipped)` : ''}
    </div>
    <div class="ft-counter-line ft-counter-time">
      Total Time on Shorts <span class="ft-counter-highlight">${timeText}</span>
    </div>
    <button id="ft-badge-block-btn" class="ft-badge-block-btn">Block for Today</button>
  `;
  
  // Add click handler for Block button
  const blockBtn = badge.querySelector("#ft-badge-block-btn");
  if (blockBtn) {
    blockBtn.addEventListener("click", async () => {
      // Clean up active timers
      if (shortsEngagementTimer) {
        clearTimeout(shortsEngagementTimer);
        shortsEngagementTimer = null;
      }
      if (shortsTimeTracker) {
        await stopShortsTimeTracking();
      }
      
      // Clean up saved video state (redirect will happen anyway)
      savedVideoStates = null;
      
      // Set block flag and mark as Pro manual block
      try {
        await chrome.storage.local.set({ 
          ft_block_shorts_today: true,
          ft_pro_manual_block_shorts: true  // Flag to show different overlay
        });
        if (chrome.runtime.lastError) {
          console.error("[FT] Failed to set block flags:", chrome.runtime.lastError.message);
          // Still redirect even if storage fails
        }
        
        // Set redirect flag for overlay
        await chrome.storage.local.set({ ft_redirected_from_shorts: true });
        if (chrome.runtime.lastError) {
          console.warn("[FT] Failed to set redirect flag:", chrome.runtime.lastError.message);
        }
      } catch (e) {
        console.error("[FT] Error setting block flags:", e.message);
        // Still redirect even if storage fails - blocking will work on next load
      }
      
      // Redirect to home page
      window.location.href = "https://www.youtube.com/";
    });
  }
}

/**
 * Removes the Shorts counter badge if it exists
 */
function removeShortsBadge() {
  const badge = document.getElementById("ft-shorts-counter");
  if (badge) badge.remove();
  
  // Stop time tracking
  if (shortsTimeTracker) {
    clearInterval(shortsTimeTracker);
    shortsTimeTracker = null;
  }
  shortsTimeStart = null;
  
  // Stop engagement tracking
  if (shortsEngagementTimer) {
    clearTimeout(shortsEngagementTimer);
    shortsEngagementTimer = null;
  }
  shortsPageEntryTime = null;
  shortsCurrentVideoId = null; // Clear video ID tracking
}

/**
 * Creates and shows the Pro Shorts counter badge
 * Uses last known values as fallback if provided values are 0 and we have stored values
 */
async function showShortsBadge(shortsEngaged = 0, shortsScrolled = 0, shortsSeconds = 0) {
  removeShortsBadge(); // ensure no duplicates

  const badge = document.createElement("div");
  badge.id = "ft-shorts-counter";
  
  // Append badge to DOM first so updateShortsBadge() can find it
  document.body.appendChild(badge);
  
  // If all values are 0 and we have last known values, use those instead (prevents false 0,0 display)
  const useEngaged = (shortsEngaged === 0 && lastKnownBadgeValues.engaged > 0) ? lastKnownBadgeValues.engaged : shortsEngaged;
  const useScrolled = (shortsScrolled === 0 && lastKnownBadgeValues.scrolled > 0) ? lastKnownBadgeValues.scrolled : shortsScrolled;
  const useSeconds = (shortsSeconds === 0 && lastKnownBadgeValues.seconds > 0) ? lastKnownBadgeValues.seconds : shortsSeconds;
  
  // Initialize badge with values (updateShortsBadge will handle fallback logic too)
  await updateShortsBadge(useEngaged, useScrolled, useSeconds);
}

// ─────────────────────────────────────────────────────────────
// SEARCH COUNTER BADGE
// ─────────────────────────────────────────────────────────────

let searchCounterBadge = null;
let lastSearchWarningAtMinus2 = false; // Track if warning shown for threshold - 2
let lastSearchWarningAtMinus1 = false; // Track if warning shown for threshold - 1

/**
 * Shows or updates the search counter badge
 * Displays "X/5 searches today" or "X/15 searches today" based on plan
 */
async function showSearchCounter(searchesToday, searchLimit, plan) {
  // Remove existing badge if present
  const existing = document.getElementById("ft-search-counter");
  if (existing) existing.remove();

  // Don't show if not on search page
  if (detectPageType() !== "SEARCH") return;

  const badge = document.createElement("div");
  badge.id = "ft-search-counter";
  badge.className = "ft-search-counter";
  badge.innerHTML = `<span class="ft-search-counter-text">${searchesToday}/${searchLimit} searches today</span>`;
  
  document.body.appendChild(badge);
  searchCounterBadge = badge;
}

/**
 * Updates the search counter badge text
 */
function updateSearchCounter(searchesToday, searchLimit) {
  const badge = document.getElementById("ft-search-counter");
  if (!badge) return;
  
  const textEl = badge.querySelector(".ft-search-counter-text");
  if (textEl) {
    textEl.textContent = `${searchesToday}/${searchLimit} searches today`;
  }
}

/**
 * Removes the search counter badge
 */
function removeSearchCounter() {
  const badge = document.getElementById("ft-search-counter");
  if (badge) {
    badge.remove();
    searchCounterBadge = null;
  }
}

// ─────────────────────────────────────────────────────────────
// GLOBAL WATCH TIME COUNTER
// ─────────────────────────────────────────────────────────────

let globalTimeCounterBadge = null;
let isFullscreen = false;

/**
 * Shows or updates the global watch time counter
 * Shows total time watched today on all pages
 */
async function showGlobalTimeCounter(watchSecondsToday) {
  // Remove existing badge if present
  const existing = document.getElementById("ft-global-time-counter");
  if (existing) existing.remove();

  const badge = document.createElement("div");
  badge.id = "ft-global-time-counter";
  badge.className = "ft-global-time-counter";
  
  // Format time
  const timeText = formatTimeLong(watchSecondsToday);
  
  // Update badge content based on fullscreen state
  updateGlobalTimeCounterContent(badge, timeText, isFullscreen);
  
  document.body.appendChild(badge);
  globalTimeCounterBadge = badge;
}

/**
 * Formats seconds into long format (e.g., "1h 15m" or "45m")
 */
function formatTimeLong(seconds) {
  if (seconds < 60) return "<1m";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Updates the global counter badge content
 */
function updateGlobalTimeCounterContent(badge, timeText, minimal = false) {
  if (!badge) return;
  
  if (minimal) {
    // Minimal format for fullscreen - just time
    badge.innerHTML = `<span class="ft-global-time-text-minimal">${timeText}</span>`;
    badge.classList.add("ft-global-time-minimal");
  } else {
    // Full format - "Total time: 1h 15m"
    badge.innerHTML = `<span class="ft-global-time-text">Total time: <strong>${timeText}</strong></span>`;
    badge.classList.remove("ft-global-time-minimal");
  }
}

/**
 * Updates the global counter badge text
 */
function updateGlobalTimeCounter(watchSecondsToday) {
  const badge = document.getElementById("ft-global-time-counter");
  if (!badge) return;
  
  const timeText = formatTimeLong(watchSecondsToday);
  updateGlobalTimeCounterContent(badge, timeText, isFullscreen);
}

/**
 * Removes the global counter badge
 */
function removeGlobalTimeCounter() {
  const badge = document.getElementById("ft-global-time-counter");
  if (badge) {
    badge.remove();
    globalTimeCounterBadge = null;
  }
}

/**
 * Checks and shows warning at threshold - 2 and threshold - 1
 */
async function checkAndShowSearchWarning(searchesToday, searchLimit) {
  const thresholdMinusTwo = searchLimit - 2;
  const thresholdMinusOne = searchLimit - 1;
  
  // Show warning at threshold - 2, only once
  if (searchesToday === thresholdMinusTwo && !lastSearchWarningAtMinus2) {
    lastSearchWarningAtMinus2 = true;
    showSearchWarning(2, "You have 2 searches remaining today - make them count!");
  }
  
  // Show warning at threshold - 1, only once
  if (searchesToday === thresholdMinusOne && !lastSearchWarningAtMinus1) {
    lastSearchWarningAtMinus1 = true;
    showSearchWarning(1, "You have 1 search remaining today - use it wisely!");
  }
  
  // Reset warning flags if user is below threshold - 2
  if (searchesToday < thresholdMinusTwo) {
    lastSearchWarningAtMinus2 = false;
    lastSearchWarningAtMinus1 = false;
  } else if (searchesToday < thresholdMinusOne) {
    // Reset only minus 1 flag if between threshold - 2 and threshold - 1
    lastSearchWarningAtMinus1 = false;
  }
}

/**
 * Shows warning toast notification
 */
function showSearchWarning(remaining, message) {
  // Remove any existing warning
  const existing = document.getElementById("ft-search-warning");
  if (existing) existing.remove();

  const warning = document.createElement("div");
  warning.id = "ft-search-warning";
  warning.className = "ft-search-warning";
  warning.innerHTML = `
    <div class="ft-search-warning-content">
      <span>⚠️ ${message}</span>
    </div>
  `;
  
  document.body.appendChild(warning);
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    if (warning && warning.parentNode) {
      warning.remove();
    }
  }, 5000);
}

/**
 * Shows global time limit overlay with daily summary
 * Big visual overlay with bounce animation on lock icon
 */
async function showGlobalLimitOverlay(plan, counters) {
  removeOverlay(); // ensure no duplicates

  // Get nudge style
  const style = await getNudgeStyle();
  const styleMessage = getNudgeMessage(style, "timeLimit");

  const overlay = document.createElement("div");
  overlay.id = "ft-overlay";
  overlay.className = "ft-global-limit-overlay";

  // Format time watched
  const watchSeconds = counters.watchSeconds || 0;
  const watchMinutes = Math.floor(watchSeconds / 60);
  const timeText = watchMinutes < 1
    ? "<1m"
    : watchMinutes >= 60 
    ? `${Math.floor(watchMinutes / 60)}h ${watchMinutes % 60}m`
    : `${watchMinutes}m`;

  // Get counters
  const shortsViewed = counters.shortsEngaged || 0;
  const searchesMade = counters.searches || 0;
  const longFormVideos = counters.watchVisits || 0;

  // Get button HTML based on plan
  let buttonsHTML = '';
    buttonsHTML = `
      <button id="ft-check-usage" class="ft-button ft-button-primary">Check Your Usage! 📊</button>
    <button id="ft-reset" class="ft-button ft-button-secondary" style="background: #ff6b6b; color: white;">Reset</button>
  `;

  overlay.innerHTML = `
    <div class="ft-box ft-global-limit-box">
      <div class="ft-global-limit-header">
        <div class="ft-global-limit-lock">🔒</div>
        <h1>FocusTube Limit Reached</h1>
      </div>
      <div class="ft-global-limit-body">
        <p class="ft-global-limit-intro">You've hit your YouTube limit for the day. Time to reset your focus.</p>
        <div class="ft-global-limit-stats">
          <div class="ft-global-limit-stat">
            <strong>Time watched today:</strong> ${timeText}
          </div>
          <div class="ft-global-limit-stat">
            <strong>Shorts viewed:</strong> ${shortsViewed}
          </div>
          <div class="ft-global-limit-stat">
            <strong>Long form videos watched:</strong> ${longFormVideos}
          </div>
          <div class="ft-global-limit-stat">
            <strong>Searches made:</strong> ${searchesMade}
          </div>
        </div>
        <p class="ft-global-limit-message">💬 "${styleMessage}"</p>
        ${buttonsHTML ? `<div class="ft-button-container">${buttonsHTML}</div>` : ''}
      </div>
    </div>
  `;

  // Add button handlers
  const checkUsageBtn = overlay.querySelector("#ft-check-usage");
  if (checkUsageBtn) {
    checkUsageBtn.addEventListener("click", () => {
      // Open dashboard in new tab (matches settings link pattern)
      window.open("https://focustube-beta.vercel.app/app/dashboard", "_blank");
    });
  }

  const resetBtn = overlay.querySelector("#ft-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      try {
        if (!isChromeContextValid()) {
          console.warn("[FT] Cannot reset - extension context invalidated");
          return;
        }
        
        const response = await chrome.runtime.sendMessage({ type: "FT_RESET_COUNTERS" });
        if (chrome.runtime.lastError) {
          console.warn("[FT] Failed to reset counters:", chrome.runtime.lastError.message);
          alert("Failed to reset: " + chrome.runtime.lastError.message);
          return;
        }
        
        if (response?.ok) {
        // Reload page to clear overlay and refresh counters
        window.location.reload();
        } else {
          alert(response?.error || "Failed to reset counters");
        }
      } catch (e) {
        console.warn("[FT] Error resetting counters:", e.message);
        alert("Error resetting: " + e.message);
      }
    });
  }

  document.body.appendChild(overlay);
}

/* COMMENTED OUT: Search block overlay - hidden per user request
 * Shows search block overlay with plan-specific buttons
 */
async function showSearchBlockOverlay(plan) {
  removeOverlay(); // ensure no duplicates

  const overlay = document.createElement("div");
  overlay.id = "ft-overlay";

  // Get nudge style from settings
  const nudgeStyle = await getNudgeStyle();
  
  // Get message based on nudge style
  const messages = {
    gentle: {
      title: "Search Limit Reached",
      message: "You've searched enough today. Maybe take a break?"
    },
    direct: {
      title: "Search Limit Reached",
      message: "You've reached your daily search limit. Time to focus on what matters."
    },
    firm: {
      title: "Search Limit Reached",
      message: "That's enough searching for today. Your focus is worth protecting."
    }
  };
  
  const styleMessages = messages[nudgeStyle] || messages.firm;
  const title = styleMessages.title;
  const message = styleMessages.message;

  // Get button HTML based on plan
  let buttonsHTML = '';
  if (plan === "free") {
    buttonsHTML = `
      <button id="ft-upgrade-pro" class="ft-button ft-button-primary">Upgrade to Pro for Smart Search</button>
      <button id="ft-return-yt" class="ft-button ft-button-secondary">Return to YouTube</button>
    `;
  } else {
    buttonsHTML = `
      <button id="ft-return-yt" class="ft-button ft-button-primary">Return to YouTube</button>
    `;
  }
  
  // Add Reset button (dev convenience)
  buttonsHTML += `
    <button id="ft-reset" class="ft-button ft-button-secondary" style="background: #ff6b6b; color: white;">Reset</button>
  `;

  overlay.innerHTML = `
    <div class="ft-box">
      <h1>${title}</h1>
      <p id="ft-overlay-message">${message}</p>
      <div class="ft-button-container">
        ${buttonsHTML}
      </div>
    </div>
  `;

  // Add button handlers
  const returnBtn = overlay.querySelector("#ft-return-yt");
  if (returnBtn) {
    returnBtn.addEventListener("click", () => {
      window.location.href = "https://www.youtube.com/";
    });
  }

  const upgradeBtn = overlay.querySelector("#ft-upgrade-pro");
  if (upgradeBtn) {
    upgradeBtn.addEventListener("click", () => {
      openStripeCheckout("monthly").catch((err) => {
        console.error("[FT] Checkout error:", err);
      });
    });
  }

  const resetBtn = overlay.querySelector("#ft-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      try {
        if (!isChromeContextValid()) {
          console.warn("[FT] Cannot reset - extension context invalidated");
          return;
        }
        
        const response = await chrome.runtime.sendMessage({ type: "FT_RESET_COUNTERS" });
        if (chrome.runtime.lastError) {
          console.warn("[FT] Failed to reset counters:", chrome.runtime.lastError.message);
          alert("Failed to reset: " + chrome.runtime.lastError.message);
          return;
        }
        
        if (response?.ok) {
          // Reload page to clear overlay and refresh counters
          window.location.reload();
        } else {
          alert(response?.error || "Failed to reset counters");
        }
      } catch (e) {
        console.warn("[FT] Error resetting counters:", e.message);
        alert("Error resetting: " + e.message);
      }
    });
  }

  document.body.appendChild(overlay);
}

/**
 * Starts tracking Shorts engagement (5-second timer)
 * Immediately increments total scrolled, then checks if user stays > 5 seconds for engaged count
 * Only starts new timer if video ID changed or no timer is running
 */
async function startShortsEngagementTracking() {
  // Get current Shorts video ID
  const currentVideoId = getShortsVideoId();
  
  // If we're already tracking this video, don't reset the timer
  if (shortsCurrentVideoId === currentVideoId && shortsEngagementTimer !== null) {
    return; // Already tracking this video, don't interfere with the timer
  }
  
  // Clear any existing timer (video changed or new tracking)
  if (shortsEngagementTimer) {
    clearTimeout(shortsEngagementTimer);
    shortsEngagementTimer = null;
  }

  // Update current video ID
  shortsCurrentVideoId = currentVideoId;

  // Immediately increment total scrolled (all Shorts page visits)
  try {
    await chrome.runtime.sendMessage({ type: "FT_BUMP_SHORTS" });
  } catch (e) {
    // Extension context invalidated - ignore, tracking will stop naturally
    if (!isChromeContextValid()) return;
    console.warn("[FT] Failed to bump Shorts counter:", e.message);
  }
  
  // Track entry time
  shortsPageEntryTime = Date.now();
  
  // Set 5-second timer to check if user engaged (stayed > 5 seconds)
  shortsEngagementTimer = setTimeout(async () => {
    // Check if Chrome context is still valid
    if (!isChromeContextValid()) {
      shortsEngagementTimer = null;
      shortsPageEntryTime = null;
      shortsCurrentVideoId = null;
      return;
    }
    
    // Check if user is still on Shorts page and same video
    const stillOnShorts = detectPageType() === "SHORTS";
    const stillSameVideo = shortsCurrentVideoId === getShortsVideoId();
    
    if (shortsPageEntryTime && stillOnShorts && stillSameVideo) {
      // User stayed > 5 seconds, increment engaged counter via message
      try {
        await chrome.runtime.sendMessage({ type: "FT_INCREMENT_ENGAGED_SHORTS" });
      } catch (e) {
        // Extension context invalidated - ignore
        if (!isChromeContextValid()) {
          shortsEngagementTimer = null;
          shortsPageEntryTime = null;
          shortsCurrentVideoId = null;
          return;
        }
        console.warn("[FT] Failed to increment engaged Shorts:", e.message);
      }
    }
    
    // Clear tracking state
    shortsEngagementTimer = null;
    shortsPageEntryTime = null;
    shortsCurrentVideoId = null;
  }, 5000);
}

/**
 * Checks if time-based milestone reached and shows popup (if not already shown)
 * Milestones: 2 min (120s), 5 min (300s), 10 min (600s)
 */
async function checkAndShowTimeMilestone(totalSeconds) {
  if (!isChromeContextValid()) return;
  
  const MILESTONES = [120, 300, 600]; // 2, 5, 10 minutes in seconds (MVP spec)
  
  try {
    // Get last milestone threshold shown
    const { ft_last_time_milestone } = await chrome.storage.local.get(["ft_last_time_milestone"]);
    if (chrome.runtime.lastError) {
      console.warn("[FT] Failed to get milestone:", chrome.runtime.lastError.message);
      return;
    }
    const lastMilestone = Number(ft_last_time_milestone || 0);
    
    // Find which milestone we've crossed (if any)
    for (const milestoneSeconds of MILESTONES) {
      // Check if we've crossed this milestone and haven't shown it yet
      if (totalSeconds >= milestoneSeconds && milestoneSeconds > lastMilestone) {
        // Get all counters for popup display
        let engaged = 0, scrolled = 0;
        try {
          const counters = await chrome.storage.local.get([
            "ft_shorts_engaged_today",
            "ft_short_visits_today"
          ]);
          if (chrome.runtime.lastError) {
            console.warn("[FT] Failed to get counters:", chrome.runtime.lastError.message);
            // Use defaults (0, 0)
          } else {
            engaged = Number(counters.ft_shorts_engaged_today || 0);
            scrolled = Number(counters.ft_short_visits_today || 0);
          }
        } catch (e) {
          console.warn("[FT] Error getting counters for milestone:", e.message);
          // Use defaults (0, 0)
        }
        
        // Show popup
        await showShortsMilestonePopup(engaged, scrolled, totalSeconds);
        
        // Mark this milestone threshold as shown
        try {
          await chrome.storage.local.set({ ft_last_time_milestone: milestoneSeconds });
          if (chrome.runtime.lastError) {
            console.warn("[FT] Failed to save milestone:", chrome.runtime.lastError.message);
          }
        } catch (e) {
          console.warn("[FT] Error saving milestone:", e.message);
        }
        
        // Only show one milestone at a time, break after first match
        break;
      }
    }
  } catch (e) {
    // Extension context invalidated or other error
    if (!isChromeContextValid()) return;
    console.warn("[FT] Error checking milestone:", e.message);
  }
}

/**
 * Shows milestone popup with productivity examples
 */
async function showShortsMilestonePopup(engaged, scrolled, totalSeconds) {
  // Remove any existing popup
  const existingPopup = document.getElementById("ft-milestone-popup");
  if (existingPopup) existingPopup.remove();
  
  // Pause and mute video before showing popup
  pauseAndMuteVideo();
  
  const totalMinutes = Math.floor(totalSeconds / 60);
  const examples = getProductivityExamples(totalMinutes);
  
  // Create popup
  const popup = document.createElement("div");
  popup.id = "ft-milestone-popup";
  
  // Determine emoji based on milestone
  let emoji = "🎬";
  if (engaged >= 50) emoji = "🎞️";
  else if (engaged >= 40) emoji = "🎥";
  else if (engaged >= 30) emoji = "📹";
  else if (engaged >= 20) emoji = "📺";
  
  const timeText = formatMinutes(totalSeconds);
  
  popup.innerHTML = `
    <div class="ft-milestone-box">
      <h2>${emoji} You've watched ${engaged} Shorts (scrolled past ${scrolled}, for ${timeText})</h2>
      <p class="ft-milestone-intro">Instead, you could have:</p>
      <ul class="ft-milestone-examples">
        ${examples.map(ex => `<li>${ex}</li>`).join('')}
      </ul>
      <div class="ft-milestone-buttons">
        <button id="ft-milestone-continue" class="ft-button ft-button-secondary">Continue</button>
        <button id="ft-milestone-block" class="ft-button ft-button-primary">Block Shorts for Today</button>
      </div>
    </div>
  `;
  
  // Continue button - dismiss and restore video state
  popup.querySelector("#ft-milestone-continue").addEventListener("click", () => {
    popup.remove();
    restoreVideoState(); // Restore original muted state (but don't auto-play)
  });
  
  // Block Shorts button - set flag and redirect
  popup.querySelector("#ft-milestone-block").addEventListener("click", async () => {
    // Clean up any active timers
    if (shortsEngagementTimer) {
      clearTimeout(shortsEngagementTimer);
      shortsEngagementTimer = null;
    }
    if (shortsTimeTracker) {
      await stopShortsTimeTracking();
    }
    
    // Clean up saved video state (redirect will happen anyway)
    savedVideoStates = null;
    
    // Set block flag and mark as Pro manual block
    try {
      await chrome.storage.local.set({ 
        ft_block_shorts_today: true,
        ft_pro_manual_block_shorts: true  // Flag to show different overlay
      });
      if (chrome.runtime.lastError) {
        console.error("[FT] Failed to set block flags:", chrome.runtime.lastError.message);
        // Still redirect even if storage fails
      }
      
      // Set redirect flag for overlay
      await chrome.storage.local.set({ ft_redirected_from_shorts: true });
      if (chrome.runtime.lastError) {
        console.warn("[FT] Failed to set redirect flag:", chrome.runtime.lastError.message);
      }
    } catch (e) {
      console.error("[FT] Error setting block flags:", e.message);
      // Still redirect even if storage fails - blocking will work on next load
    }
    
    // Redirect to home
    window.location.href = "https://www.youtube.com/";
  });
  
  document.body.appendChild(popup);
}

/**
 * Shows block channel confirmation dialog with positive messaging
 * @param {string} channelName - Name of channel to block
 * @param {Function} onConfirm - Callback when user confirms
 * @param {Function} onCancel - Callback when user cancels
 */
function showBlockChannelConfirmation(channelName, onConfirm, onCancel) {
  console.log("[FT] 📋 Showing confirmation dialog for:", channelName);
  
  // Remove any existing confirmation
  const existing = document.getElementById("ft-block-channel-confirmation");
  if (existing) existing.remove();
  
  // Pause video before showing dialog
  pauseAndMuteVideo();
  
  const confirmation = document.createElement("div");
  confirmation.id = "ft-block-channel-confirmation";
  
  confirmation.innerHTML = `
    <div class="ft-milestone-box">
      <h2>Block Channel?</h2>
      <p class="ft-milestone-intro">Removing distractions is real progress.</p>
      <p style="margin-top: 12px; font-weight: 500;">Block "${channelName}"?</p>
      <div class="ft-milestone-buttons">
        <button id="ft-block-cancel" class="ft-button ft-button-secondary">Cancel</button>
        <button id="ft-block-confirm" class="ft-button ft-button-primary">Block Channel</button>
      </div>
    </div>
  `;
  
  confirmation.querySelector("#ft-block-confirm").addEventListener("click", () => {
    console.log("[FT] ✅ User confirmed blocking:", channelName);
    confirmation.remove();
    restoreVideoState();
    onConfirm();
  });
  
  confirmation.querySelector("#ft-block-cancel").addEventListener("click", () => {
    console.log("[FT] ❌ User cancelled blocking:", channelName);
    confirmation.remove();
    restoreVideoState();
    if (onCancel) onCancel();
  });
  
  document.body.appendChild(confirmation);
  console.log("[FT] ✅ Confirmation dialog added to DOM");
}

/**
 * Show spiral detection nudge overlay
 * @param {Object} spiralInfo - Spiral detection info {channel, count, type, message}
 */
/**
 * Show overlay when user is outside their focus window
 * @param {Object} focusWindowInfo - { start, end, current }
 */
async function showFocusWindowOverlay(focusWindowInfo) {
  const { start, end } = focusWindowInfo;
  
  console.log("[FT] 🕐 Showing focus window overlay:", focusWindowInfo);
  
  // Remove any existing overlay
  const existing = document.getElementById("ft-focus-window-overlay");
  if (existing) existing.remove();
  
  // Pause video before showing overlay
  pauseAndMuteVideo();
  
  // Get nudge style
  const style = await getNudgeStyle();
  const styleMessage = getNudgeMessage(style, "focusWindow");
  
  // Convert 24h to 12h for display
  const convert24hTo12h = (time24) => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };
  
  const startDisplay = convert24hTo12h(start);
  const endDisplay = convert24hTo12h(end);
  
  const overlay = document.createElement("div");
  overlay.id = "ft-focus-window-overlay";
  
  // Hard block - no buttons, no way to skip
  overlay.innerHTML = `
    <div class="ft-milestone-box">
      <h2>🕐 You're Outside Your Focus Window</h2>
      <p class="ft-milestone-intro">
        Your YouTube window is <strong>${startDisplay} - ${endDisplay}</strong>.
      </p>
      <p class="ft-milestone-intro" style="margin-top: 12px;">
        ${styleMessage}
      </p>
    </div>
  `;
  
  // Prevent scrolling/interactions behind overlay
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";

  document.body.appendChild(overlay);
  console.log("[FT] ✅ Focus window overlay added to DOM (hard block)");
}

function removeFocusWindowOverlay() {
  const overlay = document.getElementById("ft-focus-window-overlay");
  if (overlay) {
    overlay.remove();
    // Restore scroll
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    console.log("[FT] ✅ Focus window overlay removed");
  }
}

/**
 * Start periodic focus window check during video playback
 * Checks every 30 seconds if user is outside focus window
 */
function startFocusWindowCheck() {
  if (focusWindowCheckInterval) return; // Already checking
  
  focusWindowCheckInterval = setInterval(async () => {
    const pageType = detectPageType();
    if (pageType !== "WATCH") {
      stopFocusWindowCheck();
      return;
    }
    
    // Check if focus window is enabled (Pro/Trial feature only)
    const { ft_focus_window_enabled, ft_focus_window_start, ft_focus_window_end } = 
      await chrome.storage.local.get(["ft_focus_window_enabled", "ft_focus_window_start", "ft_focus_window_end"]);
    
    const plan = await getEffectivePlan();
    if (ft_focus_window_enabled && plan === "pro") {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTime = `${currentHours.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;
      
      const startTime = ft_focus_window_start || "13:00";
      const endTime = ft_focus_window_end || "18:00";
      
      const isWithinWindow = currentTime >= startTime && currentTime <= endTime;
      
      if (!isWithinWindow) {
        // Outside window - show overlay
        const focusWindowInfo = { start: startTime, end: endTime, current: currentTime };
        showFocusWindowOverlay(focusWindowInfo);
        pauseVideos();
      } else {
        // Inside window - remove overlay if present
        removeFocusWindowOverlay();
      }
    }
  }, 30000); // Check every 30 seconds
}

/**
 * Stop periodic focus window check
 */
function stopFocusWindowCheck() {
  if (focusWindowCheckInterval) {
    clearInterval(focusWindowCheckInterval);
    focusWindowCheckInterval = null;
  }
}

async function showSpiralNudge(spiralInfo) {
  const { channel, count, type, message } = spiralInfo;
  
  console.log("[FT] 🚨 Showing spiral nudge:", spiralInfo);
  
  // Remove any existing nudge
  const existing = document.getElementById("ft-spiral-nudge");
  if (existing) existing.remove();
  
  // Pause video before showing nudge
  pauseAndMuteVideo();
  
  // Get nudge style
  const style = await getNudgeStyle();
  const styleMessage = getNudgeMessage(style, "spiral");
  
  const overlay = document.createElement("div");
  overlay.id = "ft-spiral-nudge";
  
  const timePeriod = type === "today" ? "today" : "this week";
  const timeText = spiralInfo.time_minutes ? ` (${spiralInfo.time_minutes} minutes)` : "";
  
  overlay.innerHTML = `
    <div class="ft-milestone-box">
      <h2>⚠️ ${styleMessage}</h2>
      <p class="ft-milestone-intro">
        You've watched ${count} ${count === 1 ? 'video' : 'videos'}${timeText} from ${channel} ${timePeriod}.
      </p>
      <p class="ft-milestone-intro" style="margin-top: 8px;">
        ${spiralInfo.message || "You've watched a lot of this channel this week. Are you still able to progress towards your goals?"}
      </p>
      
      <div class="ft-spiral-timer">
        <div class="ft-timer-circle">
          <span id="ft-timer-count">10</span>
        </div>
      </div>
      
      <div class="ft-milestone-buttons">
        <button id="ft-spiral-continue" class="ft-button ft-button-secondary">Continue</button>
        <button id="ft-spiral-journal" class="ft-button ft-button-outline">Journal</button>
        <button id="ft-spiral-block-today" class="ft-button ft-button-warning">Block YouTube for Today</button>
        <button id="ft-spiral-block-permanent" class="ft-button ft-button-danger">Block Channel Permanently</button>
      </div>
    </div>
  `;
  
  // 10-second countdown timer
  let timeLeft = 10;
  const timerEl = overlay.querySelector("#ft-timer-count");
  let timerInterval = setInterval(() => {
    timeLeft--;
    if (timerEl) {
      timerEl.textContent = timeLeft;
    }
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      // Auto-dismiss after 10 seconds (same as "Continue")
      overlay.remove();
      restoreVideoState();
      chrome.runtime.sendMessage({
        type: "FT_CLEAR_SPIRAL_FLAG"
      }).catch((err) => {
        console.warn("[FT] Failed to clear spiral flag:", err);
      });
    }
  }, 1000);
  
  // Button handlers
  const continueBtn = overlay.querySelector("#ft-spiral-continue");
  const journalBtn = overlay.querySelector("#ft-spiral-journal");
  const blockTodayBtn = overlay.querySelector("#ft-spiral-block-today");
  const blockPermanentBtn = overlay.querySelector("#ft-spiral-block-permanent");
  
  if (journalBtn) {
    journalBtn.addEventListener("click", async () => {
      // Get videos from last 7 days for this channel
      const { ft_watch_history = [] } = await chrome.storage.local.get(["ft_watch_history"]);
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const channelVideos = ft_watch_history
        .filter(item => {
          const itemTime = new Date(item.watched_at).getTime();
          return itemTime > sevenDaysAgo && 
                 item.channel_name && 
                 item.channel_name.toLowerCase().trim() === channel.toLowerCase().trim();
        })
        .map(item => ({
          video_id: item.video_id || null,
          video_title: item.video_title || null,
          watched_at: item.watched_at || null
        }));
      
      // Open journal modal with spiral context
      showJournalModal("channel based", {
        channel: channel,
        source: "spiral_nudge",
        videos: channelVideos,
        spiralInfo: spiralInfo
      });
    });
  }
  
  if (continueBtn) {
    continueBtn.addEventListener("click", async () => {
      clearInterval(timerInterval);
      overlay.remove();
      restoreVideoState();
      
      // Save dismissal cooldown (7 days)
      const { ft_spiral_dismissed_channels = {} } = await chrome.storage.local.get(["ft_spiral_dismissed_channels"]);
      ft_spiral_dismissed_channels[channel] = {
        last_shown: Date.now()
      };
      await chrome.storage.local.set({ ft_spiral_dismissed_channels });
      console.log("[FT] 🚨 SPIRAL DISMISSED:", { channel, cooldownDays: 7 });
      
      chrome.runtime.sendMessage({
        type: "FT_CLEAR_SPIRAL_FLAG"
      }).catch((err) => {
        console.warn("[FT] Failed to clear spiral flag:", err);
      });
    });
  }
  
  if (blockTodayBtn) {
    blockTodayBtn.addEventListener("click", () => {
      clearInterval(timerInterval);
      overlay.remove();
      restoreVideoState();
      chrome.runtime.sendMessage({
        type: "FT_BLOCK_CHANNEL_TODAY",
        channel: channel
      }).then(() => {
        console.log("[FT] Channel blocked for today:", channel);
        // Redirect to home after blocking
        window.location.href = "https://www.youtube.com/";
      }).catch((err) => {
        console.warn("[FT] Failed to block channel for today:", err);
      });
    });
  }
  
  if (blockPermanentBtn) {
    blockPermanentBtn.addEventListener("click", () => {
      clearInterval(timerInterval);
      overlay.remove();
      restoreVideoState();
      chrome.runtime.sendMessage({
        type: "FT_BLOCK_CHANNEL_PERMANENT",
        channel: channel
      }).then(() => {
        console.log("[FT] Channel blocked permanently:", channel);
        // Redirect to home after blocking
        window.location.href = "https://www.youtube.com/";
      }).catch((err) => {
        console.warn("[FT] Failed to block channel permanently:", err);
      });
    });
  }
  
  document.body.appendChild(overlay);
  console.log("[FT] ✅ Spiral nudge added to DOM");
}

// Button injection observer (watches for channel element to appear)
let buttonInjectionObserver = null;
let pendingButtonChannel = null;

/**
 * Waits for a channel name to appear in the DOM (polling helper)
 * @param {number} timeoutMs - Maximum time to wait
 * @param {number} pollInterval - How often to poll (ms)
 * @returns {Promise<string|null>}
 */
function waitForChannelName(timeoutMs = 5000, pollInterval = 100) {
  console.log("[FT content] Waiting for channel name...", { timeoutMs, pollInterval });
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const poll = () => {
      const channel = extractChannelFast();
      if (channel) {
        console.log("[FT content] Channel detected while waiting:", channel);
        resolve(channel);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        reject(new Error("Channel name not found within timeout"));
        return;
      }
      setTimeout(poll, pollInterval);
    };
    poll();
  });
}

/**
 * Ensures the block button logic runs once the DOM is ready.
 * Called on initial script load.
 */
function initBlockingButtonBootstrap() {
  console.log("[FT content] Block button bootstrap init. readyState =", document.readyState);
  const start = () => {
    console.log("[FT content] DOM ready → ensuring initial block button");
    ensureInitialBlockButton().catch((err) => {
      console.warn("[FT content] Error ensuring initial block button:", err);
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        console.log("[FT content] DOMContentLoaded fired");
        start();
      },
      { once: true }
    );
  } else {
    start();
  }
}

/**
 * Attempts to set up the block button on the current page (if watch page)
 * Only shows for Pro users (includes active Trial)
 */
async function ensureInitialBlockButton() {
  // Only show block channel button for Pro users (includes active Trial)
  const plan = await getEffectivePlan();
  if (plan !== "pro") {
    console.log("[FT content] Block channel button hidden (Free plan or expired Trial)");
    return;
  }
  
  const pageType = detectPageType();
  console.log("[FT content] ensureInitialBlockButton pageType:", pageType);
  if (pageType !== "WATCH") {
    console.log("[FT content] Not on WATCH page during bootstrap, skipping button ensure");
    return;
  }

  const videoId = extractVideoIdFromUrl();
  if (!videoId) {
    console.log("[FT content] No video ID detected yet, will rely on SPA observer");
    return;
  }

  let channel = extractChannelFast();
  if (channel) {
    console.log("[FT content] Bootstrap channel detected:", channel);
    setupButtonInjectionObserver(channel);
  } else {
    console.log("[FT content] Channel not ready on bootstrap, waiting...");
    waitForChannelName()
      .then((name) => {
        setupButtonInjectionObserver(name);
      })
      .catch((err) => {
        console.warn("[FT content] Bootstrap channel wait timed out:", err.message);
        // Still set up observer without a name; it will retry when channel appears
        setupButtonInjectionObserver(null);
      });
  }
}

/**
 * Checks if channel is blocked, then either redirects or injects button
 * @param {string} channelName - Name of channel
 * @param {Element} channelElement - Not used anymore (kept for compatibility)
 */
async function checkBlockingAndInjectButton(channelName, channelElement) {
  try {
    // Check if user can record data (Pro or active Trial only)
    // Free users and expired trial users should not have channels blocked
    const { ft_blocked_channels = [], ft_can_record } = await chrome.storage.local.get(["ft_blocked_channels", "ft_can_record"]);
    
    // Only check blocked channels if user can record (Pro/active Trial)
    if (ft_can_record) {
      const blockedChannels = Array.isArray(ft_blocked_channels) ? ft_blocked_channels : [];
      
      if (blockedChannels.length > 0) {
        const channelLower = channelName.toLowerCase().trim();
        const isBlocked = blockedChannels.some(blocked => {
          const blockedLower = blocked.toLowerCase().trim();
          return blockedLower === channelLower; // Exact match only
        });
        
        if (isBlocked) {
          console.log("[FT] 🚫 Channel blocked (button injection check):", channelName);
          pauseAndMuteVideo(); // Immediate pause
          showChannelBlockedOverlay(channelName); // Show overlay instead of immediate redirect
          return; // Don't inject button
        }
      }
    } else {
      // Free/expired trial - blocked channels are ignored (preserved but not enforced)
      console.log("[FT] Channel blocking disabled (plan inactive) - channels preserved but not enforced");
    }
    
    // Not blocked, inject button (only for Pro users)
    const plan = await getEffectivePlan();
    if (plan === "pro") {
      await injectBlockChannelButton(channelName);
    } else {
      console.log("[FT] Block channel button hidden (Free plan)");
    }
  } catch (e) {
    console.warn("[FT] Error checking blocking for button injection:", e);
  }
}

/**
 * Sets up MutationObserver to watch for channel element, then injects button or redirects
 * @param {string} channelName - Name of channel
 */
function setupButtonInjectionObserver(channelName = null) {
  // Clear any existing observer
  if (buttonInjectionObserver) {
    buttonInjectionObserver.disconnect();
    buttonInjectionObserver = null;
  }
  
  // Remove existing button if it exists (will be re-injected with new channel)
  const existingBtn = document.getElementById("ft-block-channel-btn");
  if (existingBtn) {
    existingBtn.remove();
  }
  
  pendingButtonChannel = channelName;
  console.log("[FT] Setting up button injection observer for:", channelName || "(pending detection)");
  
  const channelSelectors = [
    "ytd-channel-name a",
    "#owner-sub-count a",
    "ytd-video-owner-renderer #channel-name a",
    "ytd-watch-metadata ytd-channel-name a",
    "ytd-watch-metadata #channel-name a",
    "#channel-name a"
  ];
  
  // Helper function to try injecting button
  // With fixed positioning, we don't need to wait for container - just inject when ready
  const tryInjectButton = () => {
    // For fixed position, we can inject immediately - just verify we're on a watch page
    // by checking if we have a video ID
    const videoId = extractVideoIdFromUrl();
    const channelToUse = pendingButtonChannel || extractChannelFast();
    if (videoId) {
      if (!channelToUse) {
        console.log("[FT] Watch page detected but channel missing, waiting...");
        return false;
      }
      // On watch page, check blocking and inject
      console.log("[FT] Watch page detected, checking blocking and injecting button for:", channelToUse);
      checkBlockingAndInjectButton(channelToUse, null);
      return true; // Successfully injected
    }
    
    return false; // Not on watch page yet
  };
  
  // Set up observer to watch for channel element (catches mutations)
  buttonInjectionObserver = new MutationObserver(() => {
    if (tryInjectButton()) {
      // Button injected, clean up
      buttonInjectionObserver.disconnect();
      buttonInjectionObserver = null;
      pendingButtonChannel = null;
    }
  });
  
  // Watch for changes
  buttonInjectionObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Periodic fallback check (every 500ms for 5 seconds = 10 attempts)
  // This catches the element even if observer misses it
  let fallbackAttempts = 0;
  const maxFallbackAttempts = 10; // 5 seconds total
  
  const fallbackInterval = setInterval(() => {
    fallbackAttempts++;
    
    if (tryInjectButton()) {
      // Button injected, clean up
      clearInterval(fallbackInterval);
      if (buttonInjectionObserver) {
        buttonInjectionObserver.disconnect();
        buttonInjectionObserver = null;
      }
      pendingButtonChannel = null;
    } else if (fallbackAttempts >= maxFallbackAttempts) {
      // Timeout reached
      console.warn("[FT] Button injection timeout after 5 seconds");
      clearInterval(fallbackInterval);
      if (buttonInjectionObserver) {
        buttonInjectionObserver.disconnect();
        buttonInjectionObserver = null;
      }
      pendingButtonChannel = null;
    }
  }, 500);
  
  // Cleanup timeout (safety net)
  setTimeout(() => {
    clearInterval(fallbackInterval);
    if (buttonInjectionObserver) {
      buttonInjectionObserver.disconnect();
      buttonInjectionObserver = null;
    }
    pendingButtonChannel = null;
  }, 5500); // Slightly longer than fallback
}

/**
 * Injects "Block Channel" button on watch pages
 * @param {string} channelName - Name of channel to block
 * @param {number} retryCount - Current retry attempt (internal)
 */
async function injectBlockChannelButton(channelName, retryCount = 0) {
  // Always remove existing button first (to update channel name on navigation)
  const existingBtn = document.getElementById("ft-block-channel-btn");
  if (existingBtn) {
    existingBtn.remove();
    console.log("[FT] Removed existing button, injecting new one for:", channelName);
  }
  
  // With fixed positioning, we don't need to find channel element
  // Just verify we're on a watch page
  const videoId = extractVideoIdFromUrl();
  if (!videoId) {
    console.warn("[FT] Not on watch page, skipping button injection");
    return;
  }
  
  console.log("[FT] ✅ Injecting Block Channel button for:", channelName);
  
  // Create button with fixed positioning (doesn't depend on container dimensions)
  const button = document.createElement("button");
  button.id = "ft-block-channel-btn";
  button.className = "ft-block-channel-btn";
  button.textContent = "Block Channel";
  button.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 9999;
    padding: 8px 16px;
    background-color: #ff4444;
    color: white;
    border: none;
    border-radius: 18px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: background-color 0.2s;
  `;
  
  button.addEventListener("mouseenter", () => {
    button.style.backgroundColor = "#cc0000";
  });
  
  button.addEventListener("mouseleave", () => {
    button.style.backgroundColor = "#ff4444";
  });
  
  button.addEventListener("click", async (e) => {
    console.log("[FT] 🔴 Block Channel button clicked for:", channelName);
    e.preventDefault();
    e.stopPropagation();
    
    // Show confirmation dialog
    showBlockChannelConfirmation(
      channelName,
      async () => {
        // On confirm: block channel
        console.log("[FT] 🔵 Starting channel blocking process for:", channelName);
        try {
          const { ft_blocked_channels = [], ft_user_email } = await chrome.storage.local.get([
            "ft_blocked_channels",
            "ft_user_email"
          ]);
          
          console.log("[FT] Current blocked channels:", ft_blocked_channels);
          console.log("[FT] User email:", ft_user_email ? "present" : "missing");
          
          // Add channel if not already in list
          const channelLower = channelName.toLowerCase().trim();
          const isAlreadyBlocked = Array.isArray(ft_blocked_channels) && 
            ft_blocked_channels.some(b => b.toLowerCase().trim() === channelLower);
          
          if (!isAlreadyBlocked) {
            const updatedBlocked = [...(ft_blocked_channels || []), channelName.trim()];
            
            console.log("[FT] Adding channel to blocklist:", channelName);
            console.log("[FT] Updated blocklist:", updatedBlocked);
            
            // Save to server via background worker (correct format)
            try {
              const response = await chrome.runtime.sendMessage({
                type: "FT_BLOCK_CHANNEL_PERMANENT",
                channel: channelName
              });
              
              if (response?.ok) {
                console.log("[FT] ✅ Blocked channel saved to server:", channelName);
              } else {
                console.warn("[FT] ⚠️ Server save failed:", response?.error);
              }
            } catch (err) {
              console.warn("[FT] ⚠️ Failed to save blocked channel to server:", err);
            }
            
            // Show success notification
            console.log(`[FT] ✅ Channel blocked: ${channelName}`);
            
            // Remove button and redirect immediately (no reload needed)
            button.remove();
            console.log("[FT] Redirecting to YouTube home...");
            
            // Small delay to ensure storage is saved, then redirect
            await new Promise(resolve => setTimeout(resolve, 100));
            window.location.href = "https://www.youtube.com/";
          } else {
            console.log("[FT] Channel already blocked, skipping");
          }
        } catch (error) {
          console.error("[FT] ❌ Error blocking channel:", error);
        }
      },
      () => {
        // On cancel: do nothing
        console.log("[FT] ❌ Block channel cancelled");
      }
    );
  });
  
  // Append to body (fixed position, doesn't depend on container)
  document.body.appendChild(button);
  console.log("[FT] ✅ Block Channel button injected successfully (fixed position)");
}

/**
 * Shows journal nudge popup (1 minute into distracting content)
 * Temporary, dismissible popup asking "What pulled you off track?"
 * @param {Object} videoMetadata - Video metadata (title, channel, url, etc.)
 */
async function showJournalNudge(videoMetadata) {
  // Remove any existing journal nudge
  const existingNudge = document.getElementById("ft-journal-nudge");
  if (existingNudge) existingNudge.remove();
  
  // Mark as shown to prevent duplicates
  journalNudgeShown = true;
  
  // Get nudge style
  const style = await getNudgeStyle();
  const styleMessage = getNudgeMessage(style, "journal");
  
  // Create nudge popup
  const nudge = document.createElement("div");
  nudge.id = "ft-journal-nudge";
  nudge.className = "ft-journal-nudge";
  
  const videoTitle = videoMetadata?.title || "this video";
  const videoChannel = videoMetadata?.channel || "";
  const videoUrl = videoMetadata?.url || location.href;
  
  nudge.innerHTML = `
    <div class="ft-journal-nudge-box">
      <button class="ft-journal-nudge-close" id="ft-journal-nudge-close" aria-label="Close">×</button>
      <h3>What pulled you off track?</h3>
      <p class="ft-journal-nudge-subtitle">You've been watching ${videoTitle}${videoChannel ? ` from ${videoChannel}` : ''} for a minute.</p>
      <textarea 
        id="ft-journal-nudge-input" 
        class="ft-journal-nudge-input" 
        placeholder="${styleMessage}"
        rows="3"
      ></textarea>
      <div class="ft-journal-nudge-buttons">
        <button id="ft-journal-nudge-save" class="ft-journal-nudge-btn ft-journal-nudge-btn-primary">Save</button>
        <button id="ft-journal-nudge-dismiss" class="ft-journal-nudge-btn ft-journal-nudge-btn-secondary">Dismiss</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(nudge);
  
  // Close button handler
  const closeBtn = nudge.querySelector("#ft-journal-nudge-close");
  const dismissBtn = nudge.querySelector("#ft-journal-nudge-dismiss");
  const saveBtn = nudge.querySelector("#ft-journal-nudge-save");
  const input = nudge.querySelector("#ft-journal-nudge-input");
  
  const removeNudge = () => {
    if (nudge.parentNode) {
      nudge.parentNode.removeChild(nudge);
    }
  };
  
  closeBtn.addEventListener("click", removeNudge);
  dismissBtn.addEventListener("click", removeNudge);
  
  // Save button handler
  saveBtn.addEventListener("click", async () => {
    const note = input.value.trim();
    
    if (!note) {
      // If empty, just dismiss
      removeNudge();
      return;
    }
    
    // Disable button while saving
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    
    try {
      // Send to background to save to server
      const response = await chrome.runtime.sendMessage({
        type: "FT_SAVE_JOURNAL",
        note: note,
        context: {
          url: videoUrl,
          title: videoTitle,
          channel: videoChannel,
          source: "watch"
        }
      });
      
      if (response?.ok) {
        saveBtn.textContent = "Saved!";
        setTimeout(removeNudge, 1000); // Auto-dismiss after 1 second
      } else {
        throw new Error(response?.error || "Failed to save");
      }
    } catch (err) {
      console.error("[FT] Error saving journal entry:", err);
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
      alert("Failed to save note. Please try again.");
    }
  });
  
  // Auto-dismiss after 30 seconds (optional)
  setTimeout(() => {
    if (nudge.parentNode) {
      removeNudge();
    }
  }, 30 * 1000);
  
  // Focus textarea
  setTimeout(() => {
    input.focus();
  }, 100);
}

/* COMMENTED OUT: AI distracting popup - to be replaced with nudge/hide/remove per user request
 * Shows AI distracting content popup
 * Shows when content is classified as distracting and user has allowance
 */
/*
async function showAIDistractingPopup(classification, allowance) {
  // Remove any existing popup
  const existingPopup = document.getElementById("ft-ai-distracting-popup");
  if (existingPopup) existingPopup.remove();
  
  // Pause and mute video before showing popup
  pauseAndMuteVideo();
  
  // Format allowance display
  const allowanceVideosLeft = allowance.allowanceVideosLeft || 0;
  const allowanceSecondsLeft = allowance.allowanceSecondsLeft || 0;
  let allowanceText = "";
  if (allowanceVideosLeft > 0) {
    allowanceText = `${allowanceVideosLeft} video${allowanceVideosLeft !== 1 ? 's' : ''} left`;
  } else if (allowanceSecondsLeft > 0) {
    const minutesLeft = Math.floor(allowanceSecondsLeft / 60);
    const secondsLeft = allowanceSecondsLeft % 60;
    if (minutesLeft > 0) {
      allowanceText = `${minutesLeft}m ${secondsLeft}s left`;
    } else {
      allowanceText = `${secondsLeft}s left`;
    }
  }
  
  // Get allowance cost from classification
  const allowanceCost = classification.allowance_cost || { type: "none", amount: 0 };
  let costText = "";
  if (allowanceCost.type === "video") {
    costText = `This will use ${allowanceCost.amount} of your daily video allowance`;
  } else if (allowanceCost.type === "minutes") {
    costText = `This will use ${allowanceCost.amount} minutes of your daily time allowance`;
  }
  
  // Create popup
  const popup = document.createElement("div");
  popup.id = "ft-ai-distracting-popup";
  
  popup.innerHTML = `
    <div class="ft-milestone-box">
      <h2>⚠️ This content is not aligned with your goals</h2>
      <p class="ft-milestone-intro">${classification.reason || "This content may distract you from your goals"}</p>
      ${costText ? `<p style="color: #ffcc66; margin: 12px 0; font-size: 14px;">${costText}</p>` : ''}
      ${allowanceText ? `<p style="color: #ccc; margin: 8px 0; font-size: 13px;">Remaining allowance: ${allowanceText}</p>` : ''}
      <div class="ft-milestone-buttons">
        <button id="ft-ai-go-back" class="ft-button ft-button-secondary">Go Back</button>
        <button id="ft-ai-continue" class="ft-button ft-button-primary">Continue</button>
      </div>
    </div>
  `;
  
  // Go Back button - navigate away
  popup.querySelector("#ft-ai-go-back").addEventListener("click", () => {
    popup.remove();
    restoreVideoState();
    // Navigate to YouTube home
    window.location.href = "https://www.youtube.com/";
  });
  
  // Continue button - dismiss and restore video state
  popup.querySelector("#ft-ai-continue").addEventListener("click", () => {
    popup.remove();
    restoreVideoState(); // Restore original muted state (but don't auto-play)
  });
  
  document.body.appendChild(popup);
}
*/

/**
 * Starts tracking time spent on Shorts (Pro plan only)
 */
async function startShortsTimeTracking() {
  if (shortsTimeTracker) return; // Already tracking

  if (!isChromeContextValid()) return;

  // Get current time at start
  let baseSeconds = 0;
  try {
    const { ft_shorts_seconds_today } = await chrome.storage.local.get(["ft_shorts_seconds_today"]);
    if (chrome.runtime.lastError) {
      console.warn("[FT] Failed to get initial time:", chrome.runtime.lastError.message);
      baseSeconds = 0;
    } else {
      baseSeconds = Number(ft_shorts_seconds_today || 0);
    }
  } catch (e) {
    console.warn("[FT] Error getting initial time:", e.message);
    baseSeconds = 0;
  }
  
  shortsTimeStart = Date.now();
  let lastSaveTime = Date.now();

  // Update every second
  shortsTimeTracker = setInterval(async () => {
    // Check if Chrome context is still valid
    if (!isChromeContextValid()) {
      clearInterval(shortsTimeTracker);
      shortsTimeTracker = null;
      shortsTimeStart = null;
      return;
    }
    
    if (!shortsTimeStart) return;

    const elapsed = Math.floor((Date.now() - shortsTimeStart) / 1000);
    const timeSinceLastSave = Math.floor((Date.now() - lastSaveTime) / 1000);
    
    // Re-read storage every 5 seconds to get latest saved value (in case another tab saved)
    if (timeSinceLastSave >= 5) {
      try {
        const { ft_shorts_seconds_today: latestSeconds } = await chrome.storage.local.get(["ft_shorts_seconds_today"]);
        if (chrome.runtime.lastError) {
          // Context invalidated or error - stop interval
          if (!isChromeContextValid()) {
            clearInterval(shortsTimeTracker);
            shortsTimeTracker = null;
            shortsTimeStart = null;
            return;
          }
          console.warn("[FT] Failed to get latest time:", chrome.runtime.lastError.message);
          // Continue with current baseSeconds
        } else {
          const latestBase = Number(latestSeconds || 0);
          
          // If another tab saved more time, adjust our base and reset start time
          if (latestBase > baseSeconds) {
            baseSeconds = latestBase;
            shortsTimeStart = Date.now(); // Reset to continue from new base
            lastSaveTime = Date.now();
          } else {
            // Update our saved value
            baseSeconds = baseSeconds + elapsed;
            try {
              await chrome.storage.local.set({ ft_shorts_seconds_today: baseSeconds });
              if (chrome.runtime.lastError) {
                if (!isChromeContextValid()) {
                  clearInterval(shortsTimeTracker);
                  shortsTimeTracker = null;
                  shortsTimeStart = null;
                  return;
                }
                console.warn("[FT] Failed to save time:", chrome.runtime.lastError.message);
              }
            } catch (e) {
              if (!isChromeContextValid()) {
                clearInterval(shortsTimeTracker);
                shortsTimeTracker = null;
                shortsTimeStart = null;
                return;
              }
              console.warn("[FT] Error saving time:", e.message);
            }
            shortsTimeStart = Date.now(); // Reset elapsed time counter
            lastSaveTime = Date.now();
          }
        }
      } catch (e) {
        // Context invalidated - stop interval
        if (!isChromeContextValid()) {
          clearInterval(shortsTimeTracker);
          shortsTimeTracker = null;
          shortsTimeStart = null;
          return;
        }
        console.warn("[FT] Error in time tracking:", e.message);
      }
    }

    // Calculate current total (base + elapsed since last adjustment)
    const elapsedSinceReset = Math.floor((Date.now() - shortsTimeStart) / 1000);
    const newTotal = baseSeconds + elapsedSinceReset;
    
    // Check for time-based milestones (2min, 5min, 10min, 15min, 20min)
    await checkAndShowTimeMilestone(newTotal);
    
    // Update badge display every second with real-time values
    try {
      const { ft_shorts_engaged_today, ft_short_visits_today } = await chrome.storage.local.get([
        "ft_shorts_engaged_today",
        "ft_short_visits_today"
      ]);
      if (chrome.runtime.lastError) {
        if (!isChromeContextValid()) {
          clearInterval(shortsTimeTracker);
          shortsTimeTracker = null;
          shortsTimeStart = null;
          return;
        }
        console.warn("[FT] Failed to get badge counters:", chrome.runtime.lastError.message);
        // Use defaults
        await updateShortsBadge(0, 0, newTotal);
      } else {
        const engaged = Number(ft_shorts_engaged_today || 0);
        const scrolled = Number(ft_short_visits_today || 0);
        await updateShortsBadge(engaged, scrolled, newTotal);
      }
    } catch (e) {
      if (!isChromeContextValid()) {
        clearInterval(shortsTimeTracker);
        shortsTimeTracker = null;
        shortsTimeStart = null;
        return;
      }
      console.warn("[FT] Error updating badge:", e.message);
      // Use defaults on error
      await updateShortsBadge(0, 0, newTotal);
    }
  }, 1000);
}

/**
 * Saves accumulated time to storage (used internally and on unload)
 */
async function saveAccumulatedShortsTime() {
  if (!shortsTimeStart) return 0;
  
  if (!isChromeContextValid()) {
    shortsTimeStart = null;
    return 0;
  }

  const elapsed = Math.floor((Date.now() - shortsTimeStart) / 1000);
  if (elapsed > 0) {
    try {
      const { ft_shorts_seconds_today } = await chrome.storage.local.get(["ft_shorts_seconds_today"]);
      if (chrome.runtime.lastError) {
        console.warn("[FT] Failed to get time for save:", chrome.runtime.lastError.message);
        return 0;
      }
      const currentSeconds = Number(ft_shorts_seconds_today || 0);
      const newTotal = currentSeconds + elapsed;
      await chrome.storage.local.set({ ft_shorts_seconds_today: newTotal });
      if (chrome.runtime.lastError) {
        console.warn("[FT] Failed to save accumulated time:", chrome.runtime.lastError.message);
        return currentSeconds; // Return old value if save failed
      }
      return newTotal;
    } catch (e) {
      console.warn("[FT] Error saving accumulated time:", e.message);
      return 0;
    }
  }
  return 0;
}

/**
 * Stops tracking time and saves final value
 */
async function stopShortsTimeTracking() {
  if (!shortsTimeTracker || !shortsTimeStart) return;

  clearInterval(shortsTimeTracker);
  shortsTimeTracker = null;

  // Save accumulated time
  await saveAccumulatedShortsTime();
  
  shortsTimeStart = null;
}

// ─────────────────────────────────────────────────────────────
// GLOBAL TIME TRACKING (all YouTube pages)
// ─────────────────────────────────────────────────────────────

/**
 * Starts tracking time spent on ANY YouTube page
 * Similar to Shorts tracking, but applies to all pages
 */
async function startGlobalTimeTracking() {
  if (globalTimeTracker) return; // Already tracking

  if (!isChromeContextValid()) return;

  // Get current time at start and verify we're on the right day
  try {
    const { 
      ft_watch_seconds_today,
      ft_last_reset_key 
    } = await chrome.storage.local.get([
      "ft_watch_seconds_today",
      "ft_last_reset_key"
    ]);
    if (chrome.runtime.lastError) {
      console.warn("[FT] Failed to get initial global time:", chrome.runtime.lastError.message);
      globalBaseSeconds = 0;
    } else {
      // Verify we're on the current day (reset key should match today)
      const todayKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const storedSeconds = Number(ft_watch_seconds_today || 0);
      
      // If reset key doesn't match today, we're on a new day - start from 0
      if (ft_last_reset_key && ft_last_reset_key !== todayKey) {
        console.log("[FT] Reset key mismatch - new day detected, starting from 0");
        globalBaseSeconds = 0;
      } else {
        globalBaseSeconds = storedSeconds;
      }
    }
  } catch (e) {
    console.warn("[FT] Error getting initial global time:", e.message);
    globalBaseSeconds = 0;
  }
  
  globalTimeStart = Date.now();
  lastGlobalSaveTime = Date.now();

  // Update every second
  globalTimeTracker = setInterval(async () => {
    // Check if Chrome context is still valid
    if (!isChromeContextValid()) {
      clearInterval(globalTimeTracker);
      globalTimeTracker = null;
      globalTimeStart = null;
      lastGlobalSaveTime = null;
      return;
    }
    
    if (!globalTimeStart) return;

    const elapsed = Math.floor((Date.now() - globalTimeStart) / 1000);
    const timeSinceLastSave = Math.floor((Date.now() - lastGlobalSaveTime) / 1000);
    
    // Calculate current total watch time
    const currentTotalSeconds = globalBaseSeconds + elapsed;
    
    // Check global time limit every second
    try {
      // Get effective plan (handles trial expiry)
      const plan = await getEffectivePlan();
      if (chrome.runtime.lastError) {
        if (!isChromeContextValid()) {
          clearInterval(globalTimeTracker);
          globalTimeTracker = null;
          globalTimeStart = null;
          lastGlobalSaveTime = null;
          return;
        }
        console.warn("[FT] Failed to get plan for limit check:", chrome.runtime.lastError.message);
      } else {
        // Get effective settings (plan-aware, handles legacy fields)
        const { ft_extension_settings = {} } = await chrome.storage.local.get(["ft_extension_settings"]);
        const effectiveSettings = computeEffectiveSettings(plan, ft_extension_settings);
        const dailyLimitMin = effectiveSettings.daily_limit_minutes;
        const limitSeconds = dailyLimitMin * 60;
        
        // Check if limit reached
        if (currentTotalSeconds >= limitSeconds) {
          // Check if overlay already exists (don't show duplicate)
          if (!document.getElementById("ft-overlay")) {
            // Get counters from storage
            const { 
              ft_shorts_engaged_today, 
              ft_searches_today,
              ft_watch_visits_today
            } = await chrome.storage.local.get([
              "ft_shorts_engaged_today",
              "ft_searches_today",
              "ft_watch_visits_today"
            ]);
            
            if (chrome.runtime.lastError && !isChromeContextValid()) {
              clearInterval(globalTimeTracker);
              globalTimeTracker = null;
              globalTimeStart = null;
              lastGlobalSaveTime = null;
              return;
            }
            
            const counters = {
              watchSeconds: currentTotalSeconds,
              watchVisits: Number(ft_watch_visits_today || 0),
              shortsEngaged: Number(ft_shorts_engaged_today || 0),
              searches: Number(ft_searches_today || 0)
            };
            
            // Pause videos
            pauseVideos();
            
            // Show global limit overlay
            await showGlobalLimitOverlay(plan, counters);
            
            // Stop time tracking when overlay is shown (optional - or keep tracking)
            // For now, we'll keep tracking but overlay will block interaction
          }
        }
      }
    } catch (e) {
      if (!isChromeContextValid()) {
        clearInterval(globalTimeTracker);
        globalTimeTracker = null;
        globalTimeStart = null;
        lastGlobalSaveTime = null;
        return;
      }
      console.warn("[FT] Error checking global limit:", e.message);
    }
    
    // Re-read storage every 5 seconds to get latest saved value (in case another tab saved or reset happened)
    if (timeSinceLastSave >= 5) {
      try {
        const { 
          ft_watch_seconds_today: latestSeconds,
          ft_last_reset_key: latestResetKey 
        } = await chrome.storage.local.get([
          "ft_watch_seconds_today",
          "ft_last_reset_key"
        ]);
        if (chrome.runtime.lastError) {
          // Context invalidated or error - stop interval
          if (!isChromeContextValid()) {
            clearInterval(globalTimeTracker);
            globalTimeTracker = null;
            globalTimeStart = null;
            lastGlobalSaveTime = null;
            return;
          }
          console.warn("[FT] Failed to get latest global time:", chrome.runtime.lastError.message);
          // Continue with current baseSeconds
        } else {
          const latestBase = Number(latestSeconds || 0);
          
          // Check if reset happened (stored value is much lower, or reset key changed)
          // Reset key format: YYYY-MM-DD for daily
          const todayKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
          // Reset happened if reset key exists and doesn't match today
          const resetHappened = latestResetKey && latestResetKey !== todayKey;
          
          // If reset happened OR stored value is significantly lower (more than 10 seconds difference)
          // This handles the case where reset happened at midnight
          if (resetHappened || (latestBase < globalBaseSeconds - 10 && latestBase < 60)) {
            // Reset detected - start fresh from the new value
            console.log("[FT] Daily reset detected, resetting global time tracker");
            globalBaseSeconds = latestBase;
            globalTimeStart = Date.now(); // Reset to continue from new base
            lastGlobalSaveTime = Date.now();
          } else if (latestBase > globalBaseSeconds) {
          // If another tab saved more time, adjust our base and reset start time
            globalBaseSeconds = latestBase;
            globalTimeStart = Date.now(); // Reset to continue from new base
            lastGlobalSaveTime = Date.now();
          } else {
            // Update our saved value
            globalBaseSeconds = globalBaseSeconds + elapsed;
            try {
              await chrome.storage.local.set({ ft_watch_seconds_today: globalBaseSeconds });
              if (chrome.runtime.lastError) {
                if (!isChromeContextValid()) {
                  clearInterval(globalTimeTracker);
                  globalTimeTracker = null;
                  globalTimeStart = null;
                  lastGlobalSaveTime = null;
                  return;
                }
                console.warn("[FT] Failed to save global time:", chrome.runtime.lastError.message);
              }
            } catch (e) {
              if (!isChromeContextValid()) {
                clearInterval(globalTimeTracker);
                globalTimeTracker = null;
                globalTimeStart = null;
                lastGlobalSaveTime = null;
                return;
              }
              console.warn("[FT] Error saving global time:", e.message);
            }
            globalTimeStart = Date.now(); // Reset elapsed time counter
            lastGlobalSaveTime = Date.now();
          }
        }
      } catch (e) {
        // Context invalidated - stop interval
        if (!isChromeContextValid()) {
          clearInterval(globalTimeTracker);
          globalTimeTracker = null;
          globalTimeStart = null;
          lastGlobalSaveTime = null;
          return;
        }
        console.warn("[FT] Error in global time tracking:", e.message);
      }
    }
  }, 1000);
}

/**
 * Saves accumulated global time to storage (used internally and on unload)
 */
async function saveAccumulatedGlobalTime() {
  if (!globalTimeStart) return 0;
  
  if (!isChromeContextValid()) {
    globalTimeStart = null;
    lastGlobalSaveTime = null;
    return 0;
  }

  const elapsed = Math.floor((Date.now() - globalTimeStart) / 1000);
  if (elapsed > 0) {
    try {
      // Get current watch time and settings
      const { 
        ft_watch_seconds_today,
        ft_extension_settings = {}
      } = await chrome.storage.local.get([
        "ft_watch_seconds_today",
        "ft_extension_settings"
      ]);
      
      if (chrome.runtime.lastError) {
        console.warn("[FT] Failed to get global time for save:", chrome.runtime.lastError.message);
        return 0;
      }
      
      const currentSeconds = Number(ft_watch_seconds_today || 0);
      
      // Get effective plan (handles trial expiry)
      const plan = await getEffectivePlan();
      const effectiveSettings = computeEffectiveSettings(plan, ft_extension_settings);
      const dailyLimitMin = effectiveSettings.daily_limit_minutes || (plan === "free" ? 60 : 90);
      const limitSeconds = dailyLimitMin * 60;
      
      // If already over limit, preserve historical time (don't reduce, don't add)
      // This handles case where user reduced limit mid-day but already exceeded new limit
      if (currentSeconds >= limitSeconds) {
        // Don't add more time if already over limit (preserves historical accuracy)
        // Reset start time to prevent further accumulation
        globalTimeStart = Date.now();
        lastGlobalSaveTime = Date.now();
        return currentSeconds; // Return existing value (preserves 70 if limit reduced to 60)
      }
      
      // If under limit, add elapsed time but cap at limit to prevent ballooning
      const newTotal = currentSeconds + elapsed;
      const cappedTotal = Math.min(newTotal, limitSeconds);
      
      await chrome.storage.local.set({ ft_watch_seconds_today: cappedTotal });
      if (chrome.runtime.lastError) {
        console.warn("[FT] Failed to save accumulated global time:", chrome.runtime.lastError.message);
        return currentSeconds; // Return old value if save failed
      }
      
      // Reset start time after successful save
      globalTimeStart = Date.now();
      lastGlobalSaveTime = Date.now();
      
      // Log if we capped the value (for debugging)
      if (cappedTotal < newTotal) {
        console.log(`[FT] Watch time capped at daily limit: ${cappedTotal}s (would have been ${newTotal}s)`);
      }
      
      return cappedTotal;
    } catch (e) {
      console.warn("[FT] Error saving accumulated global time:", e.message);
      return 0;
    }
  }
  return 0;
}

/**
 * Stops tracking global time and saves final value
 */
async function stopGlobalTimeTracking() {
  if (!globalTimeTracker || !globalTimeStart) return;

  clearInterval(globalTimeTracker);
  globalTimeTracker = null;

  // Save accumulated time
  await saveAccumulatedGlobalTime();
  
  globalTimeStart = null;
  lastGlobalSaveTime = null;
}

// ─────────────────────────────────────────────────────────────
// MODE CHANGE HANDLER (Dev/User toggle listener)
// ─────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  // Re-check blocking when data is loaded after login
  if (msg?.type === "FT_RECHECK_BLOCKING") {
    const pageType = detectPageType();
    if (pageType === "WATCH") {
      const videoId = extractVideoIdFromUrl();
      const channel = extractChannelFast();
      
      if (channel && videoId) {
        // Re-check blocking with fresh data
        chrome.storage.local.get(["ft_blocked_channels"]).then(({ ft_blocked_channels = [] }) => {
          const blockedChannels = Array.isArray(ft_blocked_channels) ? ft_blocked_channels : [];
          if (blockedChannels.length > 0) {
            const channelLower = channel.toLowerCase().trim();
            const isBlocked = blockedChannels.some(blocked => {
              const blockedLower = blocked.toLowerCase().trim();
              return blockedLower === channelLower; // Exact match only
            });
            
            if (isBlocked) {
              console.log("[FT] 🚫 Channel blocked (after login re-check):", channel);
              pauseAndMuteVideo(); // Immediate pause
              showChannelBlockedOverlay(channel); // Show overlay instead of immediate redirect
            }
          }
        }).catch((e) => {
          console.warn("[FT] Error re-checking blocking:", e.message);
        });
      }
    }
    return; // Don't continue to other handlers
  }
  if (msg?.type === "FT_MODE_CHANGED" || msg?.type === "FT_PLAN_CHANGED") {
    console.log(`[FT content] Plan changed → ${msg.plan}`);
    // Clear overlays & force fresh navigation logic
    removeOverlay();
    scheduleNav(0);
  }

  if (msg?.type === "FT_FORCE_NAV") {
    scheduleNav(0);
    return;
  }

  if (msg?.type === "FT_SETTINGS_RELOADED") {
    // Settings were reloaded from server - re-apply immediately
    console.log("[FT] Settings reloaded, re-applying...");
    hideRecommendationsIfEnabled();
    setupRecommendationsObserver(); // ← ADD THIS LINE
    // Also re-check blocking in case focus window or other settings changed
    scheduleNav(0);
    return;
  }
});

// ─────────────────────────────────────────────────────────────
// MAIN LOGIC
// ─────────────────────────────────────────────────────────────

/**
 * Gets nudge style from settings (default: "firm")
 * Returns style object with messages for different nudge types
 */
async function getNudgeStyle() {
  if (!isChromeContextValid()) return "firm";
  
  try {
    const { ft_extension_settings = {} } = await chrome.storage.local.get(["ft_extension_settings"]);
    return ft_extension_settings.nudge_style || "firm";
  } catch (e) {
    console.warn("[FT] Error getting nudge style:", e.message);
    return "firm";
  }
}

/**
 * Gets nudge message based on style and type
 */
function getNudgeMessage(style, type, context = {}) {
  const messages = {
    gentle: {
      spiral: "Still learning?",
      timeLimit: "Take a break?",
      focusWindow: "Maybe step away?",
      journal: "What made you click on this? What were you hoping to feel?"
    },
    direct: {
      spiral: "Check your goals",
      timeLimit: "You're over your limit",
      focusWindow: "Time to focus",
      journal: "What were you trying to avoid?"
    },
    firm: {
      spiral: "Time's up",
      timeLimit: "Blocked for today",
      focusWindow: "Focus now",
      journal: "Write down what triggered you"
    }
  };
  
  return messages[style]?.[type] || messages.firm[type] || "";
}

/**
 * Hides YouTube recommendations based on user settings
 * Hides both sidebar recommendations (on watch pages) and homepage feed
 */
function hideRecommendationsIfEnabled() {
  if (!isChromeContextValid()) return;
  
  chrome.storage.local.get(["ft_extension_settings"]).then(async ({ ft_extension_settings = {} }) => {
    const plan = await getEffectivePlan();
    const { hide_recommendations: hideRecs } = computeEffectiveSettings(plan, ft_extension_settings);
    
    if (!hideRecs) {
      // Show recommendations if setting is off
      document.querySelectorAll('[data-ft-hidden-recs]').forEach(el => {
        el.style.display = '';
        el.removeAttribute('data-ft-hidden-recs');
      });
      return;
    }

    const pageType = detectPageType();

    // Hide sidebar recommendations on watch pages
    if (pageType === "WATCH") {
      // Sidebar recommendations container
      const sidebar = document.querySelector('ytd-watch-next-secondary-results-renderer');
      if (sidebar && !sidebar.hasAttribute('data-ft-hidden-recs')) {
        sidebar.style.display = 'none';
        sidebar.setAttribute('data-ft-hidden-recs', 'true');
      }

      // Also hide the "Up next" section
      const upNext = document.querySelector('ytd-watch-next-secondary-results-renderer');
      if (upNext && !upNext.hasAttribute('data-ft-hidden-recs')) {
        upNext.style.display = 'none';
        upNext.setAttribute('data-ft-hidden-recs', 'true');
      }
    }

    // Hide homepage recommendations feed
    if (pageType === "HOME") {
      // Main content feed - try multiple selectors
      const feedSelectors = [
        'ytd-rich-grid-renderer',
        'ytd-two-column-browse-results-renderer',
        '#contents ytd-rich-grid-renderer'
      ];
      
      feedSelectors.forEach(selector => {
        const feed = document.querySelector(selector);
        if (feed && !feed.hasAttribute('data-ft-hidden-recs')) {
          feed.style.display = 'none';
          feed.setAttribute('data-ft-hidden-recs', 'true');
        }
      });

      // Also hide any recommendation sections
      document.querySelectorAll('ytd-rich-section-renderer, ytd-shelf-renderer').forEach(el => {
        if (!el.hasAttribute('data-ft-hidden-recs')) {
          el.style.display = 'none';
          el.setAttribute('data-ft-hidden-recs', 'true');
        }
      });
    }
  }).catch((e) => {
    console.warn("[FT] Error checking hide recommendations setting:", e.message);
  });
}

// MutationObserver for dynamic content
let recommendationsObserver = null;

function setupRecommendationsObserver() {
  if (recommendationsObserver) return;

  recommendationsObserver = new MutationObserver(() => {
    hideRecommendationsIfEnabled();
  });

  recommendationsObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/**
 * Core navigation handler — runs whenever the page changes or refreshes.
 * 1. Detects what kind of page we're on
 * 2. Sends message to background for decision
 * 3. Applies result (block / allow)
 */
// Track last extracted URL and video_id for debugging
let lastExtractedUrl = null;
let lastExtractedVideoId = null;

// ─────────────────────────────────────────────────────────────
// BEHAVIOR LOOP AWARENESS TRACKING
// ─────────────────────────────────────────────────────────────

/**
 * Checks if video is currently paused
 * @returns {boolean} True if video is paused
 */
function isVideoPaused() {
  const videos = document.querySelectorAll("video");
  if (videos.length === 0) return true;
  
  // Check if any video is playing
  for (const video of videos) {
    if (!video.paused) return false;
  }
  return true;
}

/**
 * Checks if tab is hidden (but audio might still be playing)
 * @returns {boolean} True if tab is hidden
 */
function isTabHidden() {
  return document.hidden || document.visibilityState === "hidden";
}

/**
 * Checks if audio is playing even when tab is hidden
 * @returns {boolean} True if audio is playing
 */
function isAudioPlaying() {
  const videos = document.querySelectorAll("video");
  for (const video of videos) {
    if (!video.paused && !video.muted) return true;
  }
  return false;
}

/**
 * Calculates effective distracting count/time including neutral excess
 * @param {Object} counters - Current global counters
 * @returns {Object} {effectiveCount, effectiveTime}
 */
function calculateEffectiveDistracting(counters) {
  const {
    ft_distracting_count_global = 0,
    ft_distracting_time_global = 0,
    ft_neutral_count_global = 0,
    ft_neutral_time_global = 0
  } = counters;
  
  // Neutral free allowance: first 2 videos OR first 20 minutes
  const neutralExcessCount = Math.max(0, ft_neutral_count_global - 2);
  const neutralExcessTime = Math.max(0, ft_neutral_time_global - 1200); // 20 min = 1200s
  
  const effectiveCount = ft_distracting_count_global + neutralExcessCount;
  const effectiveTime = ft_distracting_time_global + neutralExcessTime;
  
  return { effectiveCount, effectiveTime };
}

/**
 * Checks thresholds and triggers nudges for distracting content
 * @param {number} effectiveCount - Effective distracting count (including neutral excess)
 * @param {number} effectiveTime - Effective distracting time in seconds
 * @param {boolean} isVideoEnd - Whether this check is at video end (for productive nudges)
 * @returns {string|null} Nudge type to show: "nudge1", "nudge2", "break", or null
 */
function checkDistractingThresholds(effectiveCount, effectiveTime, isVideoEnd = false) {
  // Distracting nudges show during video (not at end)
  if (isVideoEnd) return null;
  
  // Break: 5 videos OR 60 minutes
  if (effectiveCount >= 5 || effectiveTime >= 3600) {
    console.log("[FT] 🔍 Limit check: DISTRACTING BREAK", { count: effectiveCount, time: Math.floor(effectiveTime / 60) + "m" });
    return "break";
  }
  
  // Nudge 2: 4 videos OR 40 minutes
  if (effectiveCount >= 4 || effectiveTime >= 2400) {
    console.log("[FT] 🔍 Limit check: DISTRACTING NUDGE2", { count: effectiveCount, time: Math.floor(effectiveTime / 60) + "m" });
    return "nudge2";
  }
  
  // Nudge 1: 3 videos OR 20 minutes
  if (effectiveCount >= 3 || effectiveTime >= 1200) {
    console.log("[FT] 🔍 Limit check: DISTRACTING NUDGE1", { count: effectiveCount, time: Math.floor(effectiveTime / 60) + "m" });
    return "nudge1";
  }
  
  return null;
}

/**
 * Checks thresholds and triggers nudges for productive content
 * @param {number} count - Productive count
 * @param {number} time - Productive time in seconds
 * @param {boolean} isVideoEnd - Whether this check is at video end
 * @returns {string|null} Nudge type to show: "nudge1", "nudge2", "break", or null
 */
function checkProductiveThresholds(count, time, isVideoEnd = false) {
  // Productive nudges show at video end (not during video)
  if (!isVideoEnd) return null;
  
  // Break: 7 videos OR 90 minutes
  if (count >= 7 || time >= 5400) {
    console.log("[FT] 🔍 Limit check: PRODUCTIVE BREAK", { count, time: Math.floor(time / 60) + "m" });
    return "break";
  }
  
  // Nudge 2: 5 videos OR 60 minutes
  if (count >= 5 || time >= 3600) {
    console.log("[FT] 🔍 Limit check: PRODUCTIVE NUDGE2", { count, time: Math.floor(time / 60) + "m" });
    return "nudge2";
  }
  
  // Nudge 1: 3 videos OR 30 minutes
  if (count >= 3 || time >= 1800) {
    console.log("[FT] 🔍 Limit check: PRODUCTIVE NUDGE1", { count, time: Math.floor(time / 60) + "m" });
    return "nudge1";
  }
  
  return null;
}

/**
 * Updates global counters and checks thresholds
 * Called every 45 seconds during video watch
 */
// Track timer fire count for conditional logging
let behaviorLoopTimerFireCount = 0;

async function updateBehaviorLoopCounters() {
  // Check if user can record data (Pro or active Trial only)
  const { ft_can_record } = await chrome.storage.local.get(["ft_can_record"]);
  if (!ft_can_record) {
    // Free users don't get behavior loop awareness (Pro feature)
    return;
  }
  if (!isChromeContextValid()) {
    stopBehaviorLoopTracking();
    return;
  }
  
  behaviorLoopTimerFireCount++;
  const shouldLogTimer = (behaviorLoopTimerFireCount % 5 === 0); // Log every 5th timer fire
  
  try {
    // Check if video is paused
    const videoPaused = isVideoPaused();
    const tabHidden = isTabHidden();
    const audioPlaying = isAudioPlaying();
    
    // Don't count time if video is paused (unless audio is playing in background)
    if (videoPaused && !audioPlaying) {
      // Video is paused - track pause start time
      if (behaviorLoopLastPauseTime === null) {
        behaviorLoopLastPauseTime = Date.now();
      }
      return; // Don't update counters while paused
    }
    
    // Video is playing - handle resume from pause
    if (behaviorLoopLastPauseTime !== null) {
      // We were paused, now playing - add paused time to accumulator
      const pausedDuration = Date.now() - behaviorLoopLastPauseTime;
      behaviorLoopPausedTime += pausedDuration;
      behaviorLoopLastPauseTime = null;
    }
    
    // Don't count time if tab is hidden (unless audio is playing)
    if (tabHidden && !audioPlaying) {
      behaviorLoopTabHidden = true;
      return; // Don't update counters while tab hidden
    }
    
    behaviorLoopTabHidden = false;
    
    // Calculate incremental watch time since last update
    if (!behaviorLoopStartTime) return;
    
    const now = Date.now();
    const elapsed = now - behaviorLoopStartTime;
    const actualWatchTime = Math.floor((elapsed - behaviorLoopPausedTime) / 1000);
    
    if (actualWatchTime <= 0) return;
    
    // Calculate incremental time (time since last update, or since start if first update)
    const lastUpdate = behaviorLoopLastUpdateTime || behaviorLoopStartTime;
    const incrementalSeconds = Math.floor((now - lastUpdate - (behaviorLoopPausedTime - (behaviorLoopLastPauseTime ? (now - behaviorLoopLastPauseTime) : 0))) / 1000);
    
    if (incrementalSeconds <= 0) return;
    
    // Update last update time
    behaviorLoopLastUpdateTime = now;
    
    // Get current classification
    if (!behaviorLoopCurrentClassification) return;
    
    const classification = behaviorLoopCurrentClassification.distraction_level || 
                          behaviorLoopCurrentClassification.category || "neutral";
    
    // Get current counters
    const counters = await chrome.storage.local.get([
      "ft_distracting_count_global",
      "ft_distracting_time_global",
      "ft_productive_count_global",
      "ft_productive_time_global",
      "ft_neutral_count_global",
      "ft_neutral_time_global",
      "ft_break_lockout_until"
    ]);
    
    if (chrome.runtime.lastError) {
      console.warn("[FT] Error getting counters:", chrome.runtime.lastError.message);
      return;
    }
    
    // Check if break lockout is active
    const breakLockoutUntil = counters.ft_break_lockout_until || 0;
    if (Date.now() < breakLockoutUntil) {
      // Break is active - don't update counters
      const remainingSeconds = Math.ceil((breakLockoutUntil - Date.now()) / 1000);
      const remainingMinutes = Math.floor(remainingSeconds / 60);
      const remainingSecs = remainingSeconds % 60;
      const timeRemaining = `${remainingMinutes}:${String(remainingSecs).padStart(2, '0')}`;
      console.log("[FT] 🛑 BREAK LOCKOUT: Active during counter update", { 
        remainingTime: timeRemaining,
        remainingSeconds 
      });
      return;
    }
    
    // Update counters based on classification (incremental - add time since last update)
    const updates = {};
    
    if (classification === "distracting") {
      // Increment distracting counters
      const currentDistractingTime = (counters.ft_distracting_time_global || 0) + incrementalSeconds;
      const currentDistractingCount = counters.ft_distracting_count_global || 0;
      
      updates.ft_distracting_time_global = currentDistractingTime;
      
      const effective = calculateEffectiveDistracting({
        ft_distracting_count_global: currentDistractingCount,
        ft_distracting_time_global: currentDistractingTime,
        ft_neutral_count_global: counters.ft_neutral_count_global || 0,
        ft_neutral_time_global: counters.ft_neutral_time_global || 0
      });
      
      // Add 1 to account for current video being watched (count is only incremented at video end)
      const effectiveCountWithCurrent = effective.effectiveCount + 1;
      const nudgeType = checkDistractingThresholds(effectiveCountWithCurrent, effective.effectiveTime, false);
      
      // Log timer fire if threshold crossed or every 5th fire
      if (shouldLogTimer || nudgeType) {
        console.log("[FT] ⏱️ Timer fire:", { 
          fireCount: behaviorLoopTimerFireCount, 
          classification, 
          incrementalSeconds,
          thresholdHit: nudgeType || "none"
        });
      }
      
      if (nudgeType && !behaviorLoopNudgeShown) {
        behaviorLoopNudgeShown = true;
        console.log("[FT] 🎯 Popup call: DISTRACTING", { nudgeType, count: effectiveCountWithCurrent, time: Math.floor(effective.effectiveTime / 60) + "m" });
        // Trigger nudge
        showDistractingNudge(nudgeType, {
          effectiveCount: effectiveCountWithCurrent,
          effectiveTime: effective.effectiveTime
        }).catch(err => {
          console.warn("[FT] Error showing distracting nudge:", err.message);
        });
      }
    } else if (classification === "productive") {
      // Productive nudges show at video end, not during video
      // Just track time incrementally
      const currentProductiveTime = (counters.ft_productive_time_global || 0) + incrementalSeconds;
      updates.ft_productive_time_global = currentProductiveTime;
      
      // Check thresholds (but don't show nudge yet - will show at video end)
      const currentProductiveCount = counters.ft_productive_count_global || 0;
      const nudgeType = checkProductiveThresholds(currentProductiveCount, currentProductiveTime, false);
      
      // Log timer fire if threshold crossed or every 5th fire
      if (shouldLogTimer || nudgeType) {
        console.log("[FT] ⏱️ Timer fire:", { 
          fireCount: behaviorLoopTimerFireCount, 
          classification, 
          incrementalSeconds,
          thresholdHit: nudgeType || "none"
        });
      }
      
      if (nudgeType) {
        console.log("[FT] Productive threshold would trigger at video end:", nudgeType);
      }
    } else if (classification === "neutral") {
      // Neutral videos are tracked but nudges only trigger if excess counts toward distracting
      const currentNeutralTime = (counters.ft_neutral_time_global || 0) + incrementalSeconds;
      updates.ft_neutral_time_global = currentNeutralTime;
      
      const currentNeutralCount = counters.ft_neutral_count_global || 0;
      
      // Check if neutral excess would trigger distracting nudge
      const effective = calculateEffectiveDistracting({
        ft_distracting_count_global: counters.ft_distracting_count_global || 0,
        ft_distracting_time_global: counters.ft_distracting_time_global || 0,
        ft_neutral_count_global: currentNeutralCount,
        ft_neutral_time_global: currentNeutralTime
      });
      
      // Add 1 to account for current neutral video being watched (if it's the 3rd+ neutral video)
      // Note: calculateEffectiveDistracting already handles neutral excess, but we need to add 1 for current video
      const effectiveCountWithCurrent = effective.effectiveCount + 1;
      const nudgeType = checkDistractingThresholds(effectiveCountWithCurrent, effective.effectiveTime, false);
      
      // Log timer fire if threshold crossed or every 5th fire
      if (shouldLogTimer || nudgeType) {
        console.log("[FT] ⏱️ Timer fire:", { 
          fireCount: behaviorLoopTimerFireCount, 
          classification, 
          incrementalSeconds,
          thresholdHit: nudgeType || "none"
        });
      }
      
      if (nudgeType && !behaviorLoopNudgeShown) {
        behaviorLoopNudgeShown = true;
        console.log("[FT] 🎯 Popup call: NEUTRAL EXCESS → DISTRACTING", { nudgeType, count: effectiveCountWithCurrent, time: Math.floor(effective.effectiveTime / 60) + "m" });
        // Trigger nudge (neutral excess counts as distracting)
        showDistractingNudge(nudgeType, {
          effectiveCount: effectiveCountWithCurrent,
          effectiveTime: effective.effectiveTime
        }).catch(err => {
          console.warn("[FT] Error showing neutral excess nudge:", err.message);
        });
      }
    }
    
    // Save incremental updates
    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
      behaviorLoopAccumulatedTime += incrementalSeconds; // Track accumulated time
      
      // Log counter updates (only when they change)
      const updateKeys = Object.keys(updates);
      const updateValues = updateKeys.map(key => `${key}: ${updates[key]}`).join(", ");
      console.log("[FT] 📊 Counter update:", { classification, incrementalSeconds, updates: updateValues });
    }
    
  } catch (error) {
    console.warn("[FT] Error updating behavior loop counters:", error.message);
  }
}

/**
 * Starts behavior loop awareness tracking for current video
 * @param {string} videoId - Current video ID
 * @param {Object} classification - Video classification (distracting/productive/neutral)
 */
async function startBehaviorLoopTracking(videoId, classification) {
  // Check if user can record data (Pro or active Trial only)
  const plan = await getEffectivePlan();
  if (plan !== "pro") {
    // Free users don't get behavior loop awareness (Pro feature)
    return;
  }
  
  // Stop any existing tracking
  stopBehaviorLoopTracking();
  
  behaviorLoopStartTime = Date.now();
  behaviorLoopPausedTime = 0;
  behaviorLoopLastPauseTime = null;
  behaviorLoopTabHidden = false;
  behaviorLoopCurrentClassification = classification;
  behaviorLoopNudgeShown = false;
  behaviorLoopLastUpdateTime = Date.now();
  behaviorLoopAccumulatedTime = 0;
  behaviorLoopTimerFireCount = 0; // Reset timer fire count
  
  const classificationType = classification?.distraction_level || classification?.category || "unknown";
  console.log("[FT] 🎬 START tracking:", { videoId, classification: classificationType });
  
  // Start 45-second interval timer
  behaviorLoopTimer = setInterval(() => {
    updateBehaviorLoopCounters();
  }, 45000); // Every 45 seconds
  
  // Also check immediately (for cases where threshold is already met)
  updateBehaviorLoopCounters();
}

/**
 * Stops behavior loop awareness tracking
 * Finalizes watch time and updates counters
 */
async function stopBehaviorLoopTracking() {
  // Check if extension context is still valid before doing anything
  if (!isChromeContextValid()) {
    // Context invalidated - just reset state, don't try to save
    behaviorLoopStartTime = null;
    behaviorLoopCurrentClassification = null;
    behaviorLoopPausedTime = 0;
    behaviorLoopLastPauseTime = null;
    behaviorLoopLastUpdateTime = null;
    behaviorLoopAccumulatedTime = 0;
    if (behaviorLoopTimer) {
      clearInterval(behaviorLoopTimer);
      behaviorLoopTimer = null;
    }
    return;
  }
  
  if (behaviorLoopTimer) {
    clearInterval(behaviorLoopTimer);
    behaviorLoopTimer = null;
  }
  
  if (!behaviorLoopStartTime || !behaviorLoopCurrentClassification) {
    return; // Nothing to finalize
  }
  
  const classificationType = behaviorLoopCurrentClassification?.distraction_level || 
                             behaviorLoopCurrentClassification?.category || "unknown";
  console.log("[FT] 🛑 STOP tracking:", { classification: classificationType, accumulatedTime: behaviorLoopAccumulatedTime });
  
  try {
    // Calculate final watch time (exact time, not incremental)
    const elapsed = Date.now() - behaviorLoopStartTime;
    const actualWatchTime = Math.floor((elapsed - behaviorLoopPausedTime) / 1000);
    
    if (actualWatchTime <= 0) {
      // Reset state
      behaviorLoopStartTime = null;
      behaviorLoopCurrentClassification = null;
      behaviorLoopPausedTime = 0;
      behaviorLoopLastPauseTime = null;
      behaviorLoopLastUpdateTime = null;
      behaviorLoopAccumulatedTime = 0;
      return;
    }
    
    // Calculate remaining time (actual - already accumulated)
    const remainingTime = Math.max(0, actualWatchTime - behaviorLoopAccumulatedTime);
    
    const classification = behaviorLoopCurrentClassification.distraction_level || 
                          behaviorLoopCurrentClassification.category || "neutral";
    
    // Get current counters
    const counters = await chrome.storage.local.get([
      "ft_distracting_count_global",
      "ft_distracting_time_global",
      "ft_productive_count_global",
      "ft_productive_time_global",
      "ft_neutral_count_global",
      "ft_neutral_time_global",
      "ft_break_lockout_until"
    ]);
    
    if (chrome.runtime.lastError) {
      console.warn("[FT] Error getting counters for finalization:", chrome.runtime.lastError.message);
      return;
    }
    
    // Check if break lockout is active
    const breakLockoutUntil = counters.ft_break_lockout_until || 0;
    if (Date.now() < breakLockoutUntil) {
      // Break is active - don't update counters
      behaviorLoopStartTime = null;
      behaviorLoopCurrentClassification = null;
      behaviorLoopPausedTime = 0;
      behaviorLoopLastPauseTime = null;
      behaviorLoopLastUpdateTime = null;
      behaviorLoopAccumulatedTime = 0;
      return;
    }
    
    // Update counters with final watch time (add remaining time that wasn't counted in 60s updates)
    const updates = {};
    
    if (classification === "distracting") {
      updates.ft_distracting_count_global = (counters.ft_distracting_count_global || 0) + 1;
      updates.ft_distracting_time_global = (counters.ft_distracting_time_global || 0) + remainingTime;
    } else if (classification === "productive") {
      updates.ft_productive_count_global = (counters.ft_productive_count_global || 0) + 1;
      updates.ft_productive_time_global = (counters.ft_productive_time_global || 0) + remainingTime;
      
      // Check productive thresholds at video end
      const newCount = updates.ft_productive_count_global;
      const newTime = updates.ft_productive_time_global;
      const nudgeType = checkProductiveThresholds(newCount, newTime, true);
      
      if (nudgeType) {
        console.log("[FT] 🎯 Popup call: PRODUCTIVE", { nudgeType, count: newCount, time: Math.floor(newTime / 60) + "m" });
        // Show productive nudge at video end
        showProductiveNudge(nudgeType, {
          count: newCount,
          time: newTime
        }).catch(err => {
          console.warn("[FT] Error showing productive nudge:", err.message);
        });
      }
    } else if (classification === "neutral") {
      updates.ft_neutral_count_global = (counters.ft_neutral_count_global || 0) + 1;
      updates.ft_neutral_time_global = (counters.ft_neutral_time_global || 0) + remainingTime;
      
      // Check if neutral excess triggers distracting nudge
      const effective = calculateEffectiveDistracting({
        ft_distracting_count_global: counters.ft_distracting_count_global || 0,
        ft_distracting_time_global: counters.ft_distracting_time_global || 0,
        ft_neutral_count_global: updates.ft_neutral_count_global,
        ft_neutral_time_global: updates.ft_neutral_time_global
      });
      
      const nudgeType = checkDistractingThresholds(effective.effectiveCount, effective.effectiveTime, false);
      
      if (nudgeType) {
        console.log("[FT] 🎯 Popup call: NEUTRAL EXCESS → DISTRACTING (video end)", { nudgeType, count: effective.effectiveCount, time: Math.floor(effective.effectiveTime / 60) + "m" });
        // Show nudge (neutral excess counts as distracting)
        showDistractingNudge(nudgeType, {
          effectiveCount: effective.effectiveCount,
          effectiveTime: effective.effectiveTime
        }).catch(err => {
          console.warn("[FT] Error showing neutral excess nudge at video end:", err.message);
        });
      }
    }
    
    // Save updated counters
    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
      
      // Log counter updates (only when they change)
      const updateKeys = Object.keys(updates);
      const updateValues = updateKeys.map(key => `${key}: ${updates[key]}`).join(", ");
      console.log("[FT] 📊 Counter update (video end):", { classification, remainingTime, updates: updateValues });
    }
    
    // Reset state
    behaviorLoopStartTime = null;
    behaviorLoopCurrentClassification = null;
    behaviorLoopPausedTime = 0;
    behaviorLoopLastPauseTime = null;
    behaviorLoopLastUpdateTime = null;
    behaviorLoopAccumulatedTime = 0;
    
  } catch (error) {
    console.warn("[FT] Error finalizing behavior loop tracking:", error.message);
    // Reset state even on error
    behaviorLoopStartTime = null;
    behaviorLoopCurrentClassification = null;
    behaviorLoopPausedTime = 0;
    behaviorLoopLastPauseTime = null;
  }
}

// Set up tab visibility listener
document.addEventListener("visibilitychange", () => {
  behaviorLoopTabHidden = isTabHidden();
});

/**
 * Shows distracting content nudge (10s, 30s, or break)
 * @param {string} nudgeType - "nudge1" (10s), "nudge2" (30s), or "break" (10 min)
 * @param {Object} counters - Current counters {effectiveCount, effectiveTime}
 */
async function showDistractingNudge(nudgeType, counters) {
  const { effectiveCount, effectiveTime } = counters;
  
  // Remove any existing nudge
  const existing = document.getElementById("ft-behavior-nudge");
  if (existing) existing.remove();
  
  // Pause video before showing nudge
  pauseAndMuteVideo();
  
  const overlay = document.createElement("div");
  overlay.id = "ft-behavior-nudge";
  
  let message = "";
  let duration = 10; // seconds
  let showJournal = false;
  
  if (nudgeType === "nudge1") {
    message = "Still aligned with your goals?";
    duration = 30; // Changed from 10 to 30 seconds
    showJournal = true; // Add journal button
  } else if (nudgeType === "nudge2") {
    message = "Still aligned with your goals?";
    duration = 60; // Changed from 30 to 60 seconds (1 minute)
    showJournal = true;
  } else if (nudgeType === "break") {
    message = "You've been watching distracting content. Take a 10-minute break to reset your focus.";
    duration = 600; // 10 minutes in seconds
    showJournal = true;
  }
  
  const countText = effectiveCount >= 2 ? `${effectiveCount} videos` : "";
  const timeText = effectiveTime >= 1200 ? `${Math.floor(effectiveTime / 60)} minutes` : "";
  const thresholdText = [countText, timeText].filter(Boolean).join(" or ");
  
  overlay.innerHTML = `
    <div class="ft-milestone-box">
      <h2>⚠️ ${message}</h2>
      <p class="ft-milestone-intro">
        You've watched ${thresholdText} of distracting content today.
      </p>
      ${duration > 0 ? `
        <div class="ft-spiral-timer">
          <div class="ft-timer-circle">
            <span id="ft-timer-count">${nudgeType === "break" ? "600" : duration}</span>
          </div>
        </div>
        ${nudgeType === "break" ? `
          <p style="text-align: center; color: #666; font-size: 14px; margin-top: 16px;">
            Time remaining: <span id="ft-break-time-text">10:00</span>
          </p>
        ` : ""}
      ` : ""}
      <div class="ft-milestone-buttons">
        ${nudgeType === "break" ? `
          ${showJournal ? `<button id="ft-journal-btn" class="ft-button ft-button-outline">Journal</button>` : ""}
        ` : `
          <button id="ft-nudge-continue" class="ft-button ft-button-secondary">Continue</button>
          ${showJournal ? `<button id="ft-journal-btn" class="ft-button ft-button-outline">Journal</button>` : ""}
        `}
      </div>
    </div>
  `;
  
  // Countdown timer (for all nudges including break)
  let timerInterval = null;
  if (duration > 0) {
    let timeLeft = duration;
    const timerEl = overlay.querySelector("#ft-timer-count");
    const timeTextEl = overlay.querySelector("#ft-break-time-text"); // For break overlay MM:SS format
    
    timerInterval = setInterval(() => {
      timeLeft--;
      if (timerEl) {
        timerEl.textContent = timeLeft;
      }
      if (timeTextEl && nudgeType === "break") {
        // Format as MM:SS for break overlay
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timeTextEl.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
      }
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        if (nudgeType === "break") {
          // Auto-redirect after 10 minutes
          handleBreakComplete();
        } else {
          dismissDistractingNudge(overlay, showJournal);
        }
      }
    }, 1000);
  }
  
  // Button handlers
  const continueBtn = overlay.querySelector("#ft-nudge-continue");
  const journalBtn = overlay.querySelector("#ft-journal-btn");
  
  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      if (timerInterval) clearInterval(timerInterval);
      dismissDistractingNudge(overlay, showJournal);
    });
  }
  
  if (journalBtn) {
    journalBtn.addEventListener("click", () => {
      // Don't dismiss the nudge, just open journal modal (timer continues)
      showJournalModal("distracting", {
        ...counters,
        source: "behavior_loop_negative"
      });
    });
  }
  
  // Break button removed - break auto-completes after 10 minutes via timer
  
  document.body.appendChild(overlay);
  console.log("[FT] ✅ Popup added to DOM: DISTRACTING", { nudgeType, duration, message });
}

/**
 * Dismisses distracting nudge and saves journal if provided
 */
async function dismissDistractingNudge(overlay, showJournal) {
  // Journal is now handled via separate modal, so no need to save here
  overlay.remove();
  restoreVideoState();
}

/**
 * Handles break completion after 10-minute timer expires
 * Sets break lockout, resets counters, and redirects to YouTube home
 */
async function handleBreakComplete() {
  try {
    // Set break lockout (10 minutes from now)
    const breakUntil = Date.now() + (10 * 60 * 1000);
    await chrome.storage.local.set({ ft_break_lockout_until: breakUntil });
    const expiresAt = new Date(breakUntil).toLocaleTimeString();
    console.log("[FT] 🛑 BREAK COMPLETE: Auto-redirecting", { 
      breakUntil: new Date(breakUntil).toISOString(),
      expiresAt,
      duration: "10m",
      lockoutActive: true
    });
    
    // Reset counters (after lockout period, counters will be reset)
    // Note: Counters reset happens after lockout period, not immediately
    await chrome.storage.local.set({
      ft_distracting_count_global: 0,
      ft_distracting_time_global: 0,
      ft_neutral_count_global: 0,
      ft_neutral_time_global: 0
    });
    
    // Remove overlay
    const overlay = document.getElementById("ft-behavior-nudge");
    if (overlay) overlay.remove();
    restoreVideoState();
    
    // Redirect to home
    window.location.href = "https://www.youtube.com/";
  } catch (error) {
    console.error("[FT] Error handling break completion:", error);
    // Still try to redirect even if there's an error
    window.location.href = "https://www.youtube.com/";
  }
}

/**
 * Shows productive content nudge (10s, 30s, or break)
 * @param {string} nudgeType - "nudge1" (10s), "nudge2" (30s), or "break" (10 min)
 * @param {Object} counters - Current counters {count, time}
 */
async function showProductiveNudge(nudgeType, counters) {
  const { count, time } = counters;
  
  // Remove any existing nudge
  const existing = document.getElementById("ft-behavior-nudge");
  if (existing) existing.remove();
  
  // Pause video before showing nudge
  pauseAndMuteVideo();
  
  const overlay = document.createElement("div");
  overlay.id = "ft-behavior-nudge";
  
  let message = "";
  let duration = 10; // seconds
  let showJournal = false;
  
  if (nudgeType === "nudge1") {
    message = "Let's make sure you apply what you learned.";
    duration = 30; // Changed from 5 to 30 seconds
    showJournal = true; // Add journal button
  } else if (nudgeType === "nudge2") {
    message = "Time to apply this – don't just stack more content.";
    duration = 60; // Changed from 30 to 60 seconds (1 minute)
    showJournal = true;
  } else if (nudgeType === "break") {
    message = "You've watched 7 educational videos today. Time to rest the brain.";
    duration = 600; // 10 minutes in seconds
    showJournal = true;
  }
  
  const countText = count >= 3 ? `${count} videos` : "";
  const timeText = time >= 1800 ? `${Math.floor(time / 60)} minutes` : "";
  const thresholdText = [countText, timeText].filter(Boolean).join(" or ");
  
  overlay.innerHTML = `
    <div class="ft-milestone-box">
      <h2>💡 ${message}</h2>
      <p class="ft-milestone-intro">
        You've watched ${thresholdText} of productive content today.
      </p>
      ${duration > 0 ? `
        <div class="ft-spiral-timer">
          <div class="ft-timer-circle">
            <span id="ft-timer-count">${nudgeType === "break" ? "600" : duration}</span>
          </div>
        </div>
        ${nudgeType === "break" ? `
          <p style="text-align: center; color: #666; font-size: 14px; margin-top: 16px;">
            Time remaining: <span id="ft-break-time-text">10:00</span>
          </p>
        ` : ""}
      ` : ""}
      <div class="ft-milestone-buttons">
        ${nudgeType === "break" ? `
          ${showJournal ? `<button id="ft-journal-btn" class="ft-button ft-button-outline">Journal</button>` : ""}
        ` : `
          <button id="ft-nudge-continue" class="ft-button ft-button-secondary">Continue</button>
          ${showJournal ? `<button id="ft-journal-btn" class="ft-button ft-button-outline">Journal</button>` : ""}
        `}
      </div>
    </div>
  `;
  
  // Countdown timer (for all nudges including break)
  let timerInterval = null;
  if (duration > 0) {
    let timeLeft = duration;
    const timerEl = overlay.querySelector("#ft-timer-count");
    const timeTextEl = overlay.querySelector("#ft-break-time-text"); // For break overlay MM:SS format
    
    timerInterval = setInterval(() => {
      timeLeft--;
      if (timerEl) {
        timerEl.textContent = timeLeft;
      }
      if (timeTextEl && nudgeType === "break") {
        // Format as MM:SS for break overlay
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timeTextEl.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
      }
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        if (nudgeType === "break") {
          // Auto-redirect after 10 minutes
          handleProductiveBreakComplete();
        } else {
          dismissProductiveNudge(overlay, showJournal);
        }
      }
    }, 1000);
  }
  
  // Button handlers
  const continueBtn = overlay.querySelector("#ft-nudge-continue");
  const journalBtn = overlay.querySelector("#ft-journal-btn");
  
  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      if (timerInterval) clearInterval(timerInterval);
      dismissProductiveNudge(overlay, showJournal);
    });
  }
  
  if (journalBtn) {
    journalBtn.addEventListener("click", () => {
      // Don't dismiss the nudge, just open journal modal (timer continues)
      showJournalModal("productive", {
        ...counters,
        source: "behavior_loop_positive"
      });
    });
  }
  
  // Break button removed - break auto-completes after 10 minutes via timer
  
  document.body.appendChild(overlay);
  console.log("[FT] ✅ Popup added to DOM: PRODUCTIVE", { nudgeType, duration, message });
}

/**
 * Dismisses productive nudge and saves journal if provided
 */
async function dismissProductiveNudge(overlay, showJournal) {
  // Journal is now handled via separate modal, so no need to save here
  overlay.remove();
  restoreVideoState();
}

/**
 * Handles productive break completion after 10-minute timer expires
 * Sets break lockout, resets productive counters only, and redirects to YouTube home
 */
async function handleProductiveBreakComplete() {
  try {
    // Set break lockout (10 minutes from now)
    const breakUntil = Date.now() + (10 * 60 * 1000);
    await chrome.storage.local.set({ ft_break_lockout_until: breakUntil });
    const expiresAt = new Date(breakUntil).toLocaleTimeString();
    console.log("[FT] 🛑 BREAK COMPLETE: PRODUCTIVE - Auto-redirecting", { 
      breakUntil: new Date(breakUntil).toISOString(),
      expiresAt,
      duration: "10m",
      lockoutActive: true
    });
    
    // Reset productive counters only (not distracting/neutral)
    await chrome.storage.local.set({
      ft_productive_count_global: 0,
      ft_productive_time_global: 0
    });
    
    // Remove overlay
    const overlay = document.getElementById("ft-behavior-nudge");
    if (overlay) overlay.remove();
    restoreVideoState();
    
    // Redirect to home
    window.location.href = "https://www.youtube.com/";
  } catch (error) {
    console.error("[FT] Error handling productive break completion:", error);
    // Still try to redirect even if there's an error
    window.location.href = "https://www.youtube.com/";
  }
}

/**
 * Shows journal modal (separate from nudge, not timer-locked)
 * @param {string} distractionLevel - "distracting" or "productive"
 * @param {Object} context - Context for journal entry
 */
function showJournalModal(distractionLevel, context) {
  // Remove any existing journal modal
  const existing = document.getElementById("ft-journal-modal");
  if (existing) existing.remove();
  
  // Get current video metadata (or use from context for spiral)
  const meta = extractVideoMetadata();
  const channel = context?.channel || meta?.channel || "Unknown";
  const videoTitle = meta?.title || "Current video";
  const isSpiral = context?.source === "spiral_nudge";
  
  const modal = document.createElement("div");
  modal.id = "ft-journal-modal";
  
  // Different prompt for spiral vs behavior loop
  let promptText = "";
  let placeholderText = "";
  if (isSpiral) {
    promptText = `You've watched a lot of ${channel} this week. What's going on?`;
    placeholderText = "What patterns do you notice? (optional)";
  } else if (distractionLevel === "distracting") {
    promptText = `What triggered you while watching "${videoTitle}"?`;
    placeholderText = "What pulled you off track? (optional)";
  } else {
    promptText = `What did you learn from "${videoTitle}"?`;
    placeholderText = "What will you apply from this? (optional)";
  }
  
  modal.innerHTML = `
    <div class="ft-journal-box">
      <h2>📝 Journal Entry</h2>
      <p class="ft-journal-context">
        ${promptText}
      </p>
      <textarea 
        id="ft-journal-modal-input" 
        placeholder="${placeholderText}"
        style="width: 100%; min-height: 120px; padding: 12px; border: 1px solid #555; border-radius: 8px; font-size: 14px; resize: vertical; background: #1a1a1a; color: #fff;"
      ></textarea>
      <div class="ft-journal-buttons">
        <button id="ft-journal-save" class="ft-button ft-button-primary">Save</button>
        <button id="ft-journal-cancel" class="ft-button ft-button-secondary">Cancel</button>
      </div>
    </div>
  `;
  
  // Button handlers
  const saveBtn = modal.querySelector("#ft-journal-save");
  const cancelBtn = modal.querySelector("#ft-journal-cancel");
  
  saveBtn.addEventListener("click", async () => {
    const journalInput = modal.querySelector("#ft-journal-modal-input");
    const journalText = journalInput?.value?.trim() || "";
    
    if (journalText) {
      await saveJournalEntry(distractionLevel, { ...context, channel });
    }
    
    modal.remove();
  });
  
  cancelBtn.addEventListener("click", () => {
    modal.remove();
  });
  
  document.body.appendChild(modal);
  console.log("[FT] ✅ Journal modal opened:", { distractionLevel, channel, videoTitle, isSpiral });
}

/**
 * Shows break lockout overlay with countdown timer
 * @param {number} remainingSeconds - Seconds remaining in break
 */
async function showBreakLockoutOverlay(remainingSeconds) {
  // Remove any existing overlay
  const existing = document.getElementById("ft-break-overlay");
  if (existing) existing.remove();
  
  pauseAndMuteVideo();
  
  const overlay = document.createElement("div");
  overlay.id = "ft-break-overlay";
  
  overlay.innerHTML = `
    <div class="ft-milestone-box">
      <h2>⏸️ Take a Break</h2>
      <p class="ft-milestone-intro">
        You've been watching a lot today. Take a 10-minute break to reset your focus.
      </p>
      <div class="ft-spiral-timer">
        <div class="ft-timer-circle">
          <span id="ft-break-timer-count">${remainingSeconds}</span>
        </div>
      </div>
      <p style="text-align: center; color: #666; font-size: 14px; margin-top: 16px;">
        Time remaining: <span id="ft-break-time-text">${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}</span>
      </p>
    </div>
  `;
  
  // Update countdown timer
  let timeLeft = remainingSeconds;
  const timerEl = overlay.querySelector("#ft-break-timer-count");
  const timeTextEl = overlay.querySelector("#ft-break-time-text");
  
  const timerInterval = setInterval(() => {
    timeLeft--;
    if (timerEl) {
      timerEl.textContent = timeLeft;
    }
    if (timeTextEl) {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      timeTextEl.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
    }
    
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      overlay.remove();
      restoreVideoState();
      // Break is over - user can watch again
    }
  }, 1000);
  
  document.body.appendChild(overlay);
  console.log("[FT] ✅ Popup added to DOM: BREAK LOCKOUT", { remainingSeconds });
}

/**
 * Saves journal entry to Supabase
 * @param {string} distractionLevel - "distracting", "productive", or "neutral"
 * @param {Object} context - Additional context (counters, etc.)
 */
async function saveJournalEntry(distractionLevel, context) {
  try {
    // Try to get journal text from modal first, then fallback to old textarea
    const journalModalInput = document.getElementById("ft-journal-modal-input");
    const journalOldInput = document.getElementById("ft-journal-input");
    const journalInput = journalModalInput || journalOldInput;
    const journalText = journalInput?.value?.trim() || "";
    
    if (!journalText) {
      // No journal text - don't save
      return;
    }
    
    // Get current video metadata (or use channel from context if provided)
    const meta = extractVideoMetadata();
    const channel = context?.channel || meta?.channel || "Unknown";
    const videoTitle = meta?.title || null;
    const videoUrl = meta?.url || location.href || null;
    
    // Determine context_source based on context
    let contextSource = null;
    if (context?.source === "spiral_nudge") {
      contextSource = "spiral_nudge";
    } else if (distractionLevel === "distracting") {
      contextSource = "behavior_loop_negative";
    } else if (distractionLevel === "productive") {
      contextSource = "behavior_loop_positive";
    }
    
    // Get videos for spiral (if applicable)
    const videos = context?.videos || null;
    
    // Get user email and can_record flag
    const { ft_user_email, ft_can_record } = await chrome.storage.local.get(["ft_user_email", "ft_can_record"]);
    
    if (!ft_user_email) {
      console.warn("[FT] No user email for journal entry");
      return;
    }
    
    // Check if user can record data (Pro or active Trial only)
    if (!ft_can_record) {
      console.log("[FT] Journal entry skipped (plan inactive)");
      // Show user message
      alert("Upgrade to Pro to save journal entries");
      return;
    }
    
    // Send to background to save to server
    const response = await chrome.runtime.sendMessage({
      type: "FT_SAVE_JOURNAL",
      note: journalText,
      channel: channel,
      title: videoTitle,
      url: videoUrl,
      distraction_level: distractionLevel,
      source: contextSource,
      videos: videos
    });
    
    if (response?.ok) {
      console.log("[FT] Journal entry saved successfully");
    } else {
      console.warn("[FT] Failed to save journal entry:", response?.error);
    }
    
    console.log("[FT] Journal entry saved:", { channel, distractionLevel, source: contextSource, textLength: journalText.length, videosCount: videos?.length || 0 });
  } catch (error) {
    console.warn("[FT] Error saving journal entry:", error.message);
  }
}

/**
 * Checks if trial expiring banner should be shown
 * Rules: Once per day, optionally again after 6 hours
 * @returns {Promise<boolean>}
 */
async function shouldShowTrialExpiringBanner() {
  try {
    if (!isChromeContextValid()) return false;
    
    const { ft_trial_banner_last_shown, ft_trial_banner_dismissed_today } = 
      await chrome.storage.local.get([
        "ft_trial_banner_last_shown",
        "ft_trial_banner_dismissed_today"
      ]);
    
    const now = Date.now();
    const lastShown = ft_trial_banner_last_shown || 0;
    const dismissedToday = ft_trial_banner_dismissed_today || false;
    
    // If dismissed today, don't show again today
    if (dismissedToday) {
      // Check if 6 hours have passed since dismissal
      const sixHoursMs = 6 * 60 * 60 * 1000;
      if (now - lastShown < sixHoursMs) {
        return false;
      }
    }
    
    // Check if we've shown it today (within last 24 hours)
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (now - lastShown < oneDayMs) {
      // Already shown today - check if 6 hours passed
      const sixHoursMs = 6 * 60 * 60 * 1000;
      if (now - lastShown < sixHoursMs) {
        return false; // Too soon, don't show again
      }
    }
    
    return true; // Can show
  } catch (e) {
    console.warn("[FT] Error checking banner timing:", e.message);
    return false; // Fail safe - don't show if error
  }
}

/**
 * Shows trial expiring banner (small, non-intrusive, auto-dismisses after 10s)
 * @param {number} daysLeft - Days remaining in trial (0 or 1)
 */
function showTrialExpiringBanner(daysLeft) {
  // Remove any existing banner
  const existing = document.getElementById("ft-trial-expiring-banner");
  if (existing) existing.remove();
  
  const banner = document.createElement("div");
  banner.id = "ft-trial-expiring-banner";
  banner.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff4444;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 300px;
    animation: slideIn 0.3s ease-out;
  `;
  
  const message = daysLeft === 0 
    ? "Your trial expires today! Don't lose Pro features — upgrade now."
    : "Your trial expires tomorrow! Upgrade to keep Pro features.";
  
  banner.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
      <span>${message}</span>
      <button id="ft-trial-banner-close" style="
        background: transparent;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 18px;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">×</button>
    </div>
  `;
  
  // Close button handler
  const closeBtn = banner.querySelector("#ft-trial-banner-close");
  closeBtn.addEventListener("click", () => {
    saveBannerDismissal();
    banner.remove();
  });
  
  // Click banner to go to upgrade page
  banner.style.cursor = "pointer";
  banner.addEventListener("click", (e) => {
    if (e.target !== closeBtn) {
      window.open("https://focustube-beta.vercel.app/app/pricing", "_blank");
      saveBannerDismissal();
      banner.remove();
    }
  });
  
  document.body.appendChild(banner);
  
  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (banner.parentNode) {
      saveBannerDismissal();
      banner.remove();
    }
  }, 10000);
  
  // Save that we showed it
  chrome.storage.local.set({ 
    ft_trial_banner_last_shown: Date.now(),
    ft_trial_banner_dismissed_today: false 
  });
}

/**
 * Saves banner dismissal timestamp
 */
async function saveBannerDismissal() {
  try {
    if (!isChromeContextValid()) return;
    await chrome.storage.local.set({ 
      ft_trial_banner_last_shown: Date.now(),
      ft_trial_banner_dismissed_today: true 
    });
  } catch (e) {
    console.warn("[FT] Error saving banner dismissal:", e.message);
  }
}

async function handleNavigation() {
  // Guard: make sure Chrome APIs exist before continuing
  if (!chrome?.runtime) {
    console.warn("[FT] chrome.runtime unavailable — skipping navigation check.");
    return;
  }
  
  // Check for break lockout first (before any other logic)
  try {
    const { ft_break_lockout_until } = await chrome.storage.local.get(["ft_break_lockout_until"]);
    const breakLockoutUntil = ft_break_lockout_until || 0;
    
    if (Date.now() < breakLockoutUntil) {
      // Break is active - block all video watching
      const pageType = detectPageType();
      const remainingSeconds = Math.ceil((breakLockoutUntil - Date.now()) / 1000);
      const remainingMinutes = Math.floor(remainingSeconds / 60);
      const remainingSecs = remainingSeconds % 60;
      const timeRemaining = `${remainingMinutes}:${String(remainingSecs).padStart(2, '0')}`;
      const expiresAt = new Date(breakLockoutUntil).toLocaleTimeString();
      
      console.log("[FT] 🛑 BREAK CHECK: Active", { 
        remainingSeconds, 
        remainingTime: timeRemaining,
        expiresAt,
        pageType 
      });
      
      if (pageType === "WATCH" || pageType === "SHORTS") {
        // Show break overlay and redirect
        await showBreakLockoutOverlay(remainingSeconds);
        pauseAndMuteVideo();
        // Redirect to home after a moment
        setTimeout(() => {
          window.location.href = "https://www.youtube.com/";
        }, 2000);
        return; // Don't continue with normal navigation logic
      }
    } else if (breakLockoutUntil > 0) {
      // Break just ended
      const expiredAt = new Date(breakLockoutUntil).toLocaleTimeString();
      console.log("[FT] ✅ BREAK ENDED", { 
        expiredAt,
        breakUntil: new Date(breakLockoutUntil).toISOString() 
      });
    } else {
      // No break lockout active
      console.log("[FT] ✅ BREAK CHECK: No lockout active");
    }
  } catch (error) {
    console.warn("[FT] Error checking break lockout:", error.message);
    // Continue with normal flow if check fails
  }
  
  // Debug: Log when handleNavigation is called
  const currentUrl = location.href;
  LOG("[FT DEBUG] handleNavigation() called", { url: currentUrl, timestamp: Date.now() });
  
  // Check if onboarding is needed (first-time user)
  try {
    if (isChromeContextValid()) {
      const { ft_onboarding_completed } = await chrome.storage.local.get(["ft_onboarding_completed"]);
      if (!ft_onboarding_completed) {
        // Show onboarding overlay and block everything until completed
        showOnboardingOverlay();
        return; // Don't proceed with normal navigation
      }
    }
  } catch (e) {
    console.warn("[FT] Error checking onboarding status:", e.message);
    // Continue with normal navigation if check fails
  }
  
  // Check if trial is expiring (0 or 1 days left) - show small banner
  try {
    if (isChromeContextValid()) {
      const { ft_plan, ft_days_left } = await chrome.storage.local.get([
        "ft_plan",
        "ft_days_left"
      ]);
      
      // Show trial expiring banner if on trial with 0-1 days left
      // Note: We check ft_plan directly here because we need to know if user WAS on trial
      // (even if expired, we still want to show the banner)
      if (ft_plan === "trial" && typeof ft_days_left === "number") {
        if (ft_days_left === 0 || ft_days_left === 1) {
          // Check timing rules (once per day, optionally again after 6 hours)
          const shouldShow = await shouldShowTrialExpiringBanner();
          if (shouldShow) {
            showTrialExpiringBanner(ft_days_left);
          }
        }
      }
    }
  } catch (e) {
    console.warn("[FT] Error checking trial status:", e.message);
    // Continue with normal navigation if check fails
  }
  
  const pageType = detectPageType();
  
  // Hide recommendations if enabled (early, before other checks)
  // Works on both HOME and WATCH pages
  if (pageType === "HOME" || pageType === "WATCH") {
    hideRecommendationsIfEnabled();
    setupRecommendationsObserver();
  }

  // Check if we just redirected from Shorts (on home page)
  if (pageType === "HOME") {
    try {
      const { ft_redirected_from_shorts, ft_pro_manual_block_shorts, ft_plan, ft_days_left } = await chrome.storage.local.get([
        "ft_redirected_from_shorts",
        "ft_pro_manual_block_shorts",
        "ft_plan",
        "ft_days_left"
      ]);
      if (chrome.runtime.lastError) {
        console.warn("[FT] Failed to check redirect flags:", chrome.runtime.lastError.message);
        // Continue with normal navigation check
      } else if (ft_redirected_from_shorts) {
        // Clear the redirect flag
        try {
          await chrome.storage.local.remove(["ft_redirected_from_shorts"]);
          if (chrome.runtime.lastError) {
            console.warn("[FT] Failed to clear redirect flag:", chrome.runtime.lastError.message);
          }
        } catch (e) {
          console.warn("[FT] Error clearing redirect flag:", e.message);
        }
        
        // Check if this is a Pro manual block or Free plan block
        // Check if user is Pro (includes active trial, excludes expired trial)
        const isPro = ft_plan === "pro" || (ft_plan === "trial" && ft_days_left > 0);
        if (ft_pro_manual_block_shorts && isPro) {
          // Show Pro manual block overlay (encouraging message)
          // Keep ft_pro_manual_block_shorts flag set so it persists for all redirects
          showProManualBlockOverlay();
        } else {
          // Show Free plan blocking overlay
          showShortsBlockedOverlay();
        }
        return; // Don't check with background for home page in this case
      }
    } catch (e) {
      console.warn("[FT] Error checking redirect flags:", e.message);
      // Continue with normal navigation check
    }
  }

  // Extract video metadata for watch pages (for AI classification)
  let videoMetadata = null;
  if (pageType === "WATCH") {
    // Clear any existing button injection observer (new navigation)
    if (buttonInjectionObserver) {
      buttonInjectionObserver.disconnect();
      buttonInjectionObserver = null;
      pendingButtonChannel = null;
    }
    
    // ============================================================
    // STEP 1: FAST PATH: Immediate blocking check (using cached data)
    // ============================================================
    // No server reload - use cached data from chrome.storage.local
    // Data is synced from Supabase on boot/login only
    const videoId = extractVideoIdFromUrl();
    let channel = extractChannelFast(); // Fast extraction (meta tags first, then DOM)
    
    // If channel not found immediately, keep waiting (handles first-load lag)
    if (!channel && videoId) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 300));
        channel = extractChannelFast();
        if (!channel) {
          channel = await waitForChannelName();
        }
      } catch (err) {
        console.warn("[FT] Channel still missing after wait:", err.message);
        channel = null;
      }
    }
    
    if (videoId) {
      // Check blocked channels immediately (already in memory)
      try {
        const { ft_blocked_channels = [] } = await chrome.storage.local.get(["ft_blocked_channels"]);
        const blockedChannels = Array.isArray(ft_blocked_channels) ? ft_blocked_channels : [];
        
        if (channel && blockedChannels.length > 0) {
          const channelLower = channel.toLowerCase().trim();
          const isBlocked = blockedChannels.some(blocked => {
            const blockedLower = blocked.toLowerCase().trim();
            return blockedLower === channelLower; // Exact match only
          });
          
          if (isBlocked) {
            console.log("[FT] 🚫 Channel blocked (fast check):", channel);
            pauseAndMuteVideo(); // Immediate pause
            showChannelBlockedOverlay(channel); // Show overlay instead of immediate redirect
            return; // Stop here, don't continue
          }
        } else if (!channel) {
          console.log("[FT] Channel still missing during fast check, will inject once detected");
        }
        
        // Channel is NOT blocked (or not yet known) - set up observer to inject button when ready
        // Observer will also re-check blocking when element appears (with fresh data)
        console.log("[FT] Setting up button injection observer for current page");
        setupButtonInjectionObserver(channel);
      } catch (e) {
        console.warn("[FT] Error checking blocked channels (fast path):", e.message);
        // Continue with normal flow if check fails
      }
    }
    
    // Start 45-second watch timer for AI classification
    if (videoId && videoId !== currentWatchVideoId) {
      // New video - reset tracking
      if (videoWatchTimer) {
        clearTimeout(videoWatchTimer);
        videoWatchTimer = null;
      }
      currentWatchVideoId = videoId;
      videoWatchStartTime = Date.now();
      videoClassified = false;
      journalNudgeShown = false;
      currentVideoAIClassification = null;
      
           // Only start journal nudge timer for Pro/Trial users
      // Check plan before starting timer to avoid unnecessary timers for Free users
      const plan = await getEffectivePlan();
      if (plan === "pro") {
        // Start 1-minute journal nudge timer (only for Pro/Trial)
        // This will show nudge at 60 seconds if content is distracting
        // Timer will be cancelled if content is not distracting when classification returns
        journalNudgeTimer = setTimeout(async () => {
          if (currentWatchVideoId === videoId && !journalNudgeShown) {
            // Check if we have classification yet
            if (currentVideoAIClassification) {
              const distraction = currentVideoAIClassification.distraction_level || 
                                currentVideoAIClassification.category || "neutral";
              if (distraction === "distracting") {
                // Extract metadata now for nudge
                const meta = extractVideoMetadata();
                if (meta) {
                  meta.video_id = videoId;
                  meta.url = location.href;
                }
                showJournalNudge(meta || { title: "this video" });
              }
            } else {
              // Classification hasn't returned yet - wait a bit more and check again
              // This handles case where classification is slow
              console.log("[FT] Journal nudge timer fired but classification not ready, waiting 5 more seconds...");
              setTimeout(async () => {
                if (currentWatchVideoId === videoId && 
                    currentVideoAIClassification && 
                    !journalNudgeShown) {
                  const distraction = currentVideoAIClassification.distraction_level || 
                                    currentVideoAIClassification.category || "neutral";
                  if (distraction === "distracting") {
                    const meta = extractVideoMetadata();
                    if (meta) {
                      meta.video_id = videoId;
                      meta.url = location.href;
                    }
                    showJournalNudge(meta || { title: "this video" });
                  }
                }
              }, 5 * 1000); // Wait 5 more seconds
            }
          }
        }, 60 * 1000); // 1 minute from video start
      }
      
      // Start 45-second timer (non-blocking)
      // Note: videoMetadata will be extracted later in the function, so we'll extract it in the timeout
      videoWatchTimer = setTimeout(async () => {
        if (currentWatchVideoId === videoId && !videoClassified) {
          // Still on same video and not yet classified
          try {
            // Extract metadata now (videoMetadata from outer scope may not be ready yet)
            let meta = extractVideoMetadata();
            if (meta) {
              meta.video_id = videoId;
              meta.url = location.href;
            }
            
            if (meta && meta.video_id && meta.title) {
              // Send classification request to background (non-blocking)
              chrome.runtime.sendMessage({
                type: "FT_CLASSIFY_VIDEO",
                videoMetadata: meta,
              }).then((response) => {
                if (response?.ok && response?.classification) {
                  console.log("[FT] Video classified after 45s:", {
                    video_id: videoId.substring(0, 10),
                    category: response.classification.category_primary || response.classification.category,
                    distraction: response.classification.distraction_level || response.classification.category,
                  });
                  videoClassified = true;
                }
              }).catch((err) => {
                console.warn("[FT] Error classifying video:", err.message);
              });
            } else {
              console.warn("[FT] Could not extract metadata for 45s classification:", { videoId, hasMeta: !!meta });
            }
          } catch (e) {
            console.warn("[FT] Error in 45s classification trigger:", e.message);
          }
        }
      }, 45 * 1000); // 45 seconds
    } else if (videoId === currentWatchVideoId && videoClassified) {
      // Same video, already classified - do nothing
    }
    
    // Extract metadata from meta tags immediately (instant, no wait)
    try {
      const videoId = extractVideoIdFromUrl();
      if (!videoId) {
        console.warn("[FT] No video ID found, skipping metadata extraction");
        // Continue to background decision check even without video ID
      } else {
        // Extract everything from meta tags immediately (instant)
        // Improved title extraction with multiple fallbacks
        const extractTitle = () => {
          // Method 1: Meta tag (fastest, but may be stale on SPA navigation)
          const metaTitle = document.querySelector('meta[property="og:title"]');
          if (metaTitle) {
            const metaTitleContent = metaTitle.getAttribute("content")?.trim();
            if (metaTitleContent && metaTitleContent !== "YouTube") {
              return metaTitleContent;
            }
          }
          
          // Method 2: DOM h1 element (more reliable on SPA navigation)
          const titleElement = document.querySelector("h1.ytd-watch-metadata yt-formatted-string, h1.ytd-video-primary-info-renderer, h1.title, ytd-watch-metadata h1");
          if (titleElement) {
            const titleText = titleElement.textContent?.trim();
            if (titleText && titleText !== "YouTube") {
              return titleText;
            }
          }
          
          // Method 3: yt-formatted-string in watch metadata
          const formattedTitle = document.querySelector("ytd-watch-metadata yt-formatted-string#text, ytd-watch-metadata yt-formatted-string");
          if (formattedTitle) {
            const formattedText = formattedTitle.textContent?.trim();
            if (formattedText && formattedText !== "YouTube") {
              return formattedText;
            }
          }
          
          return null;
        };
        
        videoMetadata = {
          video_id: videoId,
          title: extractTitle(),
          description: document.querySelector('meta[property="og:description"]')?.getAttribute("content")?.trim()?.substring(0, 500) || null,
          channel: extractChannelFast(), // Already uses meta tags first
          tags: Array.from(document.querySelectorAll('meta[property="og:video:tag"]')).map(el => el.getAttribute("content")?.trim()).filter(Boolean),
          category: document.querySelector('meta[itemprop="genre"]')?.getAttribute("content")?.trim() || null, // Try meta tag first
          related_videos: [], // Optional, can be empty
          duration_seconds: null, // Optional, can be null
          is_shorts: location.pathname.startsWith("/shorts/") || location.pathname.includes("/shorts/"),
          url: location.href
        };

        // If title/channel missing, wait 1s and retry with DOM elements (for SPA navigation lag)
        if ((!videoMetadata.title || !videoMetadata.channel) && videoId) {
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Increased to 1s for better reliability
          
          // Retry title extraction with DOM elements (more reliable after SPA navigation)
          if (!videoMetadata.title) {
            const titleElement = document.querySelector("h1.ytd-watch-metadata yt-formatted-string, h1.ytd-video-primary-info-renderer, h1.title, ytd-watch-metadata h1");
            if (titleElement) {
              videoMetadata.title = titleElement.textContent?.trim() || null;
            }
            // Fallback to meta tag if DOM still doesn't have it
            if (!videoMetadata.title) {
              const metaTitle = document.querySelector('meta[property="og:title"]');
              if (metaTitle) {
                videoMetadata.title = metaTitle.getAttribute("content")?.trim() || null;
              }
            }
          }
          
          if (!videoMetadata.channel) {
            videoMetadata.channel = extractChannelFast();
          }
        }

        // Verify we have minimum required fields (title is required for AI)
        if (videoMetadata.video_id && videoMetadata.title) {
          console.log("[FT] ✅ Metadata extracted from meta tags (instant):", {
            video_id: videoMetadata.video_id,
            title: videoMetadata.title?.substring(0, 50),
            channel: videoMetadata.channel || "MISSING",
            has_description: !!videoMetadata.description,
            category: videoMetadata.category || "MISSING",
            tags_count: videoMetadata.tags.length
          });

          // Send to AI immediately (non-blocking) - blocking is already done via fast path
          chrome.runtime.sendMessage({
            type: "FT_CLASSIFY_VIDEO",
            videoMetadata: videoMetadata,
          }).then((response) => {
            if (response?.ok && response?.classification) {
              console.log("[FT] Video classified (initial):", {
                video_id: videoId.substring(0, 10),
                category: response.classification.category_primary || response.classification.category,
                distraction: response.classification.distraction_level || response.classification.category,
              });
              videoClassified = true;
              currentVideoAIClassification = response.classification;
            }
          }).catch((err) => {
            console.warn("[FT] Error classifying video:", err.message);
          });

          // Background: Try to get category from DOM for up to 5 seconds (non-blocking)
          // This enriches metadata but doesn't block the user experience
          if (!videoMetadata.category || videoMetadata.category === "MISSING") {
            (async () => {
              const maxAttempts = 10; // 5 seconds max (10 × 500ms)
              let categoryFound = null;

              for (let attempt = 0; attempt < maxAttempts; attempt++) {
                // Check if video ID changed (user navigated away)
                const currentVideoId = extractVideoIdFromUrl();
                if (currentVideoId !== videoId) {
                  console.log("[FT] Video ID changed during category fetch, stopping");
                  return;
                }

                // Try to extract category from DOM
                const latestMetadata = extractVideoMetadata();
                const latestCategory = latestMetadata?.category && latestMetadata.category !== "MISSING" ? latestMetadata.category : null;

                if (latestCategory) {
                  categoryFound = latestCategory;
                  console.log(`[FT] ✅ Category found in background (attempt ${attempt + 1}): ${latestCategory}`);
                  
                  // Update metadata (for future reference, but AI already classified)
                  videoMetadata.category = latestCategory;
                  
                  // Optional: If AI hasn't responded yet, we could update the classification
                  // But since category is optional, we'll just log it
                  break;
                }

                // Wait 500ms before next attempt
                if (attempt < maxAttempts - 1) {
                  await new Promise((resolve) => setTimeout(resolve, 500));
                }
              }

              if (!categoryFound) {
                console.log("[FT] Category not found after 5s background search (optional field)");
              }
            })(); // Fire and forget - runs in background
          }
        } else {
          console.warn("[FT] Missing required metadata (title or video_id):", {
            has_video_id: !!videoMetadata.video_id,
            has_title: !!videoMetadata.title
          });
        }
      }
    } catch (e) {
      console.warn("[FT] Error extracting metadata from meta tags:", e.message);
    }
  }

  // Ask background for a decision
  let resp;
  try {
    if (!isChromeContextValid()) {
      // Extension context invalidated - silently return, no need to log
      return;
    }
    
    // Phase 1: Log before sending to background
    LOG("[FT DEBUG] Sending to background:", {
      pageType,
      url: location.href,
      videoMetadata: videoMetadata ? {
        video_id: videoMetadata.video_id,
        title: videoMetadata.title?.substring(0, 50),
        url: videoMetadata.url
      } : null
    });
    
    resp = await chrome.runtime.sendMessage({
      type: "FT_NAVIGATED",
      pageType,
      url: location.href,
      videoMetadata: videoMetadata // Pass full video metadata for AI classification (Pro users only)
    });
    
    // Log response for debugging
    if (resp && resp.blocked && resp.reason === "channel_blocked") {
      console.log("[FT] 🚫 Background says channel is blocked:", {
        channel: videoMetadata?.channel,
        reason: resp.reason,
        scope: resp.scope
      });
    }
    
    // Immediate console log for AI classification results with validation
    if (resp && resp.aiClassification) {
      const ai = resp.aiClassification;
      const category = ai.category_primary || ai.category || "unknown";
      const distraction = ai.distraction_level || ai.category || "neutral";
      const confidence = ai.confidence_distraction || ai.confidence || 0.5;
      const responseVideoId = ai.video_id || "unknown";
      const currentVideoId = videoMetadata?.video_id || extractVideoIdFromUrl() || "unknown";
      
      // Store AI classification for journal nudge (if video ID matches)
      if (responseVideoId === currentVideoId && responseVideoId !== "unknown") {
        currentVideoAIClassification = ai;
        
        // Start behavior loop awareness tracking for this video
        if (pageType === "WATCH" && currentVideoId) {
          startBehaviorLoopTracking(currentVideoId, ai);
        }
        
        // Check if content is distracting - if not, cancel the journal nudge timer
        getEffectivePlan().then(plan => {
          const isDistracting = (distraction === "distracting" || category === "distracting");
          const isProOrTrial = plan === "pro";
          
          // If not distracting or not Pro/Trial, cancel the nudge timer
          if (!isDistracting || !isProOrTrial) {
            if (journalNudgeTimer) {
              clearTimeout(journalNudgeTimer);
              journalNudgeTimer = null;
              console.log("[FT] Journal nudge cancelled - content not distracting or not Pro plan");
            }
          } else {
            // Content is distracting and Pro/Trial - timer already running from video start
            // Check if we've already passed 1 minute (classification came back late)
            const timeSinceVideoStart = Date.now() - (videoWatchStartTime || Date.now());
            if (timeSinceVideoStart >= 60 * 1000 && !journalNudgeShown) {
              // Already past 1 minute, show nudge immediately
              console.log("[FT] Classification came back after 1 minute, showing journal nudge immediately");
              if (journalNudgeTimer) {
                clearTimeout(journalNudgeTimer);
                journalNudgeTimer = null;
              }
              showJournalNudge(videoMetadata);
            } else {
              console.log(`[FT] Journal nudge timer active - will show in ${Math.max(0, 60 - Math.floor(timeSinceVideoStart / 1000))} seconds`);
            }
          }
        }).catch((err) => {
          console.warn("[FT] Error checking plan for journal nudge:", err);
        });
      }
      
      // Always log AI classification (for visibility)
      // Validate video_id matches for blocking decisions, but still show tag
      if (responseVideoId === currentVideoId && responseVideoId !== "unknown") {
        console.log(`[FT] AI: ${category} → ${distraction} (${(confidence * 100).toFixed(0)}%) [${currentVideoId}]`);
      } else {
        console.warn(`[FT] ⚠️ AI Classification mismatch (may be from previous video):`, {
          responseVideoId,
          currentVideoId,
          category,
          distraction,
          confidence: `${(confidence * 100).toFixed(0)}%`
        });
        console.log(`[FT] AI Tag (mismatch): ${category} → ${distraction} (${(confidence * 100).toFixed(0)}%)`);
        // Keep classification for dev panel visibility, but mark as potentially stale
        // Don't clear it - let dev panel show it for debugging
      }
    }
    
    if (chrome.runtime.lastError) {
      if (!isChromeContextValid()) {
        // Extension context invalidated - silently return
        return;
      }
      console.warn("[FT] Failed to get navigation decision:", chrome.runtime.lastError.message);
      return;
    }
  } catch (e) {
    if (!isChromeContextValid()) {
      // Extension context invalidated - silently return, no need to log
      return;
    }
    // Only log non-context-invalidation errors
    const isContextError = e.message?.includes("Extension context invalidated") || 
                          e.message?.includes("context invalidated");
    if (!isContextError) {
      console.warn("[FT] Error sending navigation message:", e.message);
    }
    return;
  }

  console.log("[FT content] background response:", resp);

  if (!resp?.ok) return;

  // Handle global watch time counter (show on all pages)
  const watchSecondsToday = resp.counters?.watchSeconds || 0;
  await showGlobalTimeCounter(watchSecondsToday);

  // Handle search counter badge (show on all search pages)
  if (pageType === "SEARCH") {
    // Get search limit from plan config (Free: 5, Pro: 15)
    const searchLimit = resp.plan === "pro" ? 15 : 5;
    const searchesToday = resp.counters?.searches || 0;
    
    // Show or update search counter
    await showSearchCounter(searchesToday, searchLimit, resp.plan);
    
    // Check for warning at threshold - 2
    await checkAndShowSearchWarning(searchesToday, searchLimit);
    
    // Remove search counter if blocked (will be replaced by overlay)
    if (resp.blocked) {
      removeSearchCounter();
    }
  } else {
    // Remove search counter when not on search page
    removeSearchCounter();
  }

  // Handle Pro plan Shorts counter badge (only on Shorts pages, not blocked)
  if (pageType === "SHORTS" && resp.plan === "pro" && !resp.blocked) {
    // If we were already tracking, save accumulated time before updating badge
    if (shortsTimeTracker) {
      await stopShortsTimeTracking();
      // Wait a moment to ensure save completes
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    // Re-read counters after save to get latest values
    let latestEngaged, latestScrolled, latestSeconds;
    try {
      const { ft_shorts_engaged_today, ft_short_visits_today, ft_shorts_seconds_today } = await chrome.storage.local.get([
        "ft_shorts_engaged_today",
        "ft_short_visits_today",
        "ft_shorts_seconds_today"
      ]);
      if (chrome.runtime.lastError) {
        console.warn("[FT] Failed to get badge counters:", chrome.runtime.lastError.message);
        // Use last known values instead of (0, 0, 0) to prevent false display
        latestEngaged = lastKnownBadgeValues.engaged;
        latestScrolled = lastKnownBadgeValues.scrolled;
        latestSeconds = lastKnownBadgeValues.seconds;
      } else {
        // Storage read succeeded - update last known values
        latestEngaged = Number(ft_shorts_engaged_today || 0);
        latestScrolled = Number(ft_short_visits_today || 0);
        latestSeconds = Number(ft_shorts_seconds_today || 0);
        // Update last known values only when storage read succeeds
        lastKnownBadgeValues.engaged = latestEngaged;
        lastKnownBadgeValues.scrolled = latestScrolled;
        lastKnownBadgeValues.seconds = latestSeconds;
      }
    } catch (e) {
      console.warn("[FT] Error getting badge counters:", e.message);
      // Use last known values instead of (0, 0, 0) to prevent false display
      latestEngaged = lastKnownBadgeValues.engaged;
      latestScrolled = lastKnownBadgeValues.scrolled;
      latestSeconds = lastKnownBadgeValues.seconds;
    }
    
    // Show badge with latest counters
    await showShortsBadge(latestEngaged, latestScrolled, latestSeconds);
    // Start tracking time (fresh start with latest counters)
    await startShortsTimeTracking();
    // Start engagement tracking (5-second timer for engaged count)
    await startShortsEngagementTracking();
  } else {
    // Not on Shorts or not Pro plan - remove badge and stop tracking
    removeShortsBadge();
    await stopShortsTimeTracking();
  }

  // Clean up video watch timer when leaving WATCH page
  if (pageType !== "WATCH") {
    if (videoWatchTimer) {
      clearTimeout(videoWatchTimer);
      videoWatchTimer = null;
    }
    if (journalNudgeTimer) {
      clearTimeout(journalNudgeTimer);
      journalNudgeTimer = null;
    }
    // Stop behavior loop tracking when leaving WATCH page
    await stopBehaviorLoopTracking();
    currentWatchVideoId = null;
    videoWatchStartTime = null;
    journalNudgeShown = false;
    currentVideoAIClassification = null;
    videoClassified = false;
    // Stop focus window check when leaving WATCH page
    stopFocusWindowCheck();
  } else {
    // On WATCH page - check if we need to stop previous video tracking
    const currentVideoId = videoMetadata?.video_id || extractVideoIdFromUrl();
    if (currentVideoId && currentVideoId !== currentWatchVideoId) {
      // New video - stop tracking previous video
      await stopBehaviorLoopTracking();
    }
  }

  // Handle AI classification popup (show before checking blocked status)
  // Only show popup if content is NOT blocked (blocked content shows different overlay)
  if (!resp.blocked && resp.aiClassification && resp.aiClassification.category === "distracting") {
    const actionHint = resp.aiClassification.action_hint || "allow";
    const allowanceVideosLeft = resp.counters?.allowanceVideosLeft || 0;
    const allowanceSecondsLeft = resp.counters?.allowanceSecondsLeft || 0;
    
    // COMMENTED OUT: AI distracting popup - to be replaced with nudge/hide/remove per user request
    // Show popup if:
    // - action_hint is "soft-warn" OR
    // - content is distracting but allowed (has allowance and not blocked)
    /*
    if (actionHint === "soft-warn" || (actionHint !== "block" && (allowanceVideosLeft > 0 || allowanceSecondsLeft > 0))) {
      // Don't show if already showing popup or overlay
      if (!document.getElementById("ft-overlay") && !document.getElementById("ft-ai-distracting-popup")) {
        await showAIDistractingPopup(resp.aiClassification, {
          allowanceVideosLeft,
          allowanceSecondsLeft
        });
      }
    }
    */
  }

  // Update dev panel with AI classification results (only if valid)
  // Dev panel disabled - removed per user request
  // const devPanel = document.getElementById("ft-dev-toggle");
  // if (devPanel && resp.aiClassification) {
  //   // Validate video_id before updating dev panel
  //   const responseVideoId = resp.aiClassification.video_id;
  //   const currentVideoId = videoMetadata?.video_id || extractVideoIdFromUrl();
  //   if (responseVideoId === currentVideoId) {
  //     await updateDevPanelStatus(devPanel, resp.aiClassification);
  //   } else {
  //     console.warn("[FT] Dev panel: Classification video_id mismatch, not updating");
  //   }
  // }

  // Handle focus window blocking (before other checks)
  if (resp.blocked && resp.reason === "outside_focus_window" && resp.focusWindowInfo) {
    console.log("[FT] 🕐 Outside focus window, showing overlay");
    showFocusWindowOverlay(resp.focusWindowInfo);
    pauseVideos();
    await stopShortsTimeTracking();
    // Start periodic check to catch time changes during video playback
    startFocusWindowCheck();
    return; // Don't continue with other blocking logic
  } else {
    // User is no longer outside focus window - remove overlay and restore scroll
    removeFocusWindowOverlay();
    // If on WATCH page, start periodic check to catch time changes
    if (pageType === "WATCH") {
      startFocusWindowCheck();
    } else {
      stopFocusWindowCheck();
    }
  }

  // Handle spiral detection (before blocking checks)
  if (resp.reason === "spiral_detected" && resp.spiralInfo) {
    console.log("[FT] 🚨 Spiral detected, showing nudge:", resp.spiralInfo);
    showSpiralNudge(resp.spiralInfo);
    // Don't return - continue to check for blocking
  }

  // Handle channel blocking (both permanent and temporary) - after focus window check
  if (resp.blocked && (resp.reason === "channel_blocked" || resp.reason === "channel_blocked_today")) {
    await stopShortsTimeTracking();
    pauseAndMuteVideo(); // Immediate pause
    
    const channelName = videoMetadata?.channel || extractChannelFast() || "This channel";
    console.log(`[FT] 🚫 Channel blocked (${resp.reason}) - showing overlay then redirecting`);
    
    showChannelBlockedOverlay(channelName);
    return; // Don't continue with other blocking logic
  }

  if (resp.blocked) {
    pauseVideos();
    await stopShortsTimeTracking(); // Stop tracking if blocked

    // Shorts-specific: set redirect flag, then redirect to home if blocked
    if (resp.scope === "shorts") {
      // Set flag so home page knows to show overlay
      try {
        chrome.storage.local.set({ ft_redirected_from_shorts: true }, () => {
          if (chrome.runtime.lastError) {
            console.warn("[FT] Failed to set redirect flag:", chrome.runtime.lastError.message);
          }
        });
      } catch (e) {
        console.warn("[FT] Error setting redirect flag:", e.message);
      }
      window.location.href = "https://www.youtube.com/";
      return;
    }

    // Search blocking: show search-specific overlay with plan-specific buttons
   
    if (resp.scope === "search") {
      if (!document.getElementById("ft-overlay")) {
        await showSearchBlockOverlay(resp.plan || "free");
      }
    } 
   
    // Watch/AI blocking: show generic overlay for AI-blocked videos
    // COMMENTED OUT: Generic overlay removed per user request
    /*
    else if (resp.scope === "watch") {
      if (!document.getElementById("ft-overlay")) {
        // Show generic block overlay for AI-blocked videos
        showOverlay(resp.reason || "ai_distracting_blocked", "watch");
      }
    }
    */
    // Global blocking: show global limit overlay with daily summary
    if (resp.scope === "global" && !document.getElementById("ft-overlay")) {
      await showGlobalLimitOverlay(resp.plan || "free", resp.counters || {});
    }
  } else {
    removeOverlay(); // clear if allowed
    removeFocusWindowOverlay(); // Also remove focus window overlay if present
  }

  // Inject "Block Channel" button on watch pages (if channel is not already blocked)
  // Use observer approach for reliable injection (Pro users only)
  if (pageType === "WATCH" && videoMetadata && videoMetadata.channel) {
    try {
      // Only show block channel button for Pro users
      const plan = await getEffectivePlan();
      if (plan === "pro") {
        const channelName = videoMetadata.channel.trim(); // Use exact name from metadata
        // Set up observer - it will check blocking and inject button when element appears
        console.log("[FT] Setting up button injection observer (slow path) for:", channelName);
        setupButtonInjectionObserver(channelName);
      } else {
        console.log("[FT] Block channel button hidden (Free plan)");
      }
    } catch (e) {
      console.warn("[FT] Error setting up button injection observer:", e.message);
    }
  }
}

async function updateDevPanelStatus(panel, aiClassificationFromResponse = null) {
  try {
    if (!isChromeContextValid()) return;
    
    const { ft_plan, ft_user_email, ft_user_goals, ft_last_watch_classification, ft_last_search_classification } = await chrome.storage.local.get([
      "ft_plan",
      "ft_user_email",
      "ft_user_goals",
      "ft_last_watch_classification",
      "ft_last_search_classification"
    ]);
    if (chrome.runtime.lastError) {
      console.warn("[FT] Failed to get dev panel status:", chrome.runtime.lastError.message);
      return;
    }
    
    // Get latest AI classification (prefer response data if available, then storage)
    const latestClassification = (aiClassificationFromResponse !== null && aiClassificationFromResponse !== undefined) 
      ? aiClassificationFromResponse 
      : (ft_last_watch_classification || ft_last_search_classification || null);
    
    // Update status display
    const statusEl = panel.querySelector("#ft-status");
    if (statusEl) {
      const emailText = ft_user_email && ft_user_email.trim() !== "" ? ft_user_email : "Not set";
      const planText = ft_plan || "free";
      const goalsText = ft_user_goals && Array.isArray(ft_user_goals) && ft_user_goals.length > 0 
        ? ft_user_goals.join(", ") 
        : "Not set";
      statusEl.innerHTML = `
        <div>Email: ${emailText}</div>
        <div style="margin-top:4px;font-size:11px;">Plan: ${planText}</div>
        <div style="margin-top:4px;font-size:11px;">Goals: ${goalsText}</div>
      `;
    }
    
    // Update AI classification box
    const aiBoxEl = panel.querySelector("#ft-ai-classification");
    if (aiBoxEl) {
      if (latestClassification) {
        // New schema fields
        const categoryPrimary = latestClassification.category_primary || latestClassification.category || "Other";
        const categorySecondary = latestClassification.category_secondary || [];
        const distractionLevel = latestClassification.distraction_level || latestClassification.category || "neutral";
        const confidenceCategory = latestClassification.confidence_category || latestClassification.confidence || 0.5;
        const confidenceDistraction = latestClassification.confidence_distraction || latestClassification.confidence || 0.5;
        const goalsAlignment = latestClassification.goals_alignment || "unknown";
        const reasons = Array.isArray(latestClassification.reasons) ? latestClassification.reasons : (latestClassification.reason ? [latestClassification.reason] : ["No reason provided"]);
        const suggestionsSummary = latestClassification.suggestions_summary || { on_goal_ratio: 0.0, shorts_ratio: 0.0, dominant_themes: [] };
        const flags = latestClassification.flags || { is_shorts: false, clickbait_likelihood: 0.0, time_sink_risk: 0.0 };
        
        // Old schema fields (for compatibility)
        const category = latestClassification.category || distractionLevel;
        const confidence = latestClassification.confidence || confidenceDistraction;
        const reason = Array.isArray(latestClassification.reasons) ? latestClassification.reasons.join("; ") : (latestClassification.reason || "No reason provided");
        const tags = latestClassification.suggestions_summary?.dominant_themes || latestClassification.tags || [];
        const blockReasonCode = latestClassification.block_reason_code || "ok";
        const actionHint = latestClassification.action_hint || "allow";
        const allowanceCost = latestClassification.allowance_cost || { type: "none", amount: 0 };
        
        // Color coding for distraction level
        let distractionColor = "#ccc"; // neutral
        if (distractionLevel === "productive") distractionColor = "#4ade80"; // green
        else if (distractionLevel === "distracting") distractionColor = "#ef4444"; // red
        
        // Goals alignment color
        let alignmentColor = "#ccc";
        if (goalsAlignment === "aligned") alignmentColor = "#4ade80";
        else if (goalsAlignment === "partially_aligned") alignmentColor = "#fbbf24";
        else if (goalsAlignment === "misaligned") alignmentColor = "#ef4444";
        
        aiBoxEl.innerHTML = `
          <div style="margin-top:8px;padding:8px;background:rgba(255,255,255,0.05);border-radius:6px;font-size:11px;">
            <div style="font-weight:600;margin-bottom:6px;">AI Classification:</div>
            <div style="margin:4px 0;"><span style="color:${distractionColor};">Category:</span> ${categoryPrimary}${categorySecondary.length > 0 ? ` (${categorySecondary.join(", ")})` : ''}</div>
            <div style="margin:4px 0;"><span style="color:${distractionColor};">Distraction:</span> ${distractionLevel}</div>
            <div style="margin:4px 0;"><span style="color:${alignmentColor};">Goals:</span> ${goalsAlignment}</div>
            <div style="margin:4px 0;font-size:10px;">Confidence: ${(confidenceCategory * 100).toFixed(0)}% (category) / ${(confidenceDistraction * 100).toFixed(0)}% (distraction)</div>
            ${reasons.length > 0 ? `<div style="margin:4px 0;font-size:10px;opacity:0.9;">Reasons: ${reasons.map(r => `• ${r}`).join(" ")}</div>` : ''}
            ${tags.length > 0 ? `<div style="margin:4px 0;font-size:10px;opacity:0.8;">Themes: ${tags.join(", ")}</div>` : ''}
            <div style="margin:4px 0;font-size:10px;opacity:0.8;">Suggestions: ${(suggestionsSummary.on_goal_ratio * 100).toFixed(0)}% on-goal, ${(suggestionsSummary.shorts_ratio * 100).toFixed(0)}% Shorts</div>
            <div style="margin:4px 0;font-size:10px;opacity:0.8;">Flags: Clickbait ${(flags.clickbait_likelihood * 100).toFixed(0)}%, Time Sink ${(flags.time_sink_risk * 100).toFixed(0)}%</div>
            <div style="margin:4px 0;font-size:10px;opacity:0.8;">Action: ${actionHint} | Code: ${blockReasonCode}</div>
            <div style="margin:4px 0;font-size:10px;opacity:0.8;">Cost: ${allowanceCost.type} (${allowanceCost.amount})</div>
          </div>
        `;
      } else {
        aiBoxEl.innerHTML = `
          <div style="margin-top:8px;padding:8px;background:rgba(255,255,255,0.05);border-radius:6px;font-size:11px;opacity:0.6;">
            <div style="font-weight:600;margin-bottom:6px;">AI Classification:</div>
            <div style="font-size:10px;">No classification yet</div>
          </div>
        `;
      }
    }
    
    // Update email input value
    const emailInput = panel.querySelector("#ft-email-input");
    if (emailInput) {
      emailInput.value = ft_user_email || "";
    }
    
    // Update plan selector to match current plan
    const planSelect = panel.querySelector("#ft-plan-select");
    if (planSelect) {
      planSelect.value = ft_plan || "free";
    }
    
    // Update goals input value
    const goalsInput = panel.querySelector("#ft-goals-input");
    if (goalsInput) {
      const goalsArray = ft_user_goals && Array.isArray(ft_user_goals) ? ft_user_goals : [];
      goalsInput.value = goalsArray.join(", ");
    }
  } catch (err) {
    console.warn("[FT content] Could not update dev panel status:", err);
  }
}

// ─────────────────────────────────────────────────────────────
// DEV TOGGLE PANEL
// ─────────────────────────────────────────────────────────────
function injectDevToggle() {
  // Avoid duplicates
  if (document.getElementById("ft-dev-toggle")) return;

  const panel = document.createElement("div");
  panel.id = "ft-dev-toggle";
  panel.style.position = "fixed";
  panel.style.bottom = "15px";
  panel.style.right = "15px";
  panel.style.zIndex = "2147483648";
  panel.style.pointerEvents = "auto";
  panel.style.background = "rgba(20,20,20,0.85)";
  panel.style.color = "white";
  panel.style.padding = "10px 14px";
  panel.style.borderRadius = "10px";
  panel.style.fontFamily = "Arial, sans-serif";
  panel.style.fontSize = "14px";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.gap = "6px";
  panel.style.cursor = "pointer";
  panel.style.userSelect = "none";
  panel.innerHTML = `
  <strong>FocusTube Dev</strong>
  <div style="margin-top:8px;">
    <input type="email" id="ft-email-input" placeholder="Enter email" style="width:100%;padding:4px;margin-bottom:4px;border-radius:4px;border:none;font-size:12px;background:rgba(255,255,255,0.1);color:white;box-sizing:border-box;">
    <button id="ft-save-email" style="width:100%;margin-bottom:4px;font-size:11px;padding:4px;">Save Email</button>
    <div style="display:flex;gap:4px;margin-bottom:4px;">
      <select id="ft-plan-select" style="flex:1;padding:4px;border-radius:4px;border:none;font-size:12px;background:rgba(255,255,255,0.1);color:white;">
        <option value="free">Free</option>
        <option value="pro">Pro</option>
      </select>
      <button id="ft-set-plan" style="flex:1;font-size:11px;padding:4px;">Set Plan</button>
    </div>
    <textarea id="ft-goals-input" placeholder="Enter goals (comma-separated)" style="width:100%;padding:4px;margin-bottom:4px;border-radius:4px;border:none;font-size:11px;background:rgba(255,255,255,0.1);color:white;resize:vertical;min-height:40px;font-family:inherit;box-sizing:border-box;"></textarea>
    <button id="ft-save-goals" style="width:100%;margin-bottom:4px;font-size:11px;padding:4px;">Save Goals</button>
    <button id="ft-reset-counters" style="width:100%;margin-bottom:4px;font-size:11px;padding:4px;background:#ef4444;">Reset Counters</button>
    <button id="ft-test-reset" style="width:100%;margin-bottom:4px;font-size:11px;padding:4px;background:#8b5cf6;">Test Daily Reset</button>
  </div>
  <div id="ft-status" style="margin-top:6px;font-size:12px;opacity:0.8;"></div>
  <div id="ft-ai-classification"></div>
`;

  // Click handlers — these send messages to background.js
  // Email save handler (just saves email, no sync)
  panel.querySelector("#ft-save-email").onclick = async () => {
    console.log("[FT] Save Email button clicked");
    try {
      if (!chrome?.runtime?.id) {
        console.error("[FT] Chrome runtime not available");
        alert("Extension context invalidated. Please reload the page.");
        return;
      }
      
      const emailInput = panel.querySelector("#ft-email-input");
      const email = emailInput?.value?.trim() || "";
      
      if (!email) {
        alert("Please enter an email address");
        return;
      }
      
      console.log("[FT] Saving email:", email);
      const response = await chrome.runtime.sendMessage({ 
        type: "FT_SET_EMAIL", 
        email: email 
      });
      console.log("[FT] Save Email response:", response);
      
      if (response?.ok) {
      await updateDevPanelStatus(panel);
        console.log("[FT content] Email saved successfully");
        alert("Email saved successfully!");
      } else {
        console.warn("[FT] Save Email failed:", response?.error);
        alert(response?.error || "Failed to save email");
      }
    } catch (err) {
      console.error("[FT content] Error saving email:", err);
      alert("Error saving email: " + (err.message || String(err)));
    }
  };
  
  // Set Plan handler (updates Supabase, then syncs)
  panel.querySelector("#ft-set-plan").onclick = async () => {
    console.log("[FT] Set Plan button clicked");
    try {
      if (!chrome?.runtime?.id) {
        console.error("[FT] Chrome runtime not available");
        alert("Extension context invalidated. Please reload the page.");
        return;
      }
      
      const planSelect = panel.querySelector("#ft-plan-select");
      const selectedPlan = planSelect?.value || "free";
      
      const response = await chrome.runtime.sendMessage({ 
        type: "FT_SET_PLAN", 
        plan: selectedPlan 
      });
      console.log("[FT] Set Plan response:", response);
      
      if (response?.ok) {
        await updateDevPanelStatus(panel);
        console.log("[FT content] Plan set and synced successfully");
        alert(`Plan set to ${selectedPlan} and synced!`);
      } else {
        console.warn("[FT] Set Plan failed:", response?.error);
        alert(response?.error || "Failed to set plan");
      }
    } catch (err) {
      console.error("[FT content] Error setting plan:", err);
      alert("Error setting plan: " + (err.message || String(err)));
    }
  };
  
  // Save Goals handler
  panel.querySelector("#ft-save-goals").onclick = async () => {
    console.log("[FT] Save Goals button clicked");
    try {
      if (!chrome?.runtime?.id) {
        console.error("[FT] Chrome runtime not available");
        alert("Extension context invalidated. Please reload the page.");
        return;
      }
      
      const goalsInput = panel.querySelector("#ft-goals-input");
      const goalsText = goalsInput?.value?.trim() || "";
      
      // Parse comma-separated goals into array
      const goalsArray = goalsText
        .split(",")
        .map(g => g.trim())
        .filter(g => g.length > 0);
      
      console.log("[FT] Saving goals:", goalsArray);
      const response = await chrome.runtime.sendMessage({ 
        type: "FT_SET_GOALS", 
        goals: goalsArray 
      });
      console.log("[FT] Save Goals response:", response);
      
      if (response?.ok) {
      await updateDevPanelStatus(panel);
        console.log("[FT content] Goals saved successfully");
        alert(`Goals saved! (${goalsArray.length} goal${goalsArray.length !== 1 ? 's' : ''})`);
      } else {
        console.warn("[FT] Save Goals failed:", response?.error);
        alert(response?.error || "Failed to save goals");
      }
    } catch (err) {
      console.error("[FT content] Error saving goals:", err);
      alert("Error saving goals: " + (err.message || String(err)));
    }
  };
  
  // Reset Counters handler
  panel.querySelector("#ft-reset-counters").onclick = async () => {
    console.log("[FT] Reset Counters button clicked");
    try {
      if (!chrome?.runtime?.id) {
        console.error("[FT] Chrome runtime not available");
        alert("Extension context invalidated. Please reload the page.");
        return;
      }
      
      const response = await chrome.runtime.sendMessage({ type: "FT_RESET_COUNTERS" });
      console.log("[FT] Reset Counters response:", response);
      
      if (response?.ok) {
        await updateDevPanelStatus(panel);
        console.log("[FT content] Counters reset successfully");
        alert("All counters reset!");
      } else {
        console.warn("[FT] Reset Counters failed:", response?.error);
        alert(response?.error || "Failed to reset counters");
      }
    } catch (err) {
      console.error("[FT content] Error resetting counters:", err);
      alert("Error resetting counters: " + (err.message || String(err)));
    }
  };

  // Test Daily Reset handler (simulates overnight reset)
  panel.querySelector("#ft-test-reset").onclick = async () => {
    console.log("[FT] Test Daily Reset button clicked");
    try {
      if (!chrome?.storage?.local) {
        alert("Chrome storage not available");
        return;
      }

      // Set reset key to yesterday (simulates overnight)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = yesterday.toISOString().split('T')[0];

      // Set some fake watch time
      await chrome.storage.local.set({ 
        ft_last_reset_key: yesterdayKey,
        ft_watch_seconds_today: 100
      });

      console.log("✅ Set reset key to yesterday:", yesterdayKey);
      console.log("✅ Set watch time to 100 seconds");
      
      alert(`✅ Test reset set!\n\nReset key: ${yesterdayKey}\nWatch time: 100 seconds\n\nNow REFRESH the page to see the reset detection!`);
      
      // Update status
      await updateDevPanelStatus(panel);
    } catch (err) {
      console.error("[FT content] Error testing reset:", err);
      alert("Error testing reset: " + (err.message || String(err)));
    }
  };

  document.body.appendChild(panel);
  updateDevPanelStatus(panel);
}

// Run once DOM is ready
// Dev panel disabled - removed per user request
// if (document.readyState === "loading") {
//   document.addEventListener("DOMContentLoaded", injectDevToggle);
// } else {
//   injectDevToggle();
// }

// ─────────────────────────────────────────────────────────────
// FULLSCREEN DETECTION (hide search counter in fullscreen)
// ─────────────────────────────────────────────────────────────
function setupFullscreenDetection() {
  // Listen for fullscreen changes (multiple event names for browser compatibility)
  const fullscreenEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
  
  fullscreenEvents.forEach(eventName => {
    document.addEventListener(eventName, () => {
      isFullscreen = !!(document.fullscreenElement || 
                        document.webkitFullscreenElement || 
                        document.mozFullScreenElement || 
                        document.msFullscreenElement);
      
      // Hide search counter in fullscreen
      const searchCounter = document.getElementById("ft-search-counter");
      if (searchCounter) {
        if (isFullscreen) {
          searchCounter.style.display = 'none';
        } else {
          searchCounter.style.display = '';
        }
      }
      
      // Switch global time counter to minimal format in fullscreen
      const globalCounter = document.getElementById("ft-global-time-counter");
      if (globalCounter) {
        try {
          if (!isChromeContextValid()) return;
          
          chrome.storage.local.get(["ft_watch_seconds_today"]).then(storage => {
            if (chrome.runtime.lastError) {
              console.warn("[FT] Failed to get watch time for fullscreen update:", chrome.runtime.lastError.message);
              return;
            }
            const watchSeconds = Number(storage.ft_watch_seconds_today || 0);
            updateGlobalTimeCounter(watchSeconds);
          }).catch(e => {
            console.warn("[FT] Error updating global counter for fullscreen:", e.message);
          });
        } catch (e) {
          console.warn("[FT] Error in fullscreen detection for global counter:", e.message);
        }
      }
    });
  });
}

// Initialize fullscreen detection
setupFullscreenDetection();




// ─────────────────────────────────────────────────────────────
// STORAGE LISTENER (update badge when counters change)
// ─────────────────────────────────────────────────────────────
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== "local") return;
  
  // Re-check blocking when blocked channels change (cross-tab sync)
  if (changes.ft_blocked_channels) {
    const pageType = detectPageType();
    if (pageType === "WATCH") {
      const videoId = extractVideoIdFromUrl();
      const channel = extractChannelFast();
      
      if (channel && videoId) {
        const newBlockedChannels = changes.ft_blocked_channels.newValue || [];
        if (Array.isArray(newBlockedChannels) && newBlockedChannels.length > 0) {
          const channelLower = channel.toLowerCase().trim();
          const isBlocked = newBlockedChannels.some(blocked => {
            const blockedLower = blocked.toLowerCase().trim();
            return blockedLower === channelLower; // Exact match only
          });
          
          if (isBlocked) {
            console.log("[FT] 🚫 Channel blocked (cross-tab sync):", channel);
            
            // Pause video immediately
            pauseAndMuteVideo();
            
            // Show overlay then redirect (same behavior as main handler)
            // If DOM not ready, fallback to immediate redirect
            if (document.body) {
              showChannelBlockedOverlay(channel);
            } else {
              window.location.href = "https://www.youtube.com/";
            }
            
            return; // Stop here, don't continue with other listeners
          }
        }
      }
    }
  }
  
  // Detect daily reset - if reset key changed, reset the global time tracker
  if (changes.ft_last_reset_key) {
    const todayKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const newResetKey = changes.ft_last_reset_key.newValue;
    
    // If reset key changed to today's date, a reset just happened
    if (newResetKey === todayKey && globalTimeTracker && globalTimeStart) {
      console.log("[FT] Daily reset detected via storage change, resetting global time tracker");
      // Re-read the current value (should be 0 or very low after reset)
      chrome.storage.local.get(["ft_watch_seconds_today"]).then(storage => {
        if (!chrome.runtime.lastError && storage.ft_watch_seconds_today !== undefined) {
          // Reset our tracking to match the new value
          globalBaseSeconds = Number(storage.ft_watch_seconds_today || 0);
          globalTimeStart = Date.now();
          lastGlobalSaveTime = Date.now();
        }
      }).catch(e => {
        console.warn("[FT] Error resetting global tracker:", e.message);
      });
    }
  }
  
  // Update global time counter if watch time changed
  if (changes.ft_watch_seconds_today) {
    const badge = document.getElementById("ft-global-time-counter");
    if (badge) {
      if (!isChromeContextValid()) return;
      
      chrome.storage.local.get(["ft_watch_seconds_today"]).then(storage => {
        if (chrome.runtime.lastError) {
          console.warn("[FT] Failed to get watch time in listener:", chrome.runtime.lastError.message);
          return;
        }
        const watchSeconds = Number(storage.ft_watch_seconds_today || 0);
        updateGlobalTimeCounter(watchSeconds);
      }).catch(e => {
        console.warn("[FT] Error in global counter listener:", e.message);
      });
    }
  }
  
  // Update search counter if searches changed
  if (changes.ft_searches_today) {
    const badge = document.getElementById("ft-search-counter");
    if (badge && detectPageType() === "SEARCH") {
      if (!isChromeContextValid()) return;
      
      chrome.storage.local.get(["ft_searches_today", "ft_plan"]).then(async storage => {
        if (chrome.runtime.lastError) {
          console.warn("[FT] Failed to get search counter in listener:", chrome.runtime.lastError.message);
          return;
        }
        const searchesToday = Number(storage.ft_searches_today || 0);
        const plan = await getEffectivePlan();
        const searchLimit = plan === "pro" ? 15 : 5;
        
        updateSearchCounter(searchesToday, searchLimit);
        
        // Check for warning at threshold - 2 and threshold - 1
        checkAndShowSearchWarning(searchesToday, searchLimit);
      }).catch(e => {
        console.warn("[FT] Error in search counter listener:", e.message);
      });
    }
  }
  
  // Update badge if Shorts counters changed
  if (changes.ft_shorts_engaged_today || changes.ft_short_visits_today || changes.ft_shorts_seconds_today) {
    const badge = document.getElementById("ft-shorts-counter");
    if (badge) {
      // Badge exists - get current values and update
      try {
        if (!isChromeContextValid()) return;
        
        chrome.storage.local.get(["ft_shorts_engaged_today", "ft_short_visits_today", "ft_shorts_seconds_today"]).then(storage => {
          if (chrome.runtime.lastError) {
            console.warn("[FT] Failed to get badge counters in listener:", chrome.runtime.lastError.message);
            // Use last known values instead of leaving badge unchanged
            updateShortsBadge(lastKnownBadgeValues.engaged, lastKnownBadgeValues.scrolled, lastKnownBadgeValues.seconds);
            return;
          }
          const engaged = Number(storage.ft_shorts_engaged_today || 0);
          const scrolled = Number(storage.ft_short_visits_today || 0);
          const seconds = Number(storage.ft_shorts_seconds_today || 0);
          // Update last known values when storage read succeeds
          lastKnownBadgeValues.engaged = engaged;
          lastKnownBadgeValues.scrolled = scrolled;
          lastKnownBadgeValues.seconds = seconds;
          updateShortsBadge(engaged, scrolled, seconds);
        }).catch(e => {
          console.warn("[FT] Error in storage listener:", e.message);
          // Use last known values as fallback
          updateShortsBadge(lastKnownBadgeValues.engaged, lastKnownBadgeValues.scrolled, lastKnownBadgeValues.seconds);
        });
      } catch (e) {
        console.warn("[FT] Error in storage listener:", e.message);
      }
    }
  }
  
  // Re-apply hide recommendations when settings change
  if (changes.ft_extension_settings) {
    hideRecommendationsIfEnabled();
  }
});

// ─────────────────────────────────────────────────────────────
// PAGE MONITORING (for YouTube's dynamic navigation)
// ─────────────────────────────────────────────────────────────
// Remove overlay when user navigates via browser back/forward
window.addEventListener("popstate", removeOverlay);

// Save accumulated time when page is about to close or becomes hidden
window.addEventListener("beforeunload", () => {
  if (shortsTimeStart) {
    // Synchronous save before page closes
    saveAccumulatedShortsTime().catch(console.error);
  }
  if (globalTimeStart) {
    saveAccumulatedGlobalTime().catch(console.error);
  }
});

// pagehide is more reliable than beforeunload for async operations
window.addEventListener("pagehide", () => {
  if (shortsTimeStart) {
    // Synchronous save when page is being unloaded
    saveAccumulatedShortsTime().catch(console.error);
  }
  if (globalTimeStart) {
    saveAccumulatedGlobalTime().catch(console.error);
  }
});

document.addEventListener("visibilitychange", () => {
  // Save when page becomes hidden (tab switch, minimize, etc.)
  if (document.hidden && shortsTimeStart) {
    saveAccumulatedShortsTime().catch(console.error);
  }
  if (document.hidden && globalTimeStart) {
    saveAccumulatedGlobalTime().catch(console.error);
  }
});
/**
 * YouTube is a Single-Page App (SPA) — URLs change without full reload.
 * This MutationObserver detects URL or title changes and reruns handleNavigation().
 */
// Debounce helper: wait a short moment before running navigation logic.
// This collapses multiple rapid DOM/URL changes into a single evaluation.
let _ftNavTimer = null;
function scheduleNav(delay = 150) {
  if (_ftNavTimer) clearTimeout(_ftNavTimer);
  _ftNavTimer = setTimeout(() => {
    // Check if context is still valid before calling handleNavigation
    if (!isChromeContextValid()) {
      // Extension context invalidated - clear timer and return
      _ftNavTimer = null;
      return;
    }
    handleNavigation().catch((e) => {
      // Only log if context is still valid (don't log context invalidation errors)
      if (isChromeContextValid()) {
        console.error("[FT] Error in handleNavigation:", e);
      }
    });
  }, delay);
}

let lastUrl = location.href;

// Layer 1: MutationObserver (watches DOM changes)
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    scheduleNav(150); // debounce SPA navigations
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Layer 2: URL polling (catches missed navigations)
setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    scheduleNav(150);
  }
}, 100); // Check every 100ms

// Layer 3: Video ID tracking (most reliable for YouTube)
let lastVideoId = extractVideoIdFromUrl();
setInterval(() => {
  const currentVideoId = extractVideoIdFromUrl();
  if (currentVideoId && currentVideoId !== lastVideoId) {
    lastVideoId = currentVideoId;
    scheduleNav(150);
  }
}, 200); // Check every 200ms

// Layer 4: History API interception (catches programmatic navigation)
const originalPushState = history.pushState;
history.pushState = function(...args) {
  originalPushState.apply(history, args);
  scheduleNav(150);
};

const originalReplaceState = history.replaceState;
history.replaceState = function(...args) {
  originalReplaceState.apply(history, args);
  scheduleNav(150);
};

// Initialize global time tracking (tracks time on all YouTube pages)
// Start tracking immediately when script loads
startGlobalTimeTracking().catch(console.error);

// Ensure block button logic runs on first load
initBlockingButtonBootstrap();

// Initial run (debounced for consistency)
scheduleNav(0);
