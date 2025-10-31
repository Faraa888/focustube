// content/content.js
// Runs inside YouTube tabs. Detects page type, asks background, shows overlay.

const DEBUG = true;
const LOG = (...a) => DEBUG && console.log("[FT content]", ...a);

// Avoid running in iframes (player/ads)
if (window.top !== window) {
  LOG("skip iframe", location.href);
} else {
  LOG("content boot", location.href);
}

// --- Overlay management (CSS-driven) -----------------------------------
function ensureOverlay(message = "Blocked for today") {
  let ov = document.getElementById("ft-overlay");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "ft-overlay";
    ov.innerHTML = `
      <div class="ft-box">
        <h1>FocusTube</h1>
        <p id="ft-overlay-message">${message}</p>
        <button id="ft-unlock">Temporary Unlock (dev)</button>
      </div>
    `;
    document.body.appendChild(ov);
    document.documentElement.style.overflow = "hidden";
    
    // Wire up unlock button
    ov.querySelector("#ft-unlock")?.addEventListener("click", async () => {
      await chrome.runtime.sendMessage({ type: "FT_TEMP_UNLOCK", minutes: 10 });
      setTimeout(() => handleNavigation(), 150);
    });
  } else {
    // Update message if overlay exists
    const msgEl = ov.querySelector("#ft-overlay-message");
    if (msgEl) msgEl.textContent = message;
  }
}

function hideOverlay() {
  const ov = document.getElementById("ft-overlay");
  if (ov) {
    ov.remove();
    document.documentElement.style.overflow = "";
  }
}

// --- Page type detection (very lightweight) -------------------------
function detectPageType() {
  const url = location.href;
  if (/youtube\.com\/shorts\//.test(url)) return "SHORTS";
  if (/youtube\.com\/results\?search_query=/.test(url)) return "SEARCH";
  if (/youtube\.com\/watch\?/.test(url)) return "WATCH";
  if (/youtube\.com\/$/.test(url) || /youtube\.com\/\?/.test(url)) return "HOME";
  return "OTHER";
}

// --- Shorts enforcement ----------------------------------------------
// Find the active Shorts <video> element and pause/mute it.
// YouTube frequently replaces nodes, so keep an observer alive while on SHORTS.
let shortsObserver = null;

function stopShortsObserver() {
  if (shortsObserver) {
    shortsObserver.disconnect();
    shortsObserver = null;
  }
}

function pauseShortsOnce() {
  // Typical selector path for Shorts player
  // ytd-reel-video-renderer hosts a <video> element
  const video =
    document.querySelector("ytd-reel-video-renderer video") ||
    document.querySelector("ytd-reel-video-renderer #shorts-player video") ||
    document.querySelector("ytd-reel-video-renderer ytd-player video");

  if (video) {
    try {
      video.muted = true;          // silence first
      video.pause?.();             // pause if playing
      video.currentTime = video.currentTime; // nudge to stop buffering
    } catch (_) { /* no-op */ }
  }
}

function enforceShortsBlocked() {
  pauseShortsOnce(); // immediate attempt

  // Keep pausing if YouTube swaps DOM nodes (common in SPA)
  if (!shortsObserver) {
    shortsObserver = new MutationObserver(() => pauseShortsOnce());
    shortsObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
}

// --- Router: detect page, ask bg, act --------------------------------
let lastPageType = null;

async function handleNavigation() {
  const pageType = detectPageType();
  if (pageType === lastPageType) return; // avoid spam
  lastPageType = pageType;

  const resp = await FT_nav(pageType);
  LOG("handleNavigation:", pageType, location.href, resp);

  // Apply DOM actions based on decision
  if (resp?.blocked && resp?.scope === "shorts" && pageType === "SHORTS") {
    // Shorts blocked: pause/mute via MutationObserver
    enforceShortsBlocked();
    hideOverlay(); // Don't show overlay for shorts, just pause
  } else if (resp?.blocked && resp?.scope === "search" && pageType === "SEARCH") {
    // Search blocked: show overlay
    stopShortsObserver(); // Not on shorts anymore
    ensureOverlay("Search limit reached. Take a breather.");
  } else {
    // Not blocked or other scope: hide overlay, stop shorts observer
    hideOverlay();
    stopShortsObserver();
  }
}

// --- Wire up SPA navigation hooks -----------------------------------
// Run at load
handleNavigation();

// React to history pushes/replaces (YouTube SPA)
(function patchHistory() {
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...args) {
    const ret = origPush.apply(this, args);
    setTimeout(handleNavigation, 0);
    return ret;
  };
  history.replaceState = function (...args) {
    const ret = origReplace.apply(this, args);
    setTimeout(handleNavigation, 0);
    return ret;
  };
})();

// Back/forward
window.addEventListener("popstate", handleNavigation);

// Also try when DOM becomes interactive (covers some lazy transitions)
document.addEventListener("readystatechange", () => {
  if (document.readyState === "interactive" || document.readyState === "complete") {
    handleNavigation();
  }
});

// ---- FocusTube test helper: call background and log the decision
async function FT_nav(pageType) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "FT_NAVIGATED", pageType, url: location.href },
      (resp) => {
        if (chrome.runtime.lastError) {
          LOG("FT_NAVIGATED error:", chrome.runtime.lastError);
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(resp || { ok: false, error: "No response" });
        }
      }
    );
  });
}
window.FT_nav = FT_nav; // expose to DevTools console for manual testing
