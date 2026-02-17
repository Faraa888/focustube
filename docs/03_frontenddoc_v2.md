# FocusTube — Frontend Document
**Version:** v2 (MVP)

---

## Architecture

Two separate frontends:

1. **Web app** — React/Next.js on Vercel. Marketing, auth, dashboard, settings.
2. **Chrome extension** — Manifest V3. Content script, background script, popup.

The web app reads aggregated data and writes preferences only. The extension enforces rules and tracks behaviour.

---

## Web App Pages

### Page 1: Home / Landing
**File:** `frontend/src/pages/Home.tsx`

Sections:
- Hero (headline, subheadline, CTA buttons)
- Problem statement
- How it works (3 steps)
- Features grid (8 feature cards)
- Closing CTA

No fake social proof. No user counts. No ratings.
Copy reference: `docs/COPY_OVERVIEW_v2.md` Part 3 Page 1.

### Page 2: Pricing
**File:** `frontend/src/pages/Pricing.tsx`

- Free plan card
- Pro plan card (badge: "30-day free trial")
- FAQ section
- Closing CTA

Trial = 30 days everywhere. Never 14.

### Page 3: Signup
**File:** `frontend/src/pages/Signup.tsx`

- Email + password form
- Google OAuth button ("Continue with Google")
- Link to login page
- On submit → create Supabase account → set `trial_started_at` → set `plan = pro_trial` → redirect to Goals

### Page 4: Login
**File:** `frontend/src/pages/Login.tsx`

- Email + password form
- Google OAuth button
- Link to signup page
- On submit → Supabase auth → redirect to Dashboard

### Page 5: Goals (Onboarding)
**File:** `frontend/src/pages/Goals.tsx`

Shown after signup. Collects:
- Goals (free text)
- Pitfalls (free text) — field label is "What usually pulls you off track?" — never "Anti-goals"
- Optional channels to block (free text, AI-parsed via `POST /ai/parse-channels`)

On submit:
- Save goals and pitfalls to `extension_data`
- Call `POST /ai/parse-channels` once with raw channel text
- If parse fails → save raw text, flag, continue
- Redirect to Download page

### Page 6: Download
**File:** `frontend/src/pages/Download.tsx`

- Install Chrome extension CTA
- 3-step setup guide
- Post-install tips
- Link to create account and open dashboard

### Page 7: Dashboard (Trial + Pro only)
**File:** `frontend/src/pages/Dashboard.tsx`

**Metrics shown:**
- Focus Score: (% productive mins - % distracting mins) / total mins
- Watch time per day by distraction level
- Total watch time
- Most watched channels
- Most common distraction themes
- Peak distraction times

**Time ranges:** Last 7 days / Last 30 days / All time (max 60 days retained)

**Free users:** Blurred placeholder with upgrade prompt. Never an error state.

**Data:** Hourly batch aggregation. Raw data retained 60 days.

### Page 8: Settings (Trial + Pro full access, Free limited)
**File:** `frontend/src/pages/Settings.tsx`

Sections:
- Goals and pitfalls (editable)
- Blocked channels (add / remove)
- Behaviour toggles:
  - Block Shorts (redirect all Shorts immediately)
  - Hide recommendations
- Time settings:
  - Daily watch limit (0 = disabled, max 120 min)
  - Focus Window (enabled toggle, start time, end time)
- Plan status (trial days remaining, upgrade CTA)

**Pro-locked settings:** Visible but locked with upgrade prompt for Free users.

On save → `POST /extension/state` → extension receives `FT_SETTINGS_RELOADED` message → re-checks settings immediately.

### Page 9: Privacy Policy
**File:** `frontend/src/pages/Privacy.tsx`

### Page 10: Terms of Service
**File:** `frontend/src/pages/Terms.tsx`

### Page 11: 404 Not Found
**File:** `frontend/src/pages/NotFound.tsx`

---

## Shared Components

### Header (`frontend/src/components/Header.tsx`)
- Logo: FocusTube
- Nav: Home, Pricing, Download, Dashboard (auth), Settings (auth)
- Auth nav: Sign In (unauth), Sign Out (auth)
- CTA: "Start Free Trial" (unauth only)

### Footer (`frontend/src/components/Footer.tsx`)
- Logo, tagline
- Product links: Download, Pricing
- Legal links: Privacy Policy, Terms of Service
- Support email: support@focustube.co.uk
- Copyright

---

## Extension UI

### Popup (`extension/popup.html` + `extension/popup.js`)

Three views:
1. **Onboarding** — no account connected. Shows feature grid, trial CTA, sign in, continue free.
2. **Login form** — email input, connect account button.
3. **Status** — shows email, plan, trial days remaining, manage account button.

Trial banner shown when `plan = pro_trial`. Shows days remaining and upgrade button.

### Extension Overlays (via `content.js`)

All overlays rendered by content script. Full list:

| Overlay | Trigger | Dismissible |
|---|---|---|
| Onboarding overlay | First visit, no account | Yes (Got it button) |
| Free Shorts block | Shorts page + Free plan + block_shorts enabled | Yes (back to home) |
| Pro manual Shorts block | Shorts page + Pro + block_shorts_today = true | Yes |
| Channel blocked | Channel in blocked list | No (auto-redirect 2s) |
| Distracting 10s nudge | 3 distracting videos OR 20 min | Yes after 10s countdown |
| Distracting 30s nudge | 4 distracting videos OR 40 min | Yes after 30s countdown |
| Distracting hard block | 5 distracting videos OR 60 min | No (until midnight) |
| Daily time limit block | daily_time_limit_minutes reached | No (until midnight) |
| Focus Window block | Outside focus_window_start/end | No (until window opens) |
| Productive 5s nudge | 3 productive videos OR 30 min | Yes after 5s |
| Productive 30s nudge | 5 productive videos OR 60 min | Yes after 30s |
| Productive 5-min break | 7 productive videos OR 90 min | No (until timer expires) |
| Channel spiral nudge (daily) | 3 watches same channel today | Yes after 10s |
| Channel spiral nudge (weekly) | 5+ watches same channel last 7 days | Yes |
| Channel block confirmation | User clicks Block Channel | Yes (cancel or confirm) |
| Upgrade prompt | Free user hits Pro-only threshold | Yes |
| Journal entry | User clicks Add Note | Yes |
| Search warning banner | N-2 and N-1 searches (near search bar) | Auto-dismisses 5s |
| Search hard block | Search limit reached | No (redirect to home) |

### Extension Overlay Behaviour

- Distracting nudges: pause video mid-watch, show overlay, user can resume after timer
- Productive nudges: appear after video ends or on navigation
- Hard blocks: full screen, no dismiss, persist until reset condition
- Overlays paused mute the video and save state. On dismiss, muted state is restored but video stays paused (user must manually resume)
- Only one overlay shown at a time — `removeOverlay()` called before showing any new overlay

---

## Extension Behaviour Tracking

### Spiral Detection (channel-based)
Tracked in `ft_channel_spiral_count` and `ft_watch_history`.

- Watch history retained for 30 days (rolling window)
- Minimum watch duration to count: `SPIRAL_MIN_WATCH_SECONDS`
- Daily threshold: 3 watches from same channel today → soft nudge
- Weekly threshold: 5+ watches from same channel in last 7 days → stronger nudge
- 7-day dismissal cooldown per channel after user dismisses
- Consecutive videos from same channel within 1 hour → trend weighting applied (1.5x for 2 consecutive, 2.0x for 3+), only for distracting channels
- Spiral events persisted to `ft_spiral_events` (last 30 days)
- Count decay: weekly count decremented by 1 per 24 hours of inactivity per channel

### Lifetime Channel Stats
`ft_channel_lifetime_stats` stores per-channel:
- `total_videos`
- `total_seconds`
- `first_watched`
- `last_watched`

### Watch Event Batching
- Watch events queued in `ft_watch_event_queue`
- Sent to `POST /events/watch` when queue reaches 3 items or after 60 seconds
- Flushed on extension suspend/unload
- Minimum watch duration to queue event: 30 seconds

### AI Classification Timing
- Classification triggered after 45 seconds of watching
- If user navigates away before 45 seconds → video not classified
- Classification result cached per `(video_id, date)` in local storage for 24 hours
- Deferred classification with retry (up to 3 attempts, exponential backoff)
- If video changes during classification → result discarded

### Plan-Aware Settings
`computeEffectiveSettings(plan, rawSettings)` is computed client-side before any check:
- Free plan enforces: `shorts_mode = hard`, `hide_recommendations = true`, `daily_limit_minutes = 60`
- Pro/Trial plan uses stored values with safe defaults
- Legacy field `daily_limit` kept in sync with `daily_time_limit_minutes`

### Temporary Unlock
`isTemporarilyUnlocked(now)` — if active, all blocking and nudging is bypassed.

### Block Shorts for Today
`ft_block_shorts_today` — Pro user can manually block Shorts for the rest of the day. Resets at midnight.

---

## Plan Feature Gates

### Pro Trial and Pro users get
- Hard blocks (distracting and daily time limit)
- Focus Window enforcement
- All nudge thresholds
- Dashboard access (real data)
- All settings including channel blocking, focus window, daily limit
- AI classification
- Journal
- 15 searches per day

### Free users get
- Shorts redirect (if block_shorts toggle enabled)
- Watch counter increments
- Soft nudges only (first nudge, no hard blocks)
- Blurred placeholder dashboard + upgrade prompt
- Basic settings (toggles only, Pro settings locked)
- 5 searches per day
- Upgrade prompts at Pro thresholds

### Block Channel button
Only shown for Trial and Pro users. Hidden on Free.

---

## Copy Rules

All UI copy from `docs/COPY_OVERVIEW_v2.md`. Key rules:
- Trial = 30 days everywhere
- No emojis in any UI element
- No fake stats or ratings
- Field label for pitfalls: "What usually pulls you off track?" — never "Anti-goals" or "Distractions"
