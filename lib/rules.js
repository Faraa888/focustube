// lib/rules.js
// Plan config + pure blocking decision used by background.js

import { PLAN_FREE, PLAN_PRO } from "./constants.js";

// Config by plan (tunables)
const CONFIG_BY_PLAN = {
  [PLAN_FREE]: {
    search_threshold: 5,   // after 5 searches → block search scope
    strict_shorts: true,   // any SHORTS page blocked
    time_limit_seconds: 0  // (0 = off for now)
  },
  [PLAN_PRO]: {
    search_threshold: 15,
    strict_shorts: false,  // show warning in future; for MVP treat as allowed
    time_limit_seconds: 0
  }
};

// Export CONFIG_BY_PLAN for use by state.js
export { CONFIG_BY_PLAN };

/**
 * evaluateBlock(ctx) → { blocked, scope, reason }
 * ctx:
 *  - pageType: "SHORTS" | "SEARCH" | "WATCH" | ...
 *  - searchesToday, shortVisitsToday, watchSecondsToday (or ft_searches_today, etc.)
 *  - plan, config (from getPlanConfig)
 *  - unlocked (boolean) / unlockUntilEpoch (number, optional)
 */
export function evaluateBlock(ctx) {
  const {
    pageType = "OTHER",
    searchesToday = ctx.ft_searches_today || 0,
    shortVisitsToday = ctx.ft_short_visits_today || 0,
    watchSecondsToday = ctx.ft_watch_seconds_today || 0,
    ft_blocked_today = ctx.ft_blocked_today || false,
    unlocked = false,
    plan,
    config
  } = ctx;

  // 0) Temporary unlock always bypasses blocking
  if (unlocked) {
    return { blocked: false, scope: "none", reason: "temporarily_unlocked" };
  }

  // 1) If globally blocked already (from earlier decision), keep it blocked
  if (ft_blocked_today) {
    return { blocked: true, scope: "global", reason: "already_blocked" };
  }

  // 2) Plan thresholds
  const currentPlan = plan || PLAN_FREE;
  const cfg = config || CONFIG_BY_PLAN[currentPlan];

  // 2a) Shorts policy
  if (pageType === "SHORTS") {
    if (cfg.strict_shorts) {
      return { blocked: true, scope: "shorts", reason: "strict_shorts" };
    }
    // else allow (pro more lenient for MVP)
  }

  // 2b) Search threshold
  if (pageType === "SEARCH" && Number(searchesToday) >= cfg.search_threshold) {
    return { blocked: true, scope: "search", reason: "search_threshold" };
  }

  // 2c) Time cap (if you later track seconds)
  if (cfg.time_limit_seconds > 0 &&
      Number(watchSecondsToday) >= cfg.time_limit_seconds) {
    return { blocked: true, scope: "global", reason: "time_limit" };
  }

  // 3) Otherwise allow
  return { blocked: false, scope: "none", reason: "ok" };
}