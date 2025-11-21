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
export const SPIRAL_THRESHOLD_DAY = 3;       // Videos today to trigger nudge (legacy, may be updated)
export const SPIRAL_THRESHOLD_WEEK = 6;      // Videos in last 7 days to trigger nudge (updated: 6 for neutral counting)
export const SPIRAL_THRESHOLD_WEEK_TIME = 5400; // 90 minutes in last 7 days to trigger nudge
export const SPIRAL_HISTORY_DAYS = 60;       // Keep watch history for 60 days (rolling window)
export const SPIRAL_DISMISSAL_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days cooldown after dismissal

// ─────────────────────────────────────────────────────────────
// BEHAVIOR LOOP AWARENESS CONSTANTS
// ─────────────────────────────────────────────────────────────
// Neutral video free allowance
export const NEUTRAL_FREE_COUNT = 2;         // First 2 neutral videos are free
export const NEUTRAL_FREE_TIME = 1200;       // First 20 minutes (1200s) of neutral content is free

// Distracting content escalation thresholds (whichever hits first: count OR time)
export const DISTRACTING_NUDGE_1_COUNT = 2;  // 2nd distracting video
export const DISTRACTING_NUDGE_1_TIME = 1200; // 20 minutes (1200s)
export const DISTRACTING_NUDGE_2_COUNT = 3;  // 3rd distracting video
export const DISTRACTING_NUDGE_2_TIME = 2400; // 40 minutes (2400s)
export const DISTRACTING_BREAK_COUNT = 4;    // 4th distracting video
export const DISTRACTING_BREAK_TIME = 3600;   // 60 minutes (3600s)

// Productive fatigue thresholds (whichever hits first: count OR time)
export const PRODUCTIVE_NUDGE_1_COUNT = 3;   // 3rd productive video
export const PRODUCTIVE_NUDGE_1_TIME = 2400; // 40 minutes (2400s)
export const PRODUCTIVE_NUDGE_2_COUNT = 5;   // 5th productive video
export const PRODUCTIVE_NUDGE_2_TIME = 3600; // 60 minutes (3600s)
export const PRODUCTIVE_BREAK_COUNT = 7;     // 7th productive video
export const PRODUCTIVE_BREAK_TIME = 5400;   // 90 minutes (5400s)

// Break lockout
export const BREAK_LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 minutes in milliseconds

// Real-time watch tracking
export const WATCH_TRACKING_INTERVAL_MS = 60 * 1000; // Update every 60 seconds

// ─────────────────────────────────────────────────────────────
// VERSIONING / FUTURE-PROOFING
// ─────────────────────────────────────────────────────────────
export const SCHEMA_VERSION = 1;   // bump when storage structure changes