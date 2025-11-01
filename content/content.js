// content/content.js
// ROLE: The "eyes and hands" of FocusTube.
// Watches YouTube pages, tells the background what’s happening,
// and enforces the decision (pause, overlay, redirect).

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
 * Simple overlay creator. Shown when user is blocked (search/global scope).
 * Uses CSS classes from overlay.css instead of inline styles.
 */
function showOverlay(reason, scope) {
  removeOverlay(); // ensure no duplicates

  const overlay = document.createElement("div");
  overlay.id = "ft-overlay";

  overlay.innerHTML = `
    <div class="ft-box">
      <h1>FocusTube Active</h1>
      <p id="ft-overlay-message">You're blocked from ${scope.toLowerCase()} content.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <button id="ft-temp-unlock" class="ft-button ft-button-primary">
        Temporary Unlock (Dev)
      </button>
    </div>
  `;

  // Dev-only: allow temp unlock for quick testing
  overlay.querySelector("#ft-temp-unlock").addEventListener("click", async () => {
    try {
      if (!isChromeContextValid()) {
        console.warn("[FT] Cannot unlock - extension context invalidated");
        return;
      }
      await chrome.runtime.sendMessage({ type: "FT_TEMP_UNLOCK", minutes: 1 });
      if (chrome.runtime.lastError) {
        console.warn("[FT] Failed to unlock:", chrome.runtime.lastError.message);
        alert("Failed to unlock: " + chrome.runtime.lastError.message);
        return;
      }
      alert("Temporary unlock granted for 1 minute. Reload to continue.");
      removeOverlay();
    } catch (e) {
      console.warn("[FT] Error unlocking:", e.message);
      alert("Error unlocking: " + e.message);
    }
  });

  document.body.appendChild(overlay);
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

  // Upgrade to Pro button - placeholder for now (empty URL)
  overlay.querySelector("#ft-upgrade-pro").addEventListener("click", () => {
    // Placeholder: empty URL for now
    // Will be updated later with actual upgrade URL
    console.log("[FT] Upgrade to Pro clicked (placeholder)");
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
      "📱 Reply to that one message you’ve been ignoring",
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
      "📦 Do a small chore you’ve been putting off",
      "🎧 Listen to a short podcast or playlist",
      "👥 Make plans with a friend",
      "📓 Write or journal for a few minutes",
    ],
    20: [
      "🌳 Go outside and take a proper break from screens",
      "🍝 Cook and eat something simple",
      "📖 Read a full chapter of a book",
      "💡 Sketch out an idea you’ve been thinking about",
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
 * Shows search block overlay with plan-specific buttons
 */
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
      // Placeholder - no URL for now
      console.log("[FT] Upgrade to Pro clicked (placeholder)");
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
 * Milestones: 2 min (120s), 5 min (300s), 10 min (600s), 15 min (900s), 20 min (1200s)
 */
async function checkAndShowTimeMilestone(totalSeconds) {
  if (!isChromeContextValid()) return;
  
  const MILESTONES = [120, 300, 600, 900, 1200]; // 2, 5, 10, 15, 20 minutes in seconds
  
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
// MODE CHANGE HANDLER (Dev/User toggle listener)
// ─────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "FT_MODE_CHANGED") {
    console.log(`[FT content] Mode changed → ${msg.mode}, Plan → ${msg.plan}`);
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
 * 1. Detects what kind of page we’re on
 * 2. Sends message to background for decision
 * 3. Applies result (block / allow)
 */
async function handleNavigation() {
  // Guard: make sure Chrome APIs exist before continuing
  if (!chrome?.runtime) {
    console.warn("[FT] chrome.runtime unavailable — skipping navigation check.");
  return;
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

  // Ask background for a decision
  let resp;
  try {
    resp = await chrome.runtime.sendMessage({
      type: "FT_NAVIGATED",
      pageType,
      url: location.href
    });
    
    if (chrome.runtime.lastError) {
      console.warn("[FT] Failed to get navigation decision:", chrome.runtime.lastError.message);
      return;
    }
  } catch (e) {
    console.warn("[FT] Error sending navigation message:", e.message);
    return;
  }

  console.log("[FT content] background response:", resp);

  if (!resp?.ok) return;

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
    // Global blocking: show generic overlay
    else if (resp.scope === "global" && !document.getElementById("ft-overlay")) {
      showOverlay(resp.reason, resp.scope);
    }
  } else {
    removeOverlay(); // clear if allowed
  }
}

async function updateDevPanelStatus(panel) {
  try {
    if (!isChromeContextValid()) return;
    
    const { ft_mode, ft_plan } = await chrome.storage.local.get(["ft_mode", "ft_plan"]);
    if (chrome.runtime.lastError) {
      console.warn("[FT] Failed to get dev panel status:", chrome.runtime.lastError.message);
      return;
    }
    
    const statusEl = panel.querySelector("#ft-status");
    if (statusEl) {
      statusEl.textContent = `Mode: ${ft_mode || "user"} | Plan: ${ft_plan || "free"}`;
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
  panel.style.zIndex = "999999";
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
  <button id="ft-toggle-mode">Toggle Mode (Dev/User)</button>
  <button id="ft-toggle-plan">Toggle Plan (Free/Pro)</button>
  <div id="ft-status" style="margin-top:6px;font-size:12px;opacity:0.8;"></div>
`;

  // Click handlers — these send messages to background.js
  panel.querySelector("#ft-toggle-mode").onclick = async () => {
    try {
      if (!isChromeContextValid()) {
        console.warn("[FT] Cannot toggle mode - extension context invalidated");
        return;
      }
      await chrome.runtime.sendMessage({ type: "FT_TOGGLE_MODE" });
      if (chrome.runtime.lastError) {
        console.warn("[FT] Failed to toggle mode:", chrome.runtime.lastError.message);
        return;
      }
      await updateDevPanelStatus(panel);
      console.log("[FT content] Mode toggled successfully");
    } catch (err) {
      console.warn("[FT content] Error toggling mode:", err);
    }
  };
  panel.querySelector("#ft-toggle-plan").onclick = async () => {
    try {
      if (!isChromeContextValid()) {
        console.warn("[FT] Cannot toggle plan - extension context invalidated");
        return;
      }
      await chrome.runtime.sendMessage({ type: "FT_TOGGLE_PLAN" });
      if (chrome.runtime.lastError) {
        console.warn("[FT] Failed to toggle plan:", chrome.runtime.lastError.message);
        return;
      }
      await updateDevPanelStatus(panel);
      console.log("[FT content] Plan toggled successfully");
    } catch (err) {
      console.warn("[FT content] Error toggling plan:", err);
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
      const isFullscreen = !!(document.fullscreenElement || 
                              document.webkitFullscreenElement || 
                              document.mozFullScreenElement || 
                              document.msFullscreenElement);
      
      const searchCounter = document.getElementById("ft-search-counter");
      if (searchCounter) {
        if (isFullscreen) {
          searchCounter.style.display = 'none';
        } else {
          searchCounter.style.display = '';
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

// Save accumulated Shorts time when page is about to close or becomes hidden
window.addEventListener("beforeunload", () => {
  if (shortsTimeStart) {
    // Synchronous save before page closes
    saveAccumulatedShortsTime().catch(console.error);
  }
});

// pagehide is more reliable than beforeunload for async operations
window.addEventListener("pagehide", () => {
  if (shortsTimeStart) {
    // Synchronous save when page is being unloaded
    saveAccumulatedShortsTime().catch(console.error);
  }
});

document.addEventListener("visibilitychange", () => {
  // Save when page becomes hidden (tab switch, minimize, etc.)
  if (document.hidden && shortsTimeStart) {
    saveAccumulatedShortsTime().catch(console.error);
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
    handleNavigation().catch(console.error);
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

// Initial run (debounced for consistency)
scheduleNav(0);
