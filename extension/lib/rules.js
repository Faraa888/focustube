// lib/rules.js
// Pure decision engine: given current context → decide block or allow.
// No DOM, no chrome APIs, no storage writes.

// ─────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────
import { 
  PLAN_FREE, 
  PLAN_PRO, 
  PLAN_TRIAL, 
  PLAN_TEST,
  NEUTRAL_FREE_COUNT,
  DISTRACTING_NUDGE_1_COUNT,
  DISTRACTING_NUDGE_1_TIME,
  DISTRACTING_NUDGE_2_COUNT,
  DISTRACTING_NUDGE_2_TIME,
  DISTRACTING_BREAK_COUNT,
  DISTRACTING_BREAK_TIME,
  PRODUCTIVE_NUDGE_1_COUNT,
  PRODUCTIVE_NUDGE_1_TIME,
  PRODUCTIVE_NUDGE_2_COUNT,
  PRODUCTIVE_NUDGE_2_TIME,
  PRODUCTIVE_BREAK_COUNT,
  PRODUCTIVE_BREAK_TIME
} from "./constants.js";

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
    // Exact case-insensitive matching (normalization ensures saved names match YouTube format)
    const channelLower = channel.toLowerCase().trim();
    const isBlocked = blockedChannels.some(blocked => {
      const blockedLower = blocked.toLowerCase().trim();
      return blockedLower === channelLower; // Exact match only
    });
    if (isBlocked) {
      return { blocked: true, scope: "watch", reason: REASONS.CHANNEL_BLOCKED };
    }
  }

  // Global daily time limit - read from effective settings (plan-aware)
  // Note: effectiveSettings should be computed by caller using getEffectiveSettings()
const dailyLimitMin = ctx.effectiveSettings?.daily_time_limit_minutes !== undefined
    ? Number(ctx.effectiveSettings.daily_time_limit_minutes)
    : (ctx.ft_extension_settings?.daily_time_limit_minutes !== undefined
      ? Number(ctx.ft_extension_settings.daily_time_limit_minutes)
      : (plan === "free" ? 60 : 90));
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

// ─────────────────────────────────────────────────────────────
// evaluateThresholds(counters, plan)
// Evaluates nudge and block thresholds based on video counters.
// 
// @param {Object} counters - Counter values
// @param {number} counters.distracting_count - Distracting videos watched today
// @param {number} counters.distracting_seconds - Distracting watch time today (seconds)
// @param {number} counters.productive_count - Productive videos watched today
// @param {number} counters.productive_seconds - Productive watch time today (seconds)
// @param {number} counters.neutral_count - Neutral videos watched today
// @param {string} plan - User plan: "free" | "trial" | "pro" | "test"
// @returns {string} Action code: "none" | "nudge_10s" | "nudge_30s" | "hard_block" | "upgrade_prompt" | "productive_nudge_5s" | "productive_nudge_30s" | "productive_break"
// ─────────────────────────────────────────────────────────────
export function evaluateThresholds(counters, plan) {
  const {
    distracting_count = 0,
    distracting_seconds = 0,
    productive_count = 0,
    productive_seconds = 0,
    neutral_count = 0
  } = counters || {};

  // 1. TEST plan → always return "none"
  if (plan === PLAN_TEST) {
    return "none";
  }

  // 2. Neutral overflow: if neutral_count > NEUTRAL_FREE_COUNT, excess neutral videos
  //    are added to effective distracting count
  const excessNeutral = Math.max(0, neutral_count - NEUTRAL_FREE_COUNT);

  // 3. Effective distracting count = distracting_count + excess neutral count
  const effectiveDistractingCount = distracting_count + excessNeutral;

  // 4. Distracting thresholds (count OR time, whichever hits first)
  //    Check highest threshold first (hard block), then work down
  
  // Hard block threshold (5 videos OR 60 minutes)
  if (effectiveDistractingCount >= DISTRACTING_BREAK_COUNT || 
      distracting_seconds >= DISTRACTING_BREAK_TIME) {
    if (plan === PLAN_FREE) {
      return "upgrade_prompt";
    }
    // Trial or Pro
    return "hard_block";
  }

  // 30s nudge threshold (4 videos OR 40 minutes)
  if (effectiveDistractingCount >= DISTRACTING_NUDGE_2_COUNT || 
      distracting_seconds >= DISTRACTING_NUDGE_2_TIME) {
    if (plan === PLAN_FREE) {
      return "upgrade_prompt";
    }
    // Trial or Pro
    return "nudge_30s";
  }

  // 10s nudge threshold (3 videos OR 20 minutes)
  if (effectiveDistractingCount >= DISTRACTING_NUDGE_1_COUNT || 
      distracting_seconds >= DISTRACTING_NUDGE_1_TIME) {
    // All plans get this nudge
    return "nudge_10s";
  }

  // 5. Productive thresholds (count OR time, whichever hits first)
  //    Only evaluated if distracting thresholds didn't trigger
  
  // 5-minute break threshold (7 videos OR 90 minutes)
  if (productive_count >= PRODUCTIVE_BREAK_COUNT || 
      productive_seconds >= PRODUCTIVE_BREAK_TIME) {
    return "productive_break";
  }

  // 30s productive nudge threshold (5 videos OR 60 minutes)
  if (productive_count >= PRODUCTIVE_NUDGE_2_COUNT || 
      productive_seconds >= PRODUCTIVE_NUDGE_2_TIME) {
    return "productive_nudge_30s";
  }

  // 5s productive nudge threshold (3 videos OR 30 minutes)
  if (productive_count >= PRODUCTIVE_NUDGE_1_COUNT || 
      productive_seconds >= PRODUCTIVE_NUDGE_1_TIME) {
    return "productive_nudge_5s";
  }

  // 6. Default → "none"
  return "none";
}