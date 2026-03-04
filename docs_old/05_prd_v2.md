# FocusTube — Product Requirements Document
**Version:** v2 (MVP)

---

## 1. Product Summary

FocusTube is a browser extension that helps users use YouTube intentionally.

Built for people who want to learn, build, or improve their lives but repeatedly spiral into distraction on YouTube despite good intentions. The core audience is wantrepreneurs and builders with a discipline problem.

FocusTube does not replace YouTube. It adds friction, awareness, and limits at the right moments.

**Core principles:**
- Users define goals and pitfalls
- Every video is classified as productive, neutral, or distracting
- Interventions are pattern-based, not single-video based
- Nudge first, block second

---

## 2. Target User

**Primary:**
- Wantrepreneurs, builders, learners, creators
- Use YouTube for learning, research, or inspiration
- Regularly fall into distraction loops
- Value clarity and self-awareness over strict blocking

**Secondary:**
- General users who want more intentional YouTube usage

**Non-goals:**
- Not a parental control tool
- Not a full internet blocker
- Not mobile-first or TV-based for MVP

---

## 3. Platforms (MVP)

- Chrome extension (desktop)
- Web app (marketing, dashboard, settings)
- Backend API (auth, plans, AI classification)

**Out of scope for MVP:** Safari extension, mobile apps, native desktop apps.

---

## 4. Plans and Trial

All users start on a 30-day Pro trial (no card required).

**Trial behaviour:**
- Full Pro functionality enabled
- `trial_started_at` stored server-side on signup
- `trial_expires_at` = `trial_started_at` + 30 days
- Trial days remaining checked daily

**End of trial:**
- User automatically downgraded to Free
- Upgrade available at any time

**Auth (MVP):**
- Email + password via Supabase Auth
- Google Sign-In (OAuth) via Supabase Auth

**Pricing:**
- £4.99 / month (monthly only for MVP)

**Plan values:**
- DB stores: `free`, `pro_trial`, `pro`
- Extension cache uses: `free`, `trial`, `pro`

---

## 5. Core Features

### 5.1 Video Classification (AI)

Every video classified as: `productive`, `neutral`, or `distracting`.

**Classification logic:**
1. Classify based on content alone (title, channel, metadata, related videos)
2. Override only if video directly matches a user goal or pitfall
3. Classification triggered after 45 seconds of watching
4. Accuracy target is "good enough", not perfect

**Shorts:** Always treated as distracting. No AI call needed.

**Caching:** Results cached per `(user_id, video_id)` with 24-hour TTL in local storage and Supabase `video_classifications` table.

**Free users:** Classification skipped, default to neutral.

**Failure:** If AI unavailable → classify as neutral, never break flow.

---

### 5.2 Nudging and Blocking Logic

All logic is per user and resets daily at local midnight unless otherwise stated.

**Distracting counter increments on:**
- Any video classified as distracting
- Any Short (always distracting)
- Any neutral video from the 3rd neutral video onward

**Distracting thresholds:**

| Threshold | Action |
|---|---|
| 1-2 videos | No action |
| 3 videos OR 20 min | Pause + 10s nudge overlay |
| 4 videos OR 40 min | Pause + 30s nudge overlay |
| 5 videos OR 60 min | Hard block for rest of day |

**Neutral videos:**

| Counter | Action |
|---|---|
| First 2 | No action |
| 3rd onward | Increment distracting counter |

**Productive thresholds:**

| Threshold | Action |
|---|---|
| 30 min OR 3 videos | 5s "apply what you learned" nudge (post-video) |
| 60 min OR 5 videos | 30s nudge (post-video) |
| 90 min OR 7 videos | 5-minute break (non-dismissible) |

Productive break resets productive counters only.

**Shorts behaviour:**
- If `block_shorts = true` → immediate redirect to YouTube home on any Shorts page
- If `block_shorts = false` → Shorts always feed into the distracting counter (no AI call)
- Phase 11 (post-core): channel-based classification via shared `channel_classifications` table

**Recommendations toggle:**
- `hide_recommendations` → hides sidebar and homepage feed via DOM manipulation
- No counter logic. Simple on/off per user setting.

**Search limits:**

| Plan | Warning | Hard block |
|---|---|---|
| Free | Search 3 and 4 | Search 5 → redirect home |
| Pro | Search 13 and 14 | Search 15 → redirect home |

Warning: small banner near search bar, auto-dismisses after 5 seconds.

**Daily time limit:**
- User sets `daily_time_limit_minutes` (0 = disabled, max 120)
- When limit reached → hard block YouTube for rest of day
- Resets at local midnight

**Focus Window:**
- User defines a time window during which YouTube is permitted
- Max window: 6 hours. Earliest start: 08:00. Latest end: 22:00
- Outside the window → YouTube blocked, redirect to home with message
- Stored as `focus_window_start` and `focus_window_end` in `extension_data`

**Additional rules:**
- Distracting nudges may appear mid-video (video paused)
- Productive nudges appear after video end or on navigation
- After distracting hard block, all counters reset next day

**Free users:**
- Soft nudges only (first nudge)
- At Pro-only thresholds → upgrade prompt instead of hard block

---

### 5.3 Channel-Based Signals

The system tracks how often a user watches the same channel.

**Rules:**
- 3 watches in a single day → soft nudge with optional journal
- 5+ watches in last 7 days → stronger nudge with optional journal
- 7-day dismissal cooldown per channel after user dismisses
- Consecutive videos from same channel within 1 hour → trend weighting (distracting channels only)

**Channel logic:**
- Only primary owning channel considered
- Collaborators ignored for MVP

**Blocked channels:**
- Can be added during onboarding (free text, AI-parsed)
- Can be added from any video page via "Block channel" button (Pro/Trial only)
- Can be added in Settings
- Persist across sessions, days, and devices
- Stored server-side in `extension_data`
- When matched → redirect to home with message

---

### 5.4 User Goals and Pitfalls

During onboarding (Trial + Pro):
- Goals — what they want YouTube to help them achieve
- Pitfalls — common distractions to flag
- Initial channels to block (optional free text, AI-parsed)

**Rules:**
- Goals and pitfalls are overrides, not strict filters
- System must not prevent reasonable unrelated content
- Goals and pitfalls are editable in Settings
- Field name is `pitfalls` everywhere — database, API, and UI

---

### 5.5 Extension UI

**Popup:**
- Onboarding view (no account)
- Login form
- Status view (logged in): email, plan, trial days, manage account

**Overlays:**
- Distracting nudges (10s, 30s, hard block)
- Productive nudges (5s, 30s, 5-min break)
- Daily time limit block
- Focus Window block
- Search warning banner (auto-dismisses 5s)
- Search hard block
- Channel spiral nudge (daily and weekly)
- Channel block confirmation
- Upgrade prompt (Free users at Pro thresholds)
- Journal entry overlay
- Onboarding overlay (first-time users)
- Shorts block overlays (Free hard block, Pro manual block)

---

## 6. Dashboard (Trial + Pro Only)

**Metrics:**
- Focus Score: (% productive mins - % distracting mins) / total mins
- Watch time per day by distraction level
- Total watch time
- Most watched channels
- Most common distraction themes
- Peak distraction times

**Time ranges:** Last 7 days / Last 30 days / All time (max 60 days)

**Dashboard behaviour:**
- Hourly batch aggregation
- Raw data retained up to 60 days
- Free users → blurred placeholder + upgrade prompt (never an error state)

---

## 7. Journal Feature

When nudges appear, users can click "Add Note" to open journal overlay.

**Journal entries:**
- Stored raw with video title, channel name, distraction level
- Not processed automatically

**AI summary:**
- Generated only when user clicks "View journal insights"
- One-off OpenAI call per request

---

## 8. Settings Page (Web)

Users can:
- Edit goals and pitfalls
- Manage blocked channels (add / remove)
- Toggle: Block Shorts
- Toggle: Hide recommendations
- Set daily time limit (0 = disabled, max 120 min)
- Set Focus Window (enabled toggle, start time, end time)
- View plan status and trial days remaining
- Upgrade CTA

**Free users:** Basic toggles accessible. Pro-only settings visible but locked with upgrade prompt.

---

## 9. Data and Storage Rules

- Supabase is the single source of truth
- Extension storage is cache only
- All settings, goals, pitfalls, and blocked channels persist server-side
- Watch history retained for 30 days (rolling) in local cache, 60 days in Supabase
- Spiral events retained for 30 days
- Field names consistent across all layers: `pitfalls`, `trial_started_at`, `focus_window_start`, `focus_window_end`

---

## 10. AI Usage (MVP)

**Used for:**
- Video classification: productive / neutral / distracting (cached 24h)
- Onboarding channel name parsing: `POST /ai/parse-channels` (once on onboarding only)
- Journal insights: on-demand only when user requests

**NOT used for:**
- Making blocking decisions alone
- Enforcing goals rigidly
- Real-time analysis during playback
- Shorts classification (always distracting without AI)

**Failure:** If AI unavailable → default to neutral. Never break user flow.

---

## 11. Non-Goals (Important)

Out of scope for MVP:
- Perfect AI classification
- Transcript-based analysis
- Mobile apps
- Safari extension
- Social accountability features
- Real-time dashboard updates
- Mid-feed Shorts blocking
- Cross-platform content aggregation
- Gamification

---

## 12. Definition of MVP Done

MVP is complete when:

- User can sign up (email or OAuth), start 30-day trial, install extension
- Video classification runs reliably after 45 seconds
- Nudges and blocking trigger at correct thresholds
- Search limits enforced correctly (warning banner + hard block)
- Blocked channels persist correctly across devices
- Focus Window enforces access outside defined hours
- Daily time limit triggers hard block when reached
- Channel spiral detection triggers nudge at correct thresholds
- Dashboard shows meaningful, accurate data for Trial/Pro users
- Free users see placeholder dashboard — not broken state
- Trial downgrades automatically at day 30
- Paid upgrade unlocks Pro features instantly

---

## 13. MVP Safety, Reliability, and Abuse Prevention

**Data integrity:**
- User settings, goals, pitfalls, blocked channels, and plan status persist across restarts
- Server-side storage is source of truth
- Local extension storage caches but never overrides server data

**Abuse and cost control:**
- All endpoints enforce rate limits
- Classification and aggregation are cached and batched
- AI channel parsing called once per onboarding — not on every login

**Input safety:**
- All inputs validated and sanitised before storage
- Malformed inputs fail safely
- No user input may cause crashes or corrupt state

**Authentication and plan enforcement:**
- Pro features enforced server-side
- Client-side state never trusted for plan enforcement
- Trial expiration occurs automatically

**Secrets:**
- No API keys or credentials exposed client-side
- All sensitive values via environment variables
- Secrets rotatable without code changes

**Failure and degradation:**
- Network failures degrade gracefully
- Extension usable even if backend or AI unavailable
- Default to safe, non-destructive behaviour in failure states

**Privacy:**
- Only data required for functionality collected
- Raw user data not processed by AI unless explicitly triggered
- No silent background analysis

**Security:**
- Modern web security best practices
- XSS, injection, token leakage mitigated
- All communication over HTTPS
