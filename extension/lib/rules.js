// lib/rules.js
// Pure decision engine: given current context → decide block or allow.
// No DOM, no chrome APIs, no storage writes.

// ─────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────
import { PLAN_FREE, PLAN_PRO, PLAN_TEST } from "./constants.js";

// ─────────────────────────────────────────────────────────────
// PLAN CONFIG (single source of truth for limits/flags)
// Keep numbers conservative for FREE, generous for PRO.
// TEST plan never blocks (for QA/dev).
// ─────────────────────────────────────────────────────────────
export const CONFIG_BY_PLAN = Object.freeze({
  [PLAN_FREE]: Object.freeze({
    strict_shorts: true,   // Block Shorts immediately
    search_threshold: 5,   // Block Search after 5 searches today
    daily_watch_minutes_limit: 0 // 0 = disabled (can enable later)
  }),
  [PLAN_PRO]: Object.freeze({
    strict_shorts: false,  // Allow Shorts (you can still warn via UI if you want)
    search_threshold: 15,  // More generous
    daily_watch_minutes_limit: 0
  }),
  [PLAN_TEST]: Object.freeze({
    strict_shorts: false,
    search_threshold: Number.POSITIVE_INFINITY, // never trip
    daily_watch_minutes_limit: 0                // never trip
  })
});

// ─────────────────────────────────────────────────────────────
// REASON STRINGS (keep UI text consistent)
// ─────────────────────────────────────────────────────────────
const REASONS = Object.freeze({
  OK: "ok",
  UNLOCKED: "temporarily_unlocked",
  STRICT_SHORTS: "strict_shorts",
  SEARCH_THRESHOLD: "search_threshold",
  TIME_LIMIT: "time_limit"
});

// ─────────────────────────────────────────────────────────────
// evaluateBlock(ctx)
// ctx comes from background.js and must include:
// {
//   plan, config, pageType,                 // strings
//   searchesToday, watchSecondsToday,       // numbers
//   ft_blocked_today,                       // boolean (global block latched)
//   unlocked, now                           // boolean, number
// }
// Returns: { blocked: boolean, scope: "none"|"shorts"|"search"|"global", reason: string }
// ─────────────────────────────────────────────────────────────
export function evaluateBlock(ctx) {
  const {
    plan,
    config,
    pageType,                 // "HOME" | "WATCH" | "SEARCH" | "SHORTS" | "OTHER"
    searchesToday = 0,
    watchSecondsToday = 0,
    ft_blocked_today = false,
    unlocked = false
  } = ctx;

  // TEST plan: never block (used for QA/dev)
  if (plan === PLAN_TEST) {
    return { blocked: false, scope: "none", reason: REASONS.OK };
  }

  // If user has a temporary unlock → allow everything
  if (unlocked) {
    return { blocked: false, scope: "none", reason: REASONS.UNLOCKED };
  }

  // Global daily time limit (only if you enable it later)
  const dailyLimitMin = Number(config?.daily_watch_minutes_limit || 0);
  if (dailyLimitMin > 0) {
    const limitSeconds = dailyLimitMin * 60;
    if (watchSecondsToday >= limitSeconds) {
      return { blocked: true, scope: "global", reason: REASONS.TIME_LIMIT };
    }
  }

  // If already globally blocked for this period, keep enforcing
  if (ft_blocked_today) {
    return { blocked: true, scope: "global", reason: REASONS.TIME_LIMIT };
  }

  // Shorts policy (strict on FREE)
  if (pageType === "SHORTS" && config?.strict_shorts) {
    return { blocked: true, scope: "shorts", reason: REASONS.STRICT_SHORTS };
  }

  // Search threshold (block search page after N searches)
  const threshold = Number(config?.search_threshold ?? 5);
  if (pageType === "SEARCH" && searchesToday >= threshold) {
    return { blocked: true, scope: "search", reason: REASONS.SEARCH_THRESHOLD };
  }

  // Otherwise allow
  return { blocked: false, scope: "none", reason: REASONS.OK };
}