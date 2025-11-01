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
  // check temporary unlock state
} from "../lib/state.js";

import { evaluateBlock } from "../lib/rules.js";

// ─────────────────────────────────────────────────────────────
// DEBUG MODE (set false when you ship)
// ─────────────────────────────────────────────────────────────
const DEBUG = true;
async function LOG(...a) {
  if (!DEBUG) return;
  const { ft_mode = "user", ft_plan = "free" } = await chrome.storage.local.get(["ft_mode", "ft_plan"]);
  console.log(
    `%c[FocusTube BG]%c [${ft_mode.toUpperCase()} | ${ft_plan.toUpperCase()}]`,
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
  const snap = await getSnapshot();
  LOG("boot complete:", snap);
}

chrome.runtime.onInstalled.addListener(() => boot().catch(console.error));
chrome.runtime.onStartup.addListener(() => boot().catch(console.error));

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
// MODE + PLAN SWITCH HANDLER (Dev/User toggle, Free/Pro plan)
// ─────────────────────────────────────────────────────────────
async function handleSetModePlan({ mode = "user", plan = "free" }) {
  await ensureDefaults();
  await resetCounters();            // reset all daily counters/state
  await setPlan(plan);              // update plan in storage
  await setLocal({ ft_mode: mode }); // store current mode
  const tabs = await chrome.tabs.query({ url: "*://*.youtube.com/*" });
  for (const t of tabs) {
    chrome.tabs.sendMessage(t.id, { type: "FT_MODE_CHANGED", mode, plan });
  }
  LOG("Mode/Plan switched →", mode, plan);
  return { ok: true, mode, plan };
}

// ─────────────────────────────────────────────────────────────
// MESSAGE HANDLER: listens to content.js messages
// ─────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "FT_NAVIGATED") {
        const resp = await handleNavigated(msg);
        sendResponse(resp);
        return;
      }

      if (msg?.type === "FT_TEMP_UNLOCK") {
        const resp = await handleTempUnlock(msg);
        sendResponse(resp);
        return;
      }

      if (msg?.type === "FT_SET_MODE_PLAN") {
        const resp = await handleSetModePlan(msg);
        sendResponse(resp);
        return;
      }

            // Allow content.js toggle buttons to call the same handler
      if (msg?.type === "FT_TOGGLE_MODE" || msg?.type === "FT_TOGGLE_PLAN") {
        const current = await getLocal(["ft_mode", "ft_plan"]);
        const newMode = msg?.type === "FT_TOGGLE_MODE"
          ? (current.ft_mode === "dev" ? "user" : "dev")
          : current.ft_mode;
        const newPlan = msg?.type === "FT_TOGGLE_PLAN"
          ? (current.ft_plan === "free" ? "pro" : "free")
          : current.ft_plan;
        const resp = await handleSetModePlan({ mode: newMode, plan: newPlan });
        sendResponse(resp);
        return;
      }

      if (msg?.type === "FT_PING") {
        sendResponse({ ok: true, from: "background" });
        return;
      }

      if (msg?.type === "FT_BUMP_SHORTS") {
        await bumpShorts();
        sendResponse({ ok: true });
        return;
      }

      if (msg?.type === "FT_INCREMENT_ENGAGED_SHORTS") {
        const newCount = await incrementEngagedShorts();
        sendResponse({ ok: true, engagedCount: newCount });
        return;
      }

      sendResponse({ ok: false, error: "unknown message type" });
    } catch (err) {
      console.error("Error in background listener:", err);
      sendResponse({ ok: false, error: String(err) });
    }
  })();
  return true; // keeps message port open for async
});

// ─────────────────────────────────────────────────────────────
// HANDLE NAVIGATION (main logic)
// ─────────────────────────────────────────────────────────────
async function handleNavigated({ pageType = "OTHER", url = "" }) {
  // 1. Always make sure defaults + rotation are up-to-date
  await ensureDefaults();
  await maybeRotateCounters();

  // 2. Count the page view
  await countForPageType(pageType);

  // 3. Get current counters and unlock info
  const state = await getLocal([
    "ft_searches_today",
    "ft_short_visits_today",
    "ft_shorts_engaged_today",
    "ft_watch_visits_today",
    "ft_watch_seconds_today",
    "ft_shorts_seconds_today",
    "ft_blocked_today",
    "ft_block_shorts_today",
    "ft_unlock_until_epoch"
  ]);

  // 4. Read plan + limits
  const { plan, config } = await getPlanConfig();

  // 5. Check unlock status
  const now = Date.now();
  const unlocked = await isTemporarilyUnlocked(now);

  // 6. Build context for evaluateBlock()
  const ctx = {
    plan,
    config,
    pageType,
    searchesToday: Number(state.ft_searches_today || 0),
    watchSecondsToday: Number(state.ft_watch_seconds_today || 0),
    ft_blocked_today: state.ft_blocked_today || false,
    ft_block_shorts_today: state.ft_block_shorts_today || false,
    unlocked,
    now
  };

  // 7. Decide
  const { blocked, scope, reason } = evaluateBlock(ctx);

  // 8. If global block triggered, mark it
  if (blocked && scope === "global" && !state.ft_blocked_today) {
    await setLocal({ ft_blocked_today: true });
  }

  // 9. Respond to content.js
  const resp = {
    ok: true,
    pageType,
    blocked,
    scope,       // "none" | "shorts" | "search" | "global"
    reason,      // why blocked
    plan,
    counters: {
      searches: ctx.searchesToday,
      watchSeconds: ctx.watchSecondsToday,
      shortsVisits: Number(state.ft_short_visits_today || 0),
      shortsEngaged: Number(state.ft_shorts_engaged_today || 0),
      shortsSeconds: Number(state.ft_shorts_seconds_today || 0)
    },
    unlocked
  };

  LOG("NAV:", { url, ...resp });
  return resp;
}

// ─────────────────────────────────────────────────────────────
// TEMPORARY UNLOCK HANDLER
// ─────────────────────────────────────────────────────────────
async function handleTempUnlock({ minutes = 10 }) {
  const now = Date.now();
  const expires = now + minutes * 60 * 1000;
  await setLocal({ ft_unlock_until_epoch: expires });
  LOG(`Temporary unlock for ${minutes}min`);
  return { ok: true, unlockUntilEpoch: expires };
}