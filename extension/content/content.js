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
 * Simple overlay creator. Shown when user is blocked.
 * It covers the screen, disables clicks, and explains why.
 */
function showOverlay(reason, scope) {
  removeOverlay(); // ensure no duplicates

  const overlay = document.createElement("div");
  overlay.id = "ft-overlay";

  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.9)";
  overlay.style.zIndex = 999999;
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.color = "white";
  overlay.style.fontSize = "20px";
  overlay.style.fontFamily = "Arial, sans-serif";
  overlay.style.textAlign = "center";
  overlay.style.padding = "20px";

  overlay.innerHTML = `
    <h1>FocusTube Active</h1>
    <p>You’re blocked from ${scope.toLowerCase()} content.</p>
    <p><strong>Reason:</strong> ${reason}</p>
    <button id="ft-temp-unlock" style="
      margin-top: 20px;
      padding: 10px 20px;
      font-size: 16px;
      cursor: pointer;
    ">
      Temporary Unlock (Dev)
    </button>
  `;

  // Dev-only: allow temp unlock for quick testing
  overlay.querySelector("#ft-temp-unlock").addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "FT_TEMP_UNLOCK", minutes: 1 });
    alert("Temporary unlock granted for 1 minute. Reload to continue.");
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
  const pageType = detectPageType();

  // Ask background for a decision
  const resp = await chrome.runtime.sendMessage({
    type: "FT_NAVIGATED",
    pageType,
    url: location.href
  });

  console.log("[FT content] background response:", resp);

  if (!resp?.ok) return;

  if (resp.blocked) {
    pauseVideos();

    // Shorts-specific: redirect to home if blocked
    if (resp.scope === "shorts") {
      window.location.href = "https://www.youtube.com/";
      return;
    }

    // Search or global: show overlay
    if (resp.scope === "search" || resp.scope === "global") {
      showOverlay(resp.reason, resp.scope);
    }
  } else {
    removeOverlay(); // clear if allowed
  }
}

// ─────────────────────────────────────────────────────────────
// PAGE MONITORING (for YouTube’s dynamic navigation)
// ─────────────────────────────────────────────────────────────

/**
 * YouTube is a Single-Page App (SPA) — URLs change without full reload.
 * This MutationObserver detects URL or title changes and reruns handleNavigation().
 */
let lastUrl = location.href;

const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    handleNavigation().catch(console.error);
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial run
handleNavigation().catch(console.error);