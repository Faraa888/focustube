// background/background.js (MV3 Service Worker, type: module)
// ROLE: The "brain". No DOM. It updates counters, asks rules for a decision,
// and replies to content scripts. It also initializes/rotates daily/weekly data.

import {
  ensureDefaults,          // fill missing storage keys once
  maybeRotateCounters,     // reset counters when day/week changed
  getLocal, setLocal,      // read/write chrome.storage.local
  bump,                    // +1 helper for counters (alias for increment)
  getSnapshot,             // small debug snapshot
  getPlanConfig,           // read plan (free/pro/test) + limits
  isTemporarilyUnlocked,   // check if unlock window is active
} from "../lib/state.js";

import {
  evaluateBlock,           // pure decision: { blocked, scope, reason }
} from "../lib/rules.js";

const DEBUG = true;
const LOG = (...a) => DEBUG && console.log("[FT bg]", ...a);

// ─────────────────────────────────────────────────────────────────────────────
// 0) BOOT: make sure storage is ready, and the period is fresh
// ─────────────────────────────────────────────────────────────────────────────

async function boot() {
  await ensureDefaults();        // creates any missing keys (once)
  await maybeRotateCounters();   // clears yesterday’s counters if needed
  const snap = await getSnapshot();
  LOG("boot snapshot:", snap);
}

// Called on install/update and on browser startup
chrome.runtime.onInstalled.addListener(() => { boot().catch(console.error); });
chrome.runtime.onStartup.addListener(() => { boot().catch(console.error); });

// ─────────────────────────────────────────────────────────────────────────────
// 1) COUNTERS: small helper to bump the right counter for a pageType
// ─────────────────────────────────────────────────────────────────────────────
async function countForPageType(pageType) {
  // We only count a few simple things for the MVP
  if (pageType === "SEARCH") {
    await bump("ft_searches_today");
  } else if (pageType === "SHORTS") {
    await bump("ft_short_visits_today");
  } else if (pageType === "WATCH") {
    await bump("ft_watch_visits_today");
  }
  // HOME/OTHER: no counters for now (can add later if useful)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) MESSAGE HANDLER: content.js tells us “we navigated”
//    We: rotate period → count → read plan/state → ask rules → maybe set block
// ─────────────────────────────────────────────────────────────────────────────
// One listener, non-async, keeps the port open. All async work inside.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "FT_NAVIGATED") {
        // 🔹 Route all decisions through handleNavigated → evaluateBlock
        const resp = await handleNavigated(msg);
        sendResponse(resp);
        return;
      }

      if (msg?.type === "FT_TEMP_UNLOCK") {
        const resp = await handleTempUnlock(msg);
        sendResponse(resp);
        return;
      }

      if (msg?.type === "FT_PING") {
        sendResponse({ ok: true, from: "background", tabId: sender.tab?.id ?? null });
        return;
      }

      sendResponse({ ok: false, error: "Unknown message type" });
    } catch (err) {
      console.error("Error in background listener:", err);
      sendResponse({ ok: false, error: String(err) });
    }
  })();

  // 🔸 Critical for MV3: keep the message port open for the async IIFE.
  return true;
});

// Core flow for a navigation event
async function handleNavigated({ pageType = "OTHER", url = "" }) {
  // 1) Ensure defaults are set (once per install/update)
  await ensureDefaults();
  
  // 2) Make sure we're in the right "day/week"
  await maybeRotateCounters();

  // 3) Count what just happened (SEARCH/SHORTS/WATCH)
  await countForPageType(pageType);

  // 4) Read current counters + unlock from storage
  const state = await getLocal([
    "ft_searches_today",
    "ft_short_visits_today",
    "ft_watch_visits_today",
    "ft_watch_seconds_today",
    "ft_blocked_today",
    "ft_unlock_until_epoch",
  ]);

  // 5) Read plan + limits (free/pro/test)
  const { plan, config } = await getPlanConfig();

  // 6) Check if temporarily unlocked
  const now = Date.now();
  const unlocked = await isTemporarilyUnlocked(now);

  // 7) Build the context for rules (pure function)
  const ctx = {
    plan,
    config,
    pageType,
    searchesToday: Number(state.ft_searches_today || 0),
    shortVisitsToday: Number(state.ft_short_visits_today || 0),
    watchSecondsToday: Number(state.ft_watch_seconds_today || 0),
    ft_blocked_today: state.ft_blocked_today || false,
    unlocked,
    now,
  };

  // 8) Ask the judge
  const { blocked, scope, reason } = evaluateBlock(ctx);

  // 9) If rules say "global block", set the daily flag (idempotent)
  if (blocked && scope === "global" && !state.ft_blocked_today) {
    await setLocal({ ft_blocked_today: true });
  }

  // 10) Prepare a compact response for content.js
  const resp = {
    ok: true,
    pageType,
    blocked,
    scope,            // "global" | "shorts" | "search" | "none"
    reason,           // "time_limit" | "strict_shorts" | "search_threshold" | "temporarily_unlocked" | "ok"
    plan,
    counters: {
      searches: ctx.searchesToday,
      shorts:   ctx.shortVisitsToday,
      watch:    ctx.watchSecondsToday, // seconds (if you start tracking it)
    },
    unlocked,
    unlockUntilEpoch: Number(state.ft_unlock_until_epoch || 0),
  };

  LOG("NAV", { url, ...resp });
  return resp;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) TEMP UNLOCK: simple dev helper to grant a short unlock window
//    Content calls this when you click the “Temporary unlock (dev)” button.
// ─────────────────────────────────────────────────────────────────────────────
async function handleTempUnlock({ minutes = 10, note = "dev" }) {
  const now = Date.now();
  const expires = now + minutes * 60 * 1000;
  await setLocal({
    ft_unlock_until_epoch: expires,
    // (Optional analytics fields if you later track unlock usage)
    // ft_unlock_used_today: true,
    // ft_unlock_note: note,
  });
  LOG("TEMP_UNLOCK", { minutes, expires });
  return { ok: true, unlockUntilEpoch: expires };
}

