// scripts/verify-phase3.js
// Run: node scripts/verify-phase3.js

import { readFileSync, existsSync } from "fs";

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) { console.log(`✅ ${label}`); passed++; }
  else { console.error(`❌ ${label}`); failed++; }
}

const bg     = readFileSync("./extension/background/background.js", "utf8");
const rules  = readFileSync("./extension/lib/rules.js", "utf8");
const spiral = existsSync("./extension/lib/spiral.js")
  ? readFileSync("./extension/lib/spiral.js", "utf8")
  : null;

// ── Phase 2 carryover ─────────────────────────────────────────
check("rules.js reads daily_time_limit_minutes",
  rules.includes("daily_time_limit_minutes"));
check("rules.js no stale daily_limit_minutes read",
  !rules.includes("effectiveSettings?.daily_limit_minutes"));
check("ft_user_anti_goals removed from background.js",
  !bg.includes("ft_user_anti_goals"));

// ── Allowance system deleted ──────────────────────────────────
check("ft_allowance_seconds_left removed from background.js",
  !bg.includes("ft_allowance_seconds_left"));
check("ft_allowance_videos_left removed from background.js",
  !bg.includes("ft_allowance_videos_left"));
check("allowance_cost removed from background.js",
  !bg.includes("allowance_cost"));
check("ai_allowance_used removed from background.js",
  !bg.includes("ai_allowance_used"));

// ── Spiral extracted ──────────────────────────────────────────
check("spiral.js exists",
  spiral !== null);
check("detectSpiral exported from spiral.js",
  spiral?.includes("export") && spiral?.includes("detectSpiral"));
check("detectSpiral called in background.js",
  bg.includes("detectSpiral"));

// ── evaluateThresholds wired ──────────────────────────────────
check("evaluateThresholds imported in background.js",
  bg.includes("evaluateThresholds"));
check("threshold_action sent in navigation response",
  bg.includes("threshold_action"));

// ── Nothing nuked that should survive ────────────────────────
check("finalizeVideoWatch still present",
  bg.includes("finalizeVideoWatch"));
check("ft_current_video_classification still present",
  bg.includes("ft_current_video_classification"));
check("evaluateBlock still called",
  bg.includes("evaluateBlock"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);