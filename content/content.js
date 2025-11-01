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
    // Search or global: show overlay only if one doesn’t already exist
  if ((resp.scope === "search" || resp.scope === "global") && !document.getElementById("ft-overlay")) {
    showOverlay(resp.reason, resp.scope);
}
  } else {
    removeOverlay(); // clear if allowed
  }
}

async function updateDevPanelStatus(panel) {
  try {
    const { ft_mode, ft_plan } = await chrome.storage.local.get(["ft_mode", "ft_plan"]);
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
      await chrome.runtime.sendMessage({ type: "FT_TOGGLE_MODE" });
      await updateDevPanelStatus(panel);
      console.log("[FT content] Mode toggled successfully");
    } catch (err) {     
      console.error("[FT content] Error toggling mode:", err);
    }
  };
  panel.querySelector("#ft-toggle-plan").onclick = async () => {
    try {
      await chrome.runtime.sendMessage({ type: "FT_TOGGLE_PLAN" });
      await updateDevPanelStatus(panel);
      console.log("[FT content] Plan toggled successfully");
    } catch (err) {
      console.error("[FT content] Error toggling plan:", err);
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
// PAGE MONITORING (for YouTube’s dynamic navigation)
// ─────────────────────────────────────────────────────────────
// Remove overlay when user navigates via browser back/forward
window.addEventListener("popstate", removeOverlay);
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

// Initial run (also debounced for consistency)
scheduleNav(0);
handleNavigation().catch(console.error);