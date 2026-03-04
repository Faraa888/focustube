# FocusTube — Cursor Prompts
**One phase per session. Show diff before applying. Never combine phases.**

Read `.cursorrules` and all docs in `docs/` before starting any phase.

---

## PHASE 1 — Add `evaluateThresholds()` to `rules.js`

### What this phase does
Adds the graduated nudge/block threshold function to `lib/rules.js`.
This is the core decision engine for all nudge and block interventions.

### Rules
- Do NOT change `evaluateBlock()`
- Do NOT change `CONFIG_BY_PLAN`
- Do NOT change any imports or exports that already exist
- Only ADD the new function and export it

### Prompt

```
Read .cursorrules Section 7 and Section 17 Phase 1 before starting.
Read lib/constants.js and lib/rules.js in full before writing any code.

Add a new exported function `evaluateThresholds(counters, plan)` to lib/rules.js.

The function takes:
- counters: object with these keys:
  - distracting_count (number) — distracting videos watched today
  - distracting_seconds (number) — distracting watch time today in seconds
  - productive_count (number) — productive videos watched today
  - productive_seconds (number) — productive watch time today in seconds
  - neutral_count (number) — neutral videos watched today
- plan: string — "free" | "trial" | "pro" | "test"

The function returns one of these action code strings:
- "none" — no action needed
- "nudge_10s" — pause video, show 10 second dismissible nudge
- "nudge_30s" — pause video, show 30 second dismissible nudge
- "hard_block" — hard block for rest of day, no dismiss
- "upgrade_prompt" — show upgrade prompt (Free users at Pro threshold)
- "productive_nudge_5s" — show 5s productive nudge after video
- "productive_nudge_30s" — show 30s productive nudge after video
- "productive_break" — enforce 5 minute break, no dismiss

Use the existing constants from constants.js for all threshold values:
- DISTRACTING_NUDGE_1_COUNT, DISTRACTING_NUDGE_1_TIME
- DISTRACTING_NUDGE_2_COUNT, DISTRACTING_NUDGE_2_TIME
- DISTRACTING_BREAK_COUNT, DISTRACTING_BREAK_TIME
- PRODUCTIVE_NUDGE_1_COUNT, PRODUCTIVE_NUDGE_1_TIME
- PRODUCTIVE_NUDGE_2_COUNT, PRODUCTIVE_NUDGE_2_TIME
- PRODUCTIVE_BREAK_COUNT, PRODUCTIVE_BREAK_TIME
- NEUTRAL_FREE_COUNT, NEUTRAL_FREE_TIME

Logic rules (implement in this exact order):

1. TEST plan → always return "none"

2. Neutral videos: if neutral_count > NEUTRAL_FREE_COUNT OR neutral time > NEUTRAL_FREE_TIME,
   add excess neutral videos to the distracting counter before evaluating.
   Excess = neutral_count - NEUTRAL_FREE_COUNT (minimum 0).

3. Effective distracting count = distracting_count + excess neutral count
   Effective distracting seconds = distracting_seconds (neutral time not added)

4. Distracting thresholds (check count OR time, whichever hits first):
   - effective count >= DISTRACTING_BREAK_COUNT OR seconds >= DISTRACTING_BREAK_TIME:
     → Free plan: return "upgrade_prompt"
     → Trial/Pro: return "hard_block"
   - effective count >= DISTRACTING_NUDGE_2_COUNT OR seconds >= DISTRACTING_NUDGE_2_TIME:
     → Free plan: return "upgrade_prompt"
     → Trial/Pro: return "nudge_30s"
   - effective count >= DISTRACTING_NUDGE_1_COUNT OR seconds >= DISTRACTING_NUDGE_1_TIME:
     → All plans: return "nudge_10s"

5. Productive thresholds (check count OR time, whichever hits first):
   - productive count >= PRODUCTIVE_BREAK_COUNT OR seconds >= PRODUCTIVE_BREAK_TIME:
     → return "productive_break"
   - productive count >= PRODUCTIVE_NUDGE_2_COUNT OR seconds >= PRODUCTIVE_NUDGE_2_TIME:
     → return "productive_nudge_30s"
   - productive count >= PRODUCTIVE_NUDGE_1_COUNT OR seconds >= PRODUCTIVE_NUDGE_1_TIME:
     → return "productive_nudge_5s"

6. Default → return "none"

Note: Distracting thresholds are evaluated before productive thresholds.
If both would trigger, distracting wins.

Show the full diff before applying. Do not modify any other function in this file.
```

### Verification script

Create `scripts/verify-phase1.js` and run it with `node scripts/verify-phase1.js`.

```javascript
// scripts/verify-phase1.js
// Verifies evaluateThresholds returns correct action codes.
// Run: node scripts/verify-phase1.js

import { evaluateThresholds } from "../lib/rules.js";

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
check("3 neutral — nudge_10s (1 excess = 1 distracting)", { ...empty, neutral_count: 3 }, "pro", "nudge_10s");
check("5 neutral — nudge_30s (3 excess = 3 distracting)", { ...empty, neutral_count: 5 }, "pro", "nudge_30s");

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
```

**Phase 1 is complete when:** all checks pass and `evaluateBlock()` output is unchanged.

---

## PHASE 2 — Clean up `state.js`

### What this phase does
Removes dead code from `state.js`. No new logic added.

### Rules
- Delete only — no new functions
- Do not change sync logic, plan logic, or server calls
- Do not change `mergeBlockedChannels()`
- Show full diff before applying

### Prompt

```
Read .cursorrules Sections 16 and 17 Phase 2 before starting.
Read lib/state.js in full before making any changes.

Make these changes to lib/state.js. Show the full diff before applying.

1. In the DEFAULTS object, delete these two keys entirely:
   - ft_allowance_videos_left
   - ft_allowance_seconds_left

2. In resetShape(), delete these two keys entirely:
   - ft_allowance_videos_left
   - ft_allowance_seconds_left

3. In the DEFAULTS object, rename:
   - ft_user_anti_goals → ft_user_pitfalls

4. In ensureLocalOwnerEmail(), rename the storage clear:
   - ft_user_anti_goals → ft_user_pitfalls

5. Rename daily_limit_minutes → daily_time_limit_minutes everywhere in this file.
   Check: DEFAULTS, resetShape, settings schema comment, any getter or setter.

6. Delete the weekly and monthly reset period support entirely:
   - Remove PERIOD_WEEKLY and PERIOD_MONTHLY imports
   - In maybeRotateCounters(): remove the period detection logic,
     hardcode daily period only, simplify to just use buildDailyKey()
   - Remove buildWeeklyKey() function
   - Remove buildMonthlyKey() function
   - Remove getResetPeriod() function if it exists
   - Remove setResetPeriod() function if it exists

7. In the DEFAULTS object, rename ft_reset_period value to just "daily"
   and remove the ft_reset_period key entirely if it's only used for weekly/monthly logic.

Do not change anything else. Show the full diff before applying.
```

### Verification script

```javascript
// scripts/verify-phase2.js
// Run: node scripts/verify-phase2.js

import { ensureDefaults, getLocal, setLocal } from "../lib/state.js";

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

// Check dead fields are gone
import stateSource from "fs";
const source = stateSource.readFileSync("./lib/state.js", "utf8");

check("ft_allowance_videos_left removed", !source.includes("ft_allowance_videos_left"));
check("ft_allowance_seconds_left removed", !source.includes("ft_allowance_seconds_left"));
check("ft_user_anti_goals removed", !source.includes("ft_user_anti_goals"));
check("ft_user_pitfalls present", source.includes("ft_user_pitfalls"));
check("daily_limit_minutes removed", !source.includes("daily_limit_minutes:") && !source.includes('"daily_limit_minutes"'));
check("daily_time_limit_minutes present", source.includes("daily_time_limit_minutes"));
check("buildWeeklyKey removed", !source.includes("buildWeeklyKey"));
check("buildMonthlyKey removed", !source.includes("buildMonthlyKey"));
check("PERIOD_WEEKLY import removed", !source.includes("PERIOD_WEEKLY"));
check("PERIOD_MONTHLY import removed", !source.includes("PERIOD_MONTHLY"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

**Phase 2 is complete when:** all checks pass and extension boots without errors.

---

## PHASE 3 — Clean up `background.js` + extract `lib/spiral.js`

### What this phase does
- Deletes the allowance decrement logic from `background.js`
- Extracts spiral detection into `lib/spiral.js`
- Wires `evaluateThresholds()` into `handleNavigated()`

### Rules
- Extract spiral detection — do not rewrite it
- Wire evaluateThresholds — do not change evaluateBlock
- Show full diff before applying
- Do not touch content.js in this phase

### Prompt

```
Read .cursorrules Sections 16 and 17 Phase 3 before starting.
Read background.js and lib/rules.js in full before making changes.

Make these changes. Show the full diff before applying.

STEP A — Delete allowance decrement logic
In the finalizeVideoWatch() function, find and delete the block that:
- Reads ft_allowance_seconds_left from storage
- Decrements it based on durationSeconds
- Writes the new value back to storage
Delete only this block. Keep the rest of finalizeVideoWatch() intact.

STEP B — Extract spiral detection into lib/spiral.js
Create a new file lib/spiral.js.
Move the spiral detection logic out of finalizeVideoWatch() into this file.
Export a single function: detectSpiral(channelName, durationSeconds, distractionLevel, videoId, finishedAtIso, startedAtIso)
The function should contain exactly what was in background.js — no rewriting, just moving.
Import and call detectSpiral() from finalizeVideoWatch() in its place.

STEP C — Wire evaluateThresholds into handleNavigated
Import evaluateThresholds from lib/rules.js at the top of background.js.
In handleNavigated(), after evaluateBlock() is called and returns blocked: false,
call evaluateThresholds() with the current counters and plan.
Read counters from storage: ft_distracting_count_global, ft_distracting_time_global,
ft_productive_count_global, ft_productive_time_global, ft_neutral_count_global.
Send the action code back to content.js as part of the navigation response:
{ ...existingResponse, threshold_action: actionCode }

STEP D — Rename anti_goals references
Find every reference to ft_user_anti_goals in background.js.
Rename to ft_user_pitfalls.

Do not change evaluateBlock() calls. Do not change channel blocking logic.
Do not change focus window logic. Do not change daily time limit logic.
Show the full diff before applying.
```

### Verification script

```javascript
// scripts/verify-phase3.js
// Run: node scripts/verify-phase3.js

import fs from "fs";

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) { console.log(`✅ ${label}`); passed++; }
  else { console.error(`❌ ${label}`); failed++; }
}

const bg = fs.readFileSync("./background.js", "utf8");
const spiral = fs.readFileSync("./lib/spiral.js", "utf8");

check("Allowance decrement removed from background.js", !bg.includes("ft_allowance_seconds_left"));
check("ft_user_anti_goals removed from background.js", !bg.includes("ft_user_anti_goals"));
check("evaluateThresholds imported in background.js", bg.includes("evaluateThresholds"));
check("threshold_action sent in response", bg.includes("threshold_action"));
check("spiral.js exists", fs.existsSync("./lib/spiral.js"));
check("detectSpiral exported from spiral.js", spiral.includes("export") && spiral.includes("detectSpiral"));
check("detectSpiral called in background.js", bg.includes("detectSpiral"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

**Phase 3 is complete when:** all checks pass, extension loads, and a video watch triggers a `threshold_action` in the background console log.

---

## PHASE 4 — Clean up `content.js` + extract `lib/overlays.js`

### What this phase does
- Extracts all overlay HTML into `lib/overlays.js`
- Replaces inline HTML in `content.js` with `renderOverlay()` calls
- Deletes dead overlays (old 14-day copy, old Shorts overlays)
- Adds search warning banner (new)
- Wires `threshold_action` from background into overlay display

### Rules
- Move HTML, do not rewrite it
- New overlays must match copy from `docs/COPY_OVERVIEW_v2.md` exactly
- No emojis in any overlay
- Trial = 30 days in all copy
- Show full diff before applying

### Prompt

```
Read .cursorrules Sections 7, 15, 16, and 17 Phase 4 before starting.
Read content.js in full. Read docs/COPY_OVERVIEW_v2.md in full.
Read lib/overlays.js if it exists.

Make these changes. Show the full diff before applying.

STEP A — Create lib/overlays.js
Create lib/overlays.js.
Export a single function: renderOverlay(type, data)
type is one of: "nudge_10s" | "nudge_30s" | "hard_block" | "upgrade_prompt" |
"productive_nudge_5s" | "productive_nudge_30s" | "productive_break" |
"channel_blocked" | "focus_window" | "daily_limit" | "search_warning" |
"search_block" | "shorts_block" | "spiral_daily" | "spiral_weekly" | "journal"
data is an object with any dynamic values (channel name, count, time remaining, etc.)

Move the HTML template for each overlay type from content.js into renderOverlay().
Do not rewrite the HTML — move it exactly.
Remove any overlay that contains "14 days", "14-day", or emojis — replace with
the correct copy from docs/COPY_OVERVIEW_v2.md.

STEP B — Replace inline HTML in content.js
Replace every overlay HTML block in content.js with a call to renderOverlay(type, data).
content.js should import renderOverlay from lib/overlays.js.

STEP C — Add search warning banner
In content.js, on SEARCH page navigation, check ft_searches_today against plan thresholds:
- Free: warn at search 3 and 4, block at 5
- Pro: warn at search 13 and 14, block at 15
Warning: call renderOverlay("search_warning", { remaining }) — auto-dismiss after 5 seconds
Block: call renderOverlay("search_block", { plan }) — redirect to youtube.com/

STEP D — Wire threshold_action into overlays
In content.js, when background.js returns threshold_action in the navigation response,
call renderOverlay(threshold_action, counters) if threshold_action !== "none".
Productive overlay types appear after video ends or on navigation — not mid-video.
Distracting overlay types pause the video before showing.

Do not change page type detection logic.
Do not change channel blocking logic.
Do not change focus window or daily limit blocking logic.
Show the full diff before applying.
```

### Verification script

```javascript
// scripts/verify-phase4.js
// Run: node scripts/verify-phase4.js

import fs from "fs";

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) { console.log(`✅ ${label}`); passed++; }
  else { console.error(`❌ ${label}`); failed++; }
}

const content = fs.readFileSync("./content.js", "utf8");
const overlays = fs.readFileSync("./lib/overlays.js", "utf8");

check("overlays.js exists", fs.existsSync("./lib/overlays.js"));
check("renderOverlay exported", overlays.includes("export") && overlays.includes("renderOverlay"));
check("renderOverlay imported in content.js", content.includes("renderOverlay"));
check("No 14-day copy in overlays", !overlays.includes("14-day") && !overlays.includes("14 days"));
check("No 14-day copy in content.js", !content.includes("14-day") && !content.includes("14 days"));
check("No emojis in overlays", !overlays.match(/[\u{1F300}-\u{1FFFF}]/u));
check("Search warning banner present", content.includes("search_warning"));
check("Search block present", content.includes("search_block"));
check("threshold_action wired", content.includes("threshold_action"));
check("ft_searches_today checked on search page", content.includes("ft_searches_today"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

**Phase 4 is complete when:** all checks pass, overlays render correctly in browser, search limits trigger correctly.

---

## PHASE 5 — Server + Database field rename

### What this phase does
- Renames `anti_goals` → `pitfalls` in `index.ts` and Supabase
- Removes dead Stripe price references
- Verifies bootstrap endpoint returns correct shape

### Rules
- Deploy server and database changes simultaneously
- Verify bootstrap endpoint immediately after deploy
- Do not deploy server changes before database column is renamed
- Show full diff before applying

### Prompt

```
Read .cursorrules Sections 16 and 17 Phase 5 before starting.
Read server/src/index.ts in full before making changes.

Make these changes to server/src/index.ts. Show the full diff before applying.

STEP A — Rename anti_goals to pitfalls
Find every place index.ts reads anti_goals from the database or request body.
Rename to pitfalls.
Find every place index.ts returns anti_goals in a response.
Rename to pitfalls.

STEP B — Remove dead Stripe price references
Delete STRIPE_PRICE_ANNUAL and STRIPE_PRICE_LIFETIME variables and any
route logic that references them. MVP is monthly only.

STEP C — Plan value consistency
The database stores pro_trial. The extension cache uses trial.
Ensure the server normalises correctly:
- When reading from DB: pro_trial → send as "trial" to extension
- When writing to DB: "trial" from extension → store as "pro_trial"
Add a comment where this normalisation happens so it's visible.

After index.ts changes are ready but BEFORE deploying:
1. Run this Supabase migration:
   ALTER TABLE extension_data RENAME COLUMN anti_goals TO pitfalls;
   ALTER TABLE users RENAME COLUMN anti_goals TO pitfalls;
   (run whichever tables have this column)
2. Deploy the server changes immediately after.
3. Verify GET /extension/bootstrap returns pitfalls (not anti_goals) in response.

Show the full diff before applying.
```

### Verification script

```javascript
// scripts/verify-phase5.js
// Run after deploy: node scripts/verify-phase5.js

const SERVER_URL = "https://focustube-backend-4xah.onrender.com";
const TEST_EMAIL = process.env.TEST_EMAIL; // set in env

async function run() {
  let passed = 0;
  let failed = 0;

  function check(label, condition) {
    if (condition) { console.log(`✅ ${label}`); passed++; }
    else { console.error(`❌ ${label}`); failed++; }
  }

  if (!TEST_EMAIL) {
    console.error("Set TEST_EMAIL env var before running");
    process.exit(1);
  }

  const res = await fetch(`${SERVER_URL}/extension/bootstrap?email=${encodeURIComponent(TEST_EMAIL)}`);
  const data = await res.json();

  check("Bootstrap returns 200", res.status === 200);
  check("Response has pitfalls key", "pitfalls" in data);
  check("Response does NOT have anti_goals key", !("anti_goals" in data));
  check("pitfalls is an array", Array.isArray(data.pitfalls));
  check("Plan value is valid", ["free", "trial", "pro"].includes(data.plan));

  const indexSource = require("fs").readFileSync("./server/src/index.ts", "utf8");
  check("anti_goals removed from index.ts", !indexSource.includes('"anti_goals"'));
  check("STRIPE_PRICE_ANNUAL removed", !indexSource.includes("STRIPE_PRICE_ANNUAL"));
  check("STRIPE_PRICE_LIFETIME removed", !indexSource.includes("STRIPE_PRICE_LIFETIME"));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch(console.error);
```

**Phase 5 is complete when:** all checks pass, bootstrap returns `pitfalls`, extension syncs correctly after reload.

---

## After All Phases

Run all five verification scripts in sequence:

```bash
node scripts/verify-phase1.js
node scripts/verify-phase2.js
node scripts/verify-phase3.js
node scripts/verify-phase4.js
TEST_EMAIL=your@email.com node scripts/verify-phase5.js
```

All five must pass before considering the patch complete.