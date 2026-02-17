// scripts/verify-phase4.js
// Run: node scripts/verify-phase4.js

import { readFileSync } from "fs";

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) { console.log(`✅ ${label}`); passed++; }
  else { console.error(`❌ ${label}`); failed++; }
}

const content = readFileSync("./extension/content/content.js", "utf8");

// ── Copy fixes ────────────────────────────────────────────────
check("14-day copy removed",
  !content.includes("14-day") && !content.includes("14 days"));
check("30-day copy present",
  content.includes("30-day"));

// ── Nudge durations ───────────────────────────────────────────
check("Distracting nudge1 = 10s",
  content.includes("nudge1") && content.match(/nudge1[\s\S]{0,100}duration = 10/));
check("Distracting nudge2 = 30s",
  content.match(/nudge2[\s\S]{0,100}duration = 30/));
check("Distracting break = 300s",
  content.match(/nudgeType === .break.[\s\S]{0,200}duration = 300/));
check("Productive nudge1 = 5s",
  content.match(/nudge1[\s\S]{0,100}duration = 5[^0]/));
check("Productive break = 300s",
  !content.includes("duration = 600"));

// ── Dead allowance references removed ────────────────────────
check("allowanceVideosLeft removed from content.js",
  !content.includes("allowanceVideosLeft"));
check("allowanceSecondsLeft removed from content.js",
  !content.includes("allowanceSecondsLeft"));

// ── Emojis removed from nudge headings ───────────────────────
check("Warning emoji removed from distracting nudge",
  !content.match(/showDistractingNudge[\s\S]{0,3000}<h2>⚠️/));
check("Lightbulb emoji removed from productive nudge",
  !content.match(/showProductiveNudge[\s\S]{0,3000}<h2>💡/));

// ── Search warning still present and intact ───────────────────
check("Search warning function present",
  content.includes("checkAndShowSearchWarning"));
check("Search block overlay present",
  content.includes("showSearchBlockOverlay"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);