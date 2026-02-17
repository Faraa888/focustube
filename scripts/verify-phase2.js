// scripts/verify-phase2.js
// Run: node scripts/verify-phase2.js

import { readFileSync } from "fs";

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    console.log(`✅ ${label}`);
    passed++;
  } else {
    console.error(`❌ ${label}`);
    failed++;
  }
}

const state  = readFileSync("./extension/lib/state.js", "utf8");
const rules  = readFileSync("./extension/lib/rules.js", "utf8");

// ── Allowance system deleted ──────────────────────────────────
check("ft_allowance_videos_left removed",    !state.includes("ft_allowance_videos_left"));
check("ft_allowance_seconds_left removed",   !state.includes("ft_allowance_seconds_left"));

// ── ft_current_video_classification kept ─────────────────────
check("ft_current_video_classification kept", state.includes("ft_current_video_classification"));

// ── Rename: anti_goals → pitfalls ────────────────────────────
check("ft_user_anti_goals removed",          !state.includes("ft_user_anti_goals"));
check("ft_user_pitfalls present",             state.includes("ft_user_pitfalls"));

// ── Rename: daily_limit_minutes → daily_time_limit_minutes ───
check("daily_limit_minutes as field removed", !state.includes("daily_limit_minutes:"));
check("daily_time_limit_minutes present",      state.includes("daily_time_limit_minutes"));

// ── Weekly/monthly reset deleted ─────────────────────────────
check("PERIOD_WEEKLY import removed",         !state.includes("PERIOD_WEEKLY"));
check("PERIOD_MONTHLY import removed",        !state.includes("PERIOD_MONTHLY"));
check("buildWeeklyKey removed",               !state.includes("buildWeeklyKey"));
check("buildMonthlyKey removed",              !state.includes("buildMonthlyKey"));
check("getResetPeriod removed",               !state.includes("getResetPeriod"));
check("ft_reset_period removed",              !state.includes("ft_reset_period"));

// ── maybeRotateCounters still exists ─────────────────────────
check("maybeRotateCounters still present",    state.includes("maybeRotateCounters"));

// ── rules.js reads correct field name ────────────────────────
check("rules.js reads daily_time_limit_minutes", rules.includes("daily_time_limit_minutes"));
check("rules.js no stale daily_limit_minutes read", !rules.includes("effectiveSettings?.daily_limit_minutes"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);