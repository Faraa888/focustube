# FocusTube — v2 Build Plan

**Version:** v2  
**Based on:** All five v2 docs (PRD, App Flow, Backend, Frontend, Transfers Context)  
**Status:** Existing build has partial functionality. v2 requires a focused cleanup and rebuild of core logic.

---

## WHAT EXISTS AND WHAT TO KEEP

### Keep (working and aligned with v2)
- Shorts blocking redirect logic (repurpose: treat Shorts as always-distracting, not a separate system)
- Daily counter rotation at local midnight
- Watch event batching to server
- Extension boot sequence (syncPlanFromServer + loadExtensionDataFromServer)
- Stripe Checkout integration
- Supabase auth connection
- content.js page type detection (SHORTS / SEARCH / WATCH / HOME)

### Replace or Fix
- Field names: `ft_user_anti_goals` → `ft_user_pitfalls` everywhere
- Plan sync: currently polling every 5 minutes — change to explicit events + 6-hour fallback
- AI classification: currently allowance-based (1 video or 10 minutes) — replace with nudge/block thresholds from v2
- Search limits (5 free / 15 pro) — remove entirely, not in v2 spec
- Nudge and overlay logic — currently broken and misaligned, rebuild from spec
- Focus Window — not built, build from scratch
- Daily time limit — partially built, fix to hard block correctly
- `/extension/bootstrap` response must return `pitfalls` not `anti_goals`

### Remove
- Search limit counters and overlays
- Allowance system (`ft_allowance_videos_left`, `ft_allowance_seconds_left`)
- `.cursorrules1`

---

## SHORTS DECISION

**Treat Shorts as always-distracting videos, not a separate system.**

Rationale:
- Shorts follow the same counter logic as distracting videos
- No separate Shorts counter needed
- Existing Shorts redirect logic is reused — just feed into distracting counter instead of a dedicated Shorts system
- Simplifies the codebase significantly

---

## BUILD PHASES

---

### PHASE 1 — Field Name & Schema Cleanup
**Goal:** Single consistent naming across all layers before any new code is written.

**What changes:**

1. Rename `ft_user_anti_goals` → `ft_user_pitfalls` in:
   - `lib/state.js`
   - `background.js`
   - All API calls and responses
   - Supabase `extension_data` column

2. Confirm `/extension/bootstrap` returns:
   - `pitfalls` (not `anti_goals`)
   - `focus_window_start`
   - `focus_window_end`
   - `daily_time_limit_minutes`

3. Confirm `users` table field is `trial_started_at` (not `trial_start_date`)

**Acceptance criteria:**
- No instance of `anti_goals` anywhere in codebase
- Bootstrap response matches spec exactly
- Supabase column names match field name table in `.cursorrules`

---

### PHASE 2 — Plan Sync Fix
**Goal:** Plan syncs automatically without user needing to click reset.

**Problem:** Plan currently requires manual reset to take effect. AI classification runs before plan is confirmed.

**What changes:**

1. On every YouTube navigation event:
   - Check plan from local cache first
   - If cache is stale (>6h) → fetch from server before proceeding
   - Plan must be confirmed before AI classification runs

2. Sync triggers:
   - On login → fetch immediately
   - On upgrade → fetch immediately
   - On settings change → fetch immediately
   - Polling fallback → every 6 hours (reduce from current 5 minutes)

3. Remove 5-minute polling interval — replace with 6-hour polling

**Acceptance criteria:**
- Switching from trial to free takes effect within one navigation, no reset needed
- Pro features unavailable immediately after trial expires
- Plan check always runs before AI classification

---

### PHASE 3 — Nudge & Block Threshold Rebuild
**Goal:** Replace allowance system with v2 nudge/block thresholds.

**Problem:** Current system uses a 1-video / 10-minute allowance. v2 uses graduated nudges before blocks.

**Remove:**
- `ft_allowance_videos_left`
- `ft_allowance_seconds_left`
- All allowance decrement logic

**Build:**

Distracting counter (includes Shorts and neutral-from-3rd):
| Threshold | Action |
|---|---|
| 1-2 videos | No action |
| 3 videos OR 20 min | Pause + 10s nudge overlay |
| 4 videos OR 40 min | Pause + 30s nudge overlay |
| 5 videos OR 60 min | Hard block for rest of day |

Productive counter:
| Threshold | Action |
|---|---|
| 30 min OR 3 videos | 5s nudge (post-video) |
| 60 min OR 5 videos | 30s nudge (post-video) |
| 90 min OR 7 videos | 5-min break enforced |

Neutral:
- First 2 → no action
- 3rd onward → increment distracting counter

**Free users:** Soft nudges only. When they would hit a hard block → show upgrade prompt instead.

**Acceptance criteria:**
- 3 distracting videos triggers 10s nudge
- 5 distracting videos triggers hard block
- Free users see upgrade prompt at hard block threshold
- Productive nudge appears after video ends, not mid-video
- Distracting nudge can appear mid-video

---

### PHASE 4 — Shorts as Distracting Videos
**Goal:** Shorts feed into the distracting counter, not a separate system.

**What changes:**

1. When pageType === "SHORTS":
   - Classify as distracting (no AI call needed — always distracting per spec)
   - Increment distracting counter
   - Evaluate distracting thresholds as normal

2. Existing Shorts redirect on hard block threshold stays in place

3. Remove:
   - `ft_short_visits_today` separate counter
   - `ft_shorts_engaged_today`
   - `ft_shorts_seconds_today`
   - Separate Shorts overlay/nudge system
   - "Block Shorts for today" as a separate feature (absorbed into distracting block)

4. The "Block Shorts" toggle in settings stays — when enabled, all Shorts redirect immediately (before threshold logic runs)

**Acceptance criteria:**
- Shorts increment distracting counter
- 5 total distracting videos (mix of Shorts + regular) triggers hard block
- Block Shorts toggle still works as an immediate redirect

---

### PHASE 5 — Focus Window
**Goal:** Build Focus Window enforcement from scratch.

**Spec:**
- User sets `focus_window_start` (HH:MM) and `focus_window_end` (HH:MM)
- Max window: 6 hours
- Earliest start: 08:00, latest end: 22:00
- Outside the window → redirect to YouTube home with message
- Stored server-side in `extension_data`

**What to build:**

1. Add `focus_window_enabled`, `focus_window_start`, `focus_window_end` to settings schema in `lib/state.js`

2. In navigation handler (before any other check):
   - If `focus_window_enabled` is true
   - Get current local time
   - If outside window → redirect, show "YouTube is paused until [time]" message
   - If inside window → continue normal flow

3. Add Focus Window fields to Settings page on web app

4. Add to `/extension/bootstrap` response

**Acceptance criteria:**
- YouTube blocked outside defined window
- Message shows when time YouTube becomes available
- Window correctly rejected if > 6 hours or outside 08:00-22:00
- Disabled by default

---

### PHASE 6 — Daily Time Limit Fix
**Goal:** Daily time limit correctly triggers hard block and is enforced properly.

**Problem:** Daily limit partially built but not consistently enforced.

**Spec:**
- `daily_time_limit_minutes`: 0 = disabled, max 120
- When total watch time reaches limit → hard block for rest of day
- Resets at local midnight

**What to fix:**

1. Hard block must trigger immediately when `ft_watch_seconds_today >= daily_time_limit_minutes * 60`

2. Block must persist until local midnight reset (not just on refresh)

3. Check must happen:
   - On every navigation
   - During watch time tracking (not just on page load)

4. Free users: daily time limit is a Pro-only feature — show upgrade prompt instead of block

**Acceptance criteria:**
- Hard block triggers at exact limit
- Block persists across page refreshes
- Block lifts at midnight
- Free users see upgrade prompt

---

### PHASE 7 — Channel Blocking Fix
**Goal:** Block channel saves to Supabase reliably and persists.

**Problem:** Block channel button not saving to Supabase.

**What to fix:**

1. Fix the save endpoint error handling in `saveExtensionDataToServer`
2. Add proper error logging on block save failure
3. Verify the primary channel name is extracted correctly before save
4. Block Channel button must only appear for Trial and Pro users (hide on Free)

**Acceptance criteria:**
- Blocked channel appears in Supabase after clicking block
- Persists after refresh and across devices
- Button hidden for Free users

---

### PHASE 8 — Overlay & Nudge UI Cleanup
**Goal:** All overlays and nudges appear at the right time in the right format.

**Rules:**
- Distracting nudges: appear mid-video (pause video, show overlay, resume after timer)
- Productive nudges: appear after video ends or on navigation
- Hard block: full-screen overlay, no dismiss option
- All overlays must be consistent in style

**What to build:**
- 10s nudge overlay (dismissible after 10s)
- 30s nudge overlay (dismissible after 30s)
- 5s productive nudge (appears post-video)
- 30s productive nudge (appears post-video)
- 5-min break overlay (non-dismissible until timer expires)
- Hard block overlay (non-dismissible, resets next day)
- Upgrade prompt overlay (for free users at Pro thresholds)

**What to fix:**
- Remove nudge appearing in corner (wrong position)
- Journal "Add note" button must appear on nudge overlays only
- Journal overlay must be full-screen, not a corner widget

---

### PHASE 9 — AI Classify Wire Fix
**Goal:** AI classification works without needing manual reset.

**Problem:** Classification works after reset but not automatically.

**Root cause:** Plan sync must be confirmed before classifyContent() is called.

**What changes:**

1. Ensure plan is loaded and current before `classifyContent()` is called
2. Classification only runs for Pro Trial and Pro Paid users
3. Free users → skip classify, default to neutral
4. If OpenAI fails → classify as neutral, never break flow
5. Shorts → never sent to AI, always distracting

**Acceptance criteria:**
- Classification runs automatically on watch pages after 45s
- Free users never have videos classified (cost control)
- Failure defaults to neutral
- No manual reset required

---

### PHASE 10 — Feature Gate Audit
**Goal:** Every Pro feature is gated correctly. Free users never get Pro behavior silently.

**Pro only:**
- Hard blocks (distracting + daily time limit)
- Focus Window enforcement
- Advanced nudge thresholds (3rd nudge onward)
- Dashboard access
- Channel blocking
- AI classification
- Journal

**Free gets:**
- Soft nudges (first nudge only)
- Shorts redirect (if toggle enabled)
- Video classification skipped (neutral default)
- Upgrade prompts at Pro thresholds
- Blurred dashboard with upgrade prompt

**Acceptance criteria:**
- Block Channel button hidden on Free
- Hard block never triggers on Free (upgrade prompt instead)
- Dashboard shows blurred placeholder for Free
- Switching from trial to free immediately removes Pro features

---

## WHAT IS EXPLICITLY OUT OF SCOPE

Do not build during this phase:
- Search limits (not in v2 spec)
- Allowance system
- Safari extension
- Mobile
- Social features
- Real-time dashboard updates
- Transcript analysis
- WebSockets

---

## ORDER OF EXECUTION

Execute phases in order. Do not start the next phase until the current one passes acceptance criteria.

1. Field Name & Schema Cleanup
2. Plan Sync Fix
3. Nudge & Block Threshold Rebuild
4. Shorts as Distracting Videos
5. Focus Window
6. Daily Time Limit Fix
7. Channel Blocking Fix
8. Overlay & Nudge UI Cleanup
9. AI Classify Wire Fix
10. Feature Gate Audit

---

## CURSOR WORKING RULES

Before any code change, state:
- WHAT will change
- WHY
- ACCEPTANCE CRITERIA

Then propose the minimal diff. Wait for "OK" before executing.

Do not touch files unrelated to the current phase.
Do not rename fields, routes, or database columns not listed in the phase.
Do not add features not in this plan or the v2 `.cursorrules`.

