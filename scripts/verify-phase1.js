// scripts/verify-phase1.js
// Verifies evaluateThresholds returns correct action codes.
// Run: node scripts/verify-phase1.js

import { evaluateThresholds } from "../extension/lib/rules.js";

let passed = 0;
let failed = 0;

function check(label, counters, plan, expected) {
  const result = evaluateThresholds(counters, plan);
  if (result === expected) {
    console.log(`✅ ${label}`);
    passed++;
  } else {
    console.error(`❌ ${label} — expected "${expected}", got "${result}"`);
    failed++;
  }
}

const empty = { distracting_count: 0, distracting_seconds: 0, productive_count: 0, productive_seconds: 0, neutral_count: 0 };

// No action
check("No videos — no action", empty, "pro", "none");
check("TEST plan — always none", { ...empty, distracting_count: 99 }, "test", "none");

// Distracting — count triggers
check("2 distracting — no action", { ...empty, distracting_count: 2 }, "pro", "none");
check("3 distracting — nudge_10s", { ...empty, distracting_count: 3 }, "pro", "nudge_10s");
check("4 distracting — nudge_30s", { ...empty, distracting_count: 4 }, "pro", "nudge_30s");
check("5 distracting — hard_block (pro)", { ...empty, distracting_count: 5 }, "pro", "hard_block");
check("5 distracting — hard_block (trial)", { ...empty, distracting_count: 5 }, "trial", "hard_block");
check("5 distracting — upgrade_prompt (free)", { ...empty, distracting_count: 5 }, "free", "upgrade_prompt");
check("4 distracting — upgrade_prompt (free)", { ...empty, distracting_count: 4 }, "free", "upgrade_prompt");
check("3 distracting — nudge_10s (free)", { ...empty, distracting_count: 3 }, "free", "nudge_10s");

// Distracting — time triggers
check("20 min distracting — nudge_10s", { ...empty, distracting_seconds: 1200 }, "pro", "nudge_10s");
check("40 min distracting — nudge_30s", { ...empty, distracting_seconds: 2400 }, "pro", "nudge_30s");
check("60 min distracting — hard_block", { ...empty, distracting_seconds: 3600 }, "pro", "hard_block");

// Neutral overflow
check("2 neutral — no action", { ...empty, neutral_count: 2 }, "pro", "none");
check("3 neutral — no action (1 excess, below threshold)", { ...empty, neutral_count: 3 }, "pro", "none");
check("5 neutral — nudge_10s (3 excess = 3 distracting)", { ...empty, neutral_count: 5 }, "pro", "nudge_10s");
check("6 neutral — nudge_30s (4 excess = 4 distracting)", { ...empty, neutral_count: 6 }, "pro", "nudge_30s");


// Productive
check("2 productive — no action", { ...empty, productive_count: 2 }, "pro", "none");
check("3 productive — productive_nudge_5s", { ...empty, productive_count: 3 }, "pro", "productive_nudge_5s");
check("5 productive — productive_nudge_30s", { ...empty, productive_count: 5 }, "pro", "productive_nudge_30s");
check("7 productive — productive_break", { ...empty, productive_count: 7 }, "pro", "productive_break");
check("30 min productive — productive_nudge_5s", { ...empty, productive_seconds: 1800 }, "pro", "productive_nudge_5s");
check("90 min productive — productive_break", { ...empty, productive_seconds: 5400 }, "pro", "productive_break");

// Distracting wins over productive
check("3 distracting + 3 productive — nudge_10s (distracting wins)", { ...empty, distracting_count: 3, productive_count: 3 }, "pro", "nudge_10s");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
