# FocusTube — App Flow Document
**Version:** v2 (MVP)

---

## User Journey Overview

1. Land on focustube.co.uk
2. Sign up (email/password or Google OAuth)
3. `trial_started_at` set, `plan = pro_trial`
4. Goals onboarding — enter goals, pitfalls, optional channels
5. AI parses channel names once (`POST /ai/parse-channels`)
6. Redirect to Download page
7. Install Chrome extension
8. Extension boots, fetches state from backend
9. Daily usage loop begins

---

## Signup Flow

1. User enters email + password (or Google OAuth)
2. Supabase creates account
3. Server sets `trial_started_at = now()`, `trial_expires_at = now() + 30 days`, `plan = pro_trial`
4. Extension receives email via `FT_STORE_EMAIL_FROM_WEBSITE` message
5. Extension fetches plan and extension data from server
6. User redirected to Goals page

---

## Goals Onboarding

1. User enters goals (free text)
2. User enters pitfalls (free text) — field label: "What usually pulls you off track?"
3. User optionally enters channel names to block (free text)
4. On submit:
   - Goals and pitfalls saved to `extension_data`
   - `POST /ai/parse-channels` called once with raw channel text
   - If parse fails → save raw text, continue, flag for review
   - Redirect to Download page

---

## Extension Boot Sequence

On install or startup:

1. `ensureDefaults()` — creates default storage keys
2. `maybeRotateCounters()` — resets counters if day has changed
3. `syncPlanFromServer(force=true)` — fetch plan from backend
4. `loadExtensionDataFromServer()` — fetch goals, pitfalls, blocked channels, settings, spiral counts
5. Server state overwrites local cache
6. Listeners registered (navigation, watch time, channel detection)

---

## State Sync Triggers

Explicit syncs (immediate):
- On login → `FT_STORE_EMAIL_FROM_WEBSITE`
- On upgrade → Stripe webhook → `FT_PLAN_CHANGED` broadcast to YouTube tabs
- On settings change → `FT_RELOAD_SETTINGS` → `FT_SETTINGS_RELOADED` to all YouTube tabs
- On popup login → `FT_SYNC_PLAN`

Polling fallback: every 6 hours.

Background saves:
- Watch event queue → flushed every 60s or at 3 events
- Extension data → saved every 1 hour
- Timer state → saved every 15 minutes
- On suspend → flush queue + save data

---

## Daily Usage Loop (Per Navigation)

On every YouTube page navigation, in this order:

1. `ensureDefaults()` + `maybeRotateCounters()`
2. Sync plan (force if new video, debounced otherwise)
3. Increment page counter (`ft_searches_today`, `ft_watch_visits_today`, etc.)
4. Finalize previous video if leaving a watch page
5. Get current state from local cache
6. Get effective plan and settings
7. Classify content (if Pro/Trial and WATCH page and 45s elapsed)
8. Check unlock status (`isTemporarilyUnlocked`)
9. Build context for `evaluateBlock()`
10. Evaluate block result
11. Evaluate nudge thresholds (`evaluateThresholds()`)
12. Respond to content.js with action

---

## Channel Blocking Check

Happens before any other check.

1. Extract primary channel name from page (fast path: meta tags first, DOM fallback)
2. Check against `ft_blocked_channels` (permanent) and `ft_blocked_channels_today` (temporary)
3. Case-insensitive exact match only (primary channel only, collaborators ignored)
4. If matched → show channel blocked overlay → redirect to YouTube home after 2 seconds

---

## Focus Window Check

1. Check if `focus_window_enabled` is true
2. Get current local time
3. If outside `focus_window_start` to `focus_window_end` → show Focus Window block overlay
4. Max window: 6 hours. Earliest start: 08:00. Latest end: 22:00

---

## Daily Time Limit Check

1. Check `daily_time_limit_minutes` (0 = disabled)
2. Compare `ft_watch_seconds_today` against limit
3. If reached → hard block for rest of day
4. Resets at local midnight
5. Free users → upgrade prompt instead of hard block

---

## Search Limit Logic

| Plan | Counter | Warning | Hard block |
|---|---|---|---|
| Free | `ft_searches_today` | 3 and 4 | 5 → redirect home |
| Pro | `ft_searches_today` | 13 and 14 | 15 → redirect home |

Warning: small banner near search bar, auto-dismisses after 5 seconds.
Hard block: redirect to YouTube home.
Resets at local midnight.

---

## Video Classification Flow

1. On WATCH page navigation — start `ensureWatchTrackingForVideo()`
2. Schedule classification after 45 seconds (`scheduleWatchClassification`)
3. After 45s → call `classifyContent(videoMetadata, "watch")`
4. If video changed during classification → discard result
5. If classification succeeds → `persistWatchClassificationResult()` → `notifyWatchClassificationReady()`
6. Content script receives `FT_FORCE_NAV` → re-evaluates page with classification result
7. On retry: up to 3 attempts with exponential backoff

Classification input includes: `video_id`, `video_title`, `channel_name`, `video_description`, `video_tags`, `is_shorts`, `duration_seconds`, `related_videos`, `user_goals`

---

## Nudge and Block Thresholds

### Distracting Content

Counter: `ft_distracting_count_today` and `ft_distracting_minutes_today`

What increments the distracting counter:
- Any video classified as distracting
- Any Short (always distracting)
- Any neutral video from the 3rd neutral video onward

| Threshold | Action | Dismissible |
|---|---|---|
| 1-2 videos | No action | — |
| 3 videos OR 20 min | Pause + 10s nudge overlay | Yes after 10s |
| 4 videos OR 40 min | Pause + 30s nudge overlay | Yes after 30s |
| 5 videos OR 60 min | Hard block for rest of day | No |

Free users: soft nudge at 3 videos, upgrade prompt at 4+ instead of hard block.

### Neutral Content

| Counter | Action |
|---|---|
| First 2 videos | No action |
| 3rd onward | Increment distracting counter |

### Productive Content

Counter: `ft_productive_count_today` and `ft_productive_minutes_today`

| Threshold | Action | Dismissible |
|---|---|---|
| 3 videos OR 30 min | 5s "apply what you learned" nudge | Yes after 5s |
| 5 videos OR 60 min | 30s nudge | Yes after 30s |
| 7 videos OR 90 min | 5-minute break | No (until timer expires) |

Productive break resets productive counters only — not distracting counters.
Productive nudges appear after video ends or on navigation, not mid-video.

---

## Shorts Handling

Current behaviour (MVP):
- Shorts always treated as distracting (no AI call)
- Increment distracting counter
- If `block_shorts = true` → redirect immediately before counter logic runs
- If `ft_block_shorts_today = true` (Pro manual block) → redirect immediately
- Free plan + `strict_shorts = true` → hard block on Shorts page

Phase 11 (post-core): Channel-based classification for Shorts using shared `channel_classifications` table.

---

## Channel Spiral Detection

After each video finalized (minimum watch duration met):

1. Add to `ft_watch_history` (rolling 30-day window)
2. Calculate today count and last-7-days count per channel
3. Apply decay to weekly counts (decrement by 1 per 24h of inactivity)
4. Check for consecutive videos from same channel within 1 hour → apply trend weighting (1.5x for 2 consecutive, 2.0x for 3+, distracting channels only)
5. Check thresholds:
   - 3 watches today → soft nudge
   - 5+ watches last 7 days → stronger nudge
6. Check dismissal cooldown (7 days per channel)
7. If spiral detected → set `ft_spiral_detected` → nudge shown on next navigation from that channel
8. Save `ft_channel_spiral_count`, `ft_channel_lifetime_stats`, `ft_spiral_events`

---

## Journal Flow

1. User clicks "Add Note" on any nudge overlay
2. Full-screen journal entry overlay appears
3. User types note
4. On save → `FT_SAVE_JOURNAL` message to background
5. Background sends to `POST /journal` with note, channel, title, distraction_level, context
6. Stored raw in database — not processed by AI unless user requests insights

AI insights: generated only when user clicks "View journal insights" on dashboard — one-off OpenAI call per request.

---

## Trial Lifecycle

- Day 1: full Pro access, `trial_started_at` set, `plan = pro_trial`
- Day 30: auto-downgrade to Free, Pro features disabled
- Upgrade available at any time via Stripe Checkout
- On successful payment: webhook fires → updates plan → extension `FT_PLAN_CHANGED` → instant unlock

---

## Free Plan Behaviour

- Classification still runs (but defaults to neutral if skipped)
- Counters still increment
- Soft nudges only (first nudge only, no hard blocks)
- At Pro-only threshold → show upgrade prompt overlay instead of hard block
- Dashboard shows blurred placeholder + upgrade prompt (never an error state)
- 5 searches per day
- Block Shorts toggle works (immediate redirect)
- Channel blocking button hidden

---

## Counter Reset Rules

- All counters reset at local midnight via `maybeRotateCounters()`
- Reset period is daily only — weekly and monthly modes do not exist
- After distracting hard block → all counters reset next day
- `ft_block_shorts_today` resets at midnight
- `ft_blocked_channels_today` resets at midnight
- Timer counters persist across logout/login (daily limits continue)
- `ft_channel_spiral_count` uses decay (not hard reset)

---

## Failure Modes

- AI unavailable → classify as neutral, never break flow
- Backend unreachable → use cached rules
- Channel parse fails → save raw, flag, continue onboarding
- Classification delayed/fails → up to 3 retries with exponential backoff
- Watch event flush fails → queue retained, retried next flush
- Stripe webhook delayed → idempotent, safe to retry
