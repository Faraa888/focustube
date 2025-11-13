// lib/constants.js
// Central place for all fixed string constants and enumerations.
// Shared by background.js, content.js, state.js, and rules.js.

// ─────────────────────────────────────────────────────────────
// PLAN TIERS
// ─────────────────────────────────────────────────────────────
export const PLAN_FREE  = "free";    // Basic tier - strict rules
export const PLAN_PRO   = "pro";     // Paid tier - relaxed rules, AI features
export const PLAN_TRIAL = "trial";   // 14-day trial - same features as Pro
export const PLAN_TEST  = "test";    // Internal/dev tier - unlimited, logs everything

// ─────────────────────────────────────────────────────────────
// RESET PERIODS
// ─────────────────────────────────────────────────────────────
export const PERIOD_DAILY   = "daily";    // Reset every day
export const PERIOD_WEEKLY  = "weekly";   // Reset every week
export const PERIOD_MONTHLY = "monthly";  // Reset at start of each month

// ─────────────────────────────────────────────────────────────
// PAGE TYPES (detected by content.js and used by rules.js)
// ─────────────────────────────────────────────────────────────
export const PAGE_HOME   = "HOME";     // youtube.com/
export const PAGE_SEARCH = "SEARCH";   // youtube.com/results
export const PAGE_WATCH  = "WATCH";    // youtube.com/watch?v=...
export const PAGE_SHORTS = "SHORTS";   // youtube.com/shorts/...
export const PAGE_OTHER  = "OTHER";    // anything else (channel pages, settings, etc.)

// ─────────────────────────────────────────────────────────────
// MESSAGE TYPES (background <-> content communication)
// ─────────────────────────────────────────────────────────────
export const MSG_NAVIGATED   = "FT_NAVIGATED";     // user navigated to new page
export const MSG_TEMP_UNLOCK = "FT_TEMP_UNLOCK";   // temporary unlock
export const MSG_PING        = "FT_PING";          // connection check
export const MSG_DEBUG       = "FT_DEBUG";         // used for internal dev/test commands

// ─────────────────────────────────────────────────────────────
// DEBUGGING / FEATURE FLAGS
// ─────────────────────────────────────────────────────────────
export const DEBUG_MODE = true;     // toggles extra console logs
export const TEST_MODE  = false;    // when true, disables blocking for QA/dev

// ─────────────────────────────────────────────────────────────
// SPIRAL DETECTION CONSTANTS
// ─────────────────────────────────────────────────────────────
export const SPIRAL_MIN_WATCH_SECONDS = 45;  // Minimum watch time (seconds) to log long-form sessions
export const SPIRAL_THRESHOLD_DAY = 3;       // Videos today to trigger nudge
export const SPIRAL_THRESHOLD_WEEK = 5;      // Videos in last 7 days to trigger nudge
export const SPIRAL_HISTORY_DAYS = 60;       // Keep watch history for 60 days (rolling window)

// ─────────────────────────────────────────────────────────────
// VERSIONING / FUTURE-PROOFING
// ─────────────────────────────────────────────────────────────
export const SCHEMA_VERSION = 1;   // bump when storage structure changes