// lib/rules.js
// Pure decision engine: given current context → decide block or allow.
// No DOM, no chrome APIs, no storage writes.

// ─────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────
import { PLAN_FREE, PLAN_PRO, PLAN_TRIAL, PLAN_TEST } from "./constants.js";

// ─────────────────────────────────────────────────────────────
// PLAN CONFIG (single source of truth for limits/flags)
// Keep numbers conservative for FREE, generous for PRO.
// TRIAL plan gets same features as PRO (handled in state.js).
// TEST plan never blocks (for QA/dev).
// ─────────────────────────────────────────────────────────────
export const CONFIG_BY_PLAN = Object.freeze({
  [PLAN_FREE]: Object.freeze({
    strict_shorts: true,   // Block Shorts immediately
    search_threshold: 5,   // Block Search after 5 searches today
    daily_watch_minutes_limit: 2 // 2 minutes per day (Free plan) - testing value, production: 60
  }),
  [PLAN_PRO]: Object.freeze({
    strict_shorts: false,  // Allow Shorts (you can still warn via UI if you want)
    search_threshold: 15,  // More generous
    daily_watch_minutes_limit: 3 // 3 minutes per day (Pro plan) - testing value, production: 90 (configurable 3-150)
  }),
  [PLAN_TRIAL]: Object.freeze({
    strict_shorts: false,  // Same as Pro - allow Shorts
    search_threshold: 15,  // Same as Pro - more generous
    daily_watch_minutes_limit: 3 // Same as Pro - testing value, production: 90 (configurable 3-150)
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
  TIME_LIMIT: "time_limit",
  CHANNEL_BLOCKED: "channel_blocked"
});

// ─────────────────────────────────────────────────────────────
// evaluateBlock(ctx)
// ctx comes from background.js and must include:
// {
//   plan, config, pageType,                 // strings
//   searchesToday, watchSecondsToday,       // numbers
//   ft_blocked_today,                       // boolean (global block latched)
//   unlocked, now                           // boolean, number
//   channel, blockedChannels               // string, array (for channel blocking)
// }
// Returns: { blocked: boolean, scope: "none"|"shorts"|"search"|"global"|"watch", reason: string }
// ─────────────────────────────────────────────────────────────
export function evaluateBlock(ctx) {
  const {
    plan,
    config,
    pageType,                 // "HOME" | "WATCH" | "SEARCH" | "SHORTS" | "OTHER"
    searchesToday = 0,
    watchSecondsToday = 0,
    ft_blocked_today = false,
    unlocked = false,
    channel = null,           // Channel name (for watch pages)
    blockedChannels = []      // Array of blocked channel names
  } = ctx;

  // TEST plan: never block (used for QA/dev)
  if (plan === PLAN_TEST) {
    return { blocked: false, scope: "none", reason: REASONS.OK };
  }

  // If user has a temporary unlock → allow everything
  if (unlocked) {
    return { blocked: false, scope: "none", reason: REASONS.UNLOCKED };
  }

  // Channel blocking check (early, before other blocking logic)
  if (pageType === "WATCH" && channel && Array.isArray(blockedChannels) && blockedChannels.length > 0) {
    // Case-insensitive comparison with substring matching
    // Handles "Eddie Hall" blocking "Eddie Hall The Beast"
    const channelLower = channel.toLowerCase().trim();
    const isBlocked = blockedChannels.some(blocked => {
      const blockedLower = blocked.toLowerCase().trim();
      // Exact match or substring match
      return blockedLower === channelLower || 
             channelLower.includes(blockedLower) || 
             blockedLower.includes(channelLower);
    });
    if (isBlocked) {
      return { blocked: true, scope: "watch", reason: REASONS.CHANNEL_BLOCKED };
    }
  }

  // Global daily time limit - read from effective settings (plan-aware)
  // Note: effectiveSettings should be computed by caller using getEffectiveSettings()
  const dailyLimitMin = ctx.effectiveSettings?.daily_limit_minutes !== undefined
    ? Number(ctx.effectiveSettings.daily_limit_minutes)
    : (ctx.ft_extension_settings?.daily_limit_minutes !== undefined
      ? Number(ctx.ft_extension_settings.daily_limit_minutes)
      : (plan === "free" ? 60 : 90)); // Fallback defaults
  if (dailyLimitMin > 0) {
    const limitSeconds = dailyLimitMin * 60;
    if (watchSecondsToday >= limitSeconds) {
      return { blocked: true, scope: "global", reason: REASONS.TIME_LIMIT };
    }
  }

  // If already globally blocked for this period, keep enforcing (but not on HOME page)
  // HOME page should never be blocked - user needs to be able to navigate
  if (ft_blocked_today && pageType !== "HOME") {
    return { blocked: true, scope: "global", reason: REASONS.TIME_LIMIT };
  }

  // Shorts policy (strict on FREE, or hard blocked for today)
  if (pageType === "SHORTS") {
    // Check if user hard blocked Shorts for today (Pro plan self-block)
    if (ctx.ft_block_shorts_today) {
      return { blocked: true, scope: "shorts", reason: REASONS.STRICT_SHORTS };
    }
    // Free plan blocks Shorts
    if (config?.strict_shorts) {
      return { blocked: true, scope: "shorts", reason: REASONS.STRICT_SHORTS };
    }
  }

  // Search threshold (block search page after N searches)
  const threshold = Number(config?.search_threshold ?? 5);
  if (pageType === "SEARCH" && searchesToday >= threshold) {
    return { blocked: true, scope: "search", reason: REASONS.SEARCH_THRESHOLD };
  }

  // Otherwise allow
  return { blocked: false, scope: "none", reason: REASONS.OK };
}