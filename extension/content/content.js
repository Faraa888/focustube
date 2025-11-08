// content/content.js
// ROLE: The "eyes and hands" of FocusTube.
// Watches YouTube pages, tells the background what's happening,
// and enforces the decision (pause, overlay, redirect).

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

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
        Shorts are blocked on the Free plan to help you stay focused.
        Upgrade to Pro to watch Shorts with smart tracking and controls.
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
          <li>Sign up for Pro/Trial (14-day free trial)</li>
          <li>Sign in if you already have an account</li>
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
        You have chosen to block Shorts for today and have chosen discipline.
        This decision will help you stay focused and productive.
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

// Video watch time tracking for AI classification (45 seconds trigger)
let videoWatchTimer = null; // Timer for 45-second watch trigger
let currentWatchVideoId = null; // Current video being watched
let videoWatchStartTime = null; // When current video watch started
let videoClassified = false; // Whether current video has been classified

// Journal nudge tracking (1 minute trigger for distracting content)
let journalNudgeTimer = null; // Timer for 1-minute journal nudge trigger
let journalNudgeShown = false; // Whether journal nudge has been shown for current video
let currentVideoAIClassification = null; // Store AI classification for journal nudge check

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
    // 1. Video Title
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

    // 2. Video Description
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

    // 3. Video Tags
    // Try multiple selectors for tags
    const tagElements = document.querySelectorAll(
      'ytd-watch-metadata #container ytd-badge-supported-renderer, ' +
      'meta[property="og:video:tag"], ' +
      'ytd-metadata-row-renderer[has-metadata-layout="COMPACT"] a'
    );
    if (tagElements.length > 0) {
      tagElements.forEach(el => {
        const tagText = el.textContent?.trim() || el.getAttribute("content")?.trim();
        if (tagText && tagText.length > 0) {
          metadata.tags.push(tagText);
        }
      });
    }

    // 4. Channel Name
    const channelElement = document.querySelector("ytd-channel-name a, #owner-sub-count a, ytd-video-owner-renderer #channel-name a");
    if (channelElement) {
      metadata.channel = channelElement.textContent?.trim() || null;
    } else {
      // Fallback: try meta tags
      const metaChannel = document.querySelector('meta[property="og:video:channel_name"], link[itemprop="name"]');
      if (metaChannel) {
        metadata.channel = metaChannel.getAttribute("content")?.trim() || metaChannel.getAttribute("href")?.trim() || null;
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

    // 7. Video Duration
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
        <p class="ft-global-limit-intro">You've reached your daily limit for YouTube use.</p>
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
        <p class="ft-global-limit-message">💬 "You've had your fun. Time to step back!"</p>
        ${buttonsHTML ? `<div class="ft-button-container">${buttonsHTML}</div>` : ''}
      </div>
    </div>
  `;

  // Add button handlers
  const checkUsageBtn = overlay.querySelector("#ft-check-usage");
  if (checkUsageBtn) {
    checkUsageBtn.addEventListener("click", () => {
      // Redirect to dashboard
      window.location.href = "https://focustube.app/dashboard";
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
/*
async function showSearchBlockOverlay(plan) {
  removeOverlay(); // ensure no duplicates

  const overlay = document.createElement("div");
  overlay.id = "ft-overlay";

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
      <h1>FocusTube Active</h1>
      <p id="ft-overlay-message">That's enough searching for today - go and get your dreams</p>
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
*/

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
 * Shows journal nudge popup (1 minute into distracting content)
 * Temporary, dismissible popup asking "What pulled you off track?"
 * @param {Object} videoMetadata - Video metadata (title, channel, url, etc.)
 */
function showJournalNudge(videoMetadata) {
  // Remove any existing journal nudge
  const existingNudge = document.getElementById("ft-journal-nudge");
  if (existingNudge) existingNudge.remove();
  
  // Mark as shown to prevent duplicates
  journalNudgeShown = true;
  
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
        placeholder="What made you click on this? What were you feeling?"
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
      // Get plan and config limits
      const { ft_plan } = await chrome.storage.local.get(["ft_plan"]);
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
        const plan = ft_plan || "free";
        // Get limit from config (2 mins Free = 120s, 3 mins Pro = 180s) - testing values
        const limitSeconds = plan === "pro" ? 180 : 120;
        
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
      const { ft_watch_seconds_today } = await chrome.storage.local.get(["ft_watch_seconds_today"]);
      if (chrome.runtime.lastError) {
        console.warn("[FT] Failed to get global time for save:", chrome.runtime.lastError.message);
        return 0;
      }
      const currentSeconds = Number(ft_watch_seconds_today || 0);
      const newTotal = currentSeconds + elapsed;
      await chrome.storage.local.set({ ft_watch_seconds_today: newTotal });
      if (chrome.runtime.lastError) {
        console.warn("[FT] Failed to save accumulated global time:", chrome.runtime.lastError.message);
        return currentSeconds; // Return old value if save failed
      }
      // Reset start time after successful save
      globalTimeStart = Date.now();
      lastGlobalSaveTime = Date.now();
      return newTotal;
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
  if (msg?.type === "FT_MODE_CHANGED" || msg?.type === "FT_PLAN_CHANGED") {
    console.log(`[FT content] Plan changed → ${msg.plan}`);
    // Clear overlays & force fresh navigation logic
    removeOverlay();
    scheduleNav(0);
  }
});

// ─────────────────────────────────────────────────────────────
// MAIN LOGIC
// ─────────────────────────────────────────────────────────────

/**
 * Core navigation handler — runs whenever the page changes or refreshes.
 * 1. Detects what kind of page we're on
 * 2. Sends message to background for decision
 * 3. Applies result (block / allow)
 */
// Track last extracted URL and video_id for debugging
let lastExtractedUrl = null;
let lastExtractedVideoId = null;

async function handleNavigation() {
  // Guard: make sure Chrome APIs exist before continuing
  if (!chrome?.runtime) {
    console.warn("[FT] chrome.runtime unavailable — skipping navigation check.");
  return;
}
  
  // Debug: Log when handleNavigation is called
  const currentUrl = location.href;
  console.log("[FT DEBUG] handleNavigation() called", { url: currentUrl, timestamp: Date.now() });
  
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
  
  const pageType = detectPageType();

  // Check if we just redirected from Shorts (on home page)
  if (pageType === "HOME") {
    try {
      const { ft_redirected_from_shorts, ft_pro_manual_block_shorts, ft_plan } = await chrome.storage.local.get([
        "ft_redirected_from_shorts",
        "ft_pro_manual_block_shorts",
        "ft_plan"
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
        if (ft_pro_manual_block_shorts && ft_plan === "pro") {
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
    // Start 45-second watch timer for AI classification
    const videoId = extractVideoIdFromUrl();
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
      
      // Start 1-minute journal nudge timer (starts immediately when video starts)
      // This will show nudge at 60 seconds if content is distracting
      // Timer will be cancelled if content is not distracting when classification returns
      journalNudgeTimer = setTimeout(async () => {
        if (currentWatchVideoId === videoId && !journalNudgeShown) {
          // Check if we have classification yet
          if (currentVideoAIClassification) {
            const distraction = currentVideoAIClassification.distraction_level || 
                              currentVideoAIClassification.category || "neutral";
            if (distraction === "distracting") {
              // Check if Pro/Trial plan
              const { ft_plan } = await chrome.storage.local.get(["ft_plan"]);
              if (ft_plan === "pro" || ft_plan === "trial") {
                // Extract metadata now for nudge
                const meta = extractVideoMetadata();
                if (meta) {
                  meta.video_id = videoId;
                  meta.url = location.href;
                }
                showJournalNudge(meta || { title: "this video" });
              }
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
                  const { ft_plan } = await chrome.storage.local.get(["ft_plan"]);
                  if (ft_plan === "pro" || ft_plan === "trial") {
                    const meta = extractVideoMetadata();
                    if (meta) {
                      meta.video_id = videoId;
                      meta.url = location.href;
                    }
                    showJournalNudge(meta || { title: "this video" });
                  }
                }
              }
            }, 5 * 1000); // Wait 5 more seconds
          }
        }
      }, 60 * 1000); // 1 minute from video start
      
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
    try {
      const initialVideoId = extractVideoIdFromUrl();
      console.log("[FT] Starting metadata extraction for video:", initialVideoId);

      await expandDescriptionIfCollapsed(initialVideoId);

      let attempts = 0;
      const maxAttempts = 10; // 5 seconds max (10 × 500ms)

      while (attempts < maxAttempts) {
        videoMetadata = extractVideoMetadata();

        if (videoMetadata) {
          const currentVideoId = extractVideoIdFromUrl();
          videoMetadata.video_id = currentVideoId;
        }

        const allReady = Boolean(
          videoMetadata &&
          videoMetadata.video_id &&
          videoMetadata.title &&
          videoMetadata.channel
        );

        if (allReady) {
          console.log("[FT] ✅ Core metadata ready:", {
            video_id: videoMetadata.video_id,
            title: videoMetadata.title?.substring(0, 50),
            channel: videoMetadata.channel,
            category: videoMetadata.category,
            description_length: videoMetadata.description?.length || 0,
            tags_count: videoMetadata.tags?.length || 0
          });
          break;
        }

        attempts++;
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      if (!videoMetadata || !videoMetadata.video_id || !videoMetadata.title) {
        console.warn("[FT] ⚠️ Metadata incomplete after 5s, proceeding with partial data:", {
          video_id: videoMetadata?.video_id || "MISSING",
          title_present: Boolean(videoMetadata?.title),
          channel_present: Boolean(videoMetadata?.channel),
          category_present: Boolean(videoMetadata?.category),
          description_present: Boolean(videoMetadata?.description)
        });
      }

      if (videoMetadata) {
        // Ensure category is fresh (wait specifically for category/meta to update)
        let categoryReady = videoMetadata.category && videoMetadata.category !== "MISSING" ? videoMetadata.category : null;
        let descriptionReady = videoMetadata.description || null;
        const extraAttempts = 12; // additional 6 seconds max (12 × 500ms)

        if (!categoryReady) {
          console.log("[FT] Category not ready, starting extended wait loop...");
          for (let i = 0; i < extraAttempts; i++) {
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Try to expand description during category wait if still missing
            if (!descriptionReady) {
              await expandDescriptionIfCollapsed(initialVideoId);
            }

            const latestMetadata = extractVideoMetadata();
            const latestCategory = latestMetadata?.category && latestMetadata.category !== "MISSING" ? latestMetadata.category : null;

            if (!descriptionReady && latestMetadata?.description) {
              descriptionReady = latestMetadata.description;
              console.log(`[FT] Description found on attempt ${i + 1}`);
            }

            if ((!videoMetadata.tags || videoMetadata.tags.length === 0) && latestMetadata?.tags?.length) {
              videoMetadata.tags = latestMetadata.tags;
            }

            if (latestCategory) {
              categoryReady = latestCategory;
              console.log(`[FT] ✅ Category found on attempt ${i + 1}: ${latestCategory}`);
              break;
            }

            if (i === extraAttempts - 1) {
              console.warn(`[FT] Category still missing after ${extraAttempts} attempts`);
            }
          }

          if (!categoryReady) {
            console.warn("[FT] ⚠️ Category missing after extended wait, falling back to 'Unknown'");
            categoryReady = "Unknown";
          }
        } else {
          console.log(`[FT] Category already ready: ${categoryReady}`);
        }

        videoMetadata.category = categoryReady;
        if (descriptionReady) {
          videoMetadata.description = descriptionReady;
        }

        videoMetadata.url = location.href;

        console.log("[FT] ✅ Final metadata ready:", {
          video_id: videoMetadata.video_id,
          title: videoMetadata.title?.substring(0, 60),
          channel: videoMetadata.channel,
          category: videoMetadata.category,
          description_length: videoMetadata.description?.length || 0,
          tags_count: videoMetadata.tags?.length || 0
        });
      }
    } catch (e) {
      console.warn("[FT] Error extracting video metadata:", e.message || e);
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
    console.log("[FT DEBUG] Sending to background:", {
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
        
        // Check if content is distracting - if not, cancel the journal nudge timer
        chrome.storage.local.get(["ft_plan"]).then(({ ft_plan }) => {
          const isDistracting = (distraction === "distracting" || category === "distracting");
          const isProOrTrial = (ft_plan === "pro" || ft_plan === "trial");
          
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
    currentWatchVideoId = null;
    videoWatchStartTime = null;
    journalNudgeShown = false;
    currentVideoAIClassification = null;
    videoClassified = false;
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
  const devPanel = document.getElementById("ft-dev-toggle");
  if (devPanel && resp.aiClassification) {
    // Validate video_id before updating dev panel
    const responseVideoId = resp.aiClassification.video_id;
    const currentVideoId = videoMetadata?.video_id || extractVideoIdFromUrl();
    if (responseVideoId === currentVideoId) {
      await updateDevPanelStatus(devPanel, resp.aiClassification);
    } else {
      console.warn("[FT] Dev panel: Classification video_id mismatch, not updating");
    }
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
    // COMMENTED OUT: Search block overlay hidden per user request
    /*
    if (resp.scope === "search") {
      if (!document.getElementById("ft-overlay")) {
        await showSearchBlockOverlay(resp.plan || "free");
      }
    } 
    */
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
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectDevToggle);
} else {
  injectDevToggle();
}

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
      
      chrome.storage.local.get(["ft_searches_today", "ft_plan"]).then(storage => {
        if (chrome.runtime.lastError) {
          console.warn("[FT] Failed to get search counter in listener:", chrome.runtime.lastError.message);
          return;
        }
        const searchesToday = Number(storage.ft_searches_today || 0);
        const plan = storage.ft_plan || "free";
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

const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    scheduleNav(150); // debounce SPA navigations
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Initialize global time tracking (tracks time on all YouTube pages)
// Start tracking immediately when script loads
startGlobalTimeTracking().catch(console.error);

// Initial run (debounced for consistency)
scheduleNav(0);
