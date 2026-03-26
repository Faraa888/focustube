# PRODUCT_SPEC.md
# FocusTube — Product Specification (Rebuild Reference)

---

## 1. PRODUCT DEFINITION

**One sentence:** FocusTube gives aspiring entrepreneurs control over their YouTube addiction by adding friction when they spiral and clarity when they drift — so YouTube stops wasting their time.

**Target user:** Wantrepreneurs and builders who use YouTube for learning and research but repeatedly fall into distraction loops, consuming far more than they produce.

**Core problem:** No one holds users accountable while they watch. They lack the discipline to stop and act, or compulsively open YouTube at bad times. FocusTube breaks these patterns by detecting spirals in real time and enforcing the limits users set for themselves.

**Core value:** Gives users control over their time so they can learn skills, build things, and spend time on what matters — instead of endlessly consuming content.

---

## 2. PLANS & PRICING

| Plan | Price | Features |
|------|-------|----------|
| Trial | Free, 14 days, no card required | Full Pro functionality |
| Pro | $5/month | Full functionality |
| Expired (Free) | $0 | Extension disabled; normal YouTube; upgrade CTA shown |

**Trial logic:**
- `trial_expires_at` = signup timestamp + 14 days, stored server-side
- Trial status checked server-side on every `/extension/bootstrap` call
- At expiry: extension disables automatically, no manual intervention needed
- Upgrade nudges shown on days 7, 10, 11, 12, 13 (first YouTube visit per day + popup open)

**When trial expires — popup shows:**
```
Your 14-day trial has ended.

You watched X hours this month.
FocusTube helped you stay focused for Y% of that time.

[Upgrade to Pro — $5/month]
[No thanks, uninstall extension]
```

---

## 3. AUTHENTICATION

- Email + password signup (Supabase Auth)
- Google OAuth signup (Supabase Auth)
- Both methods available on signup and login pages simultaneously
- Email verification required (Supabase built-in)
- Disposable email blocklist enforced on signup (server-side, checked before user creation)
- Sessions: 14-day inactivity expiry, auto-refresh via Supabase client
- Extension identifies users by email only (no Supabase session in extension)

---

## 4. USER JOURNEY (CRITICAL PATH)

### Step 1 — Landing page
User visits `focustube.co.uk`. Sees pain/solution messaging and "Start Free Trial" CTA.

### Step 2 — Signup
User clicks CTA → signup page (email or Google OAuth). System creates user in Supabase with `plan="trial"`, `trial_expires_at` = now + 14 days. Redirects to `/goals`.

### Step 3 — Onboarding (Goals page)
User enters: Goals, Pitfalls, Channels to block (optional free text). System passes channel names through OpenAI to normalize spelling/typos. Saves to Supabase. Redirects to YouTube (with extension loaded).

### Step 4 — YouTube with extension active
Extension tracks watch time, classifies videos after 30 seconds, shows nudges and blocks per rules defined in Section 6.

### Step 5 — Return visit
If logged in → redirect to `/app/dashboard`. If not → landing page.

### Step 6 — Extension popup
Shows email, trial status, links to Dashboard and Settings.

### Step 7 — Trial upgrade nudges
Days 7, 10, 11, 12, 13: dismissable overlay on first YouTube visit + when popup is opened. Message: "Your trial ends in X days. Upgrade to keep your focus."

### Step 8 — Trial expiry (Day 14)
Extension disables. Upgrade screen shown with usage stats from trial period.

---

## 5. ONBOARDING (GOALS PAGE)

Fields:
- **Goals** — what the user wants YouTube to help them achieve (free text, max 500 chars)
- **Pitfalls** — common distractions to flag (free text, max 500 chars)

Field name is `pitfalls` everywhere — DB, API, and UI. Not "anti-goals", not "bad channels".

After submit: data saves to Supabase, then redirect to YouTube.

Channels are NOT blocked during onboarding. Users block channels directly on YouTube via the Block Channel button.

---

## 6. VIDEO CLASSIFICATION (AI)

**Trigger:** After 30 seconds of watch time on any video.

**Two-pass classification:**
1. First pass: `gpt-4o-mini` classifies video using title, channel, description, category, tags + user goals and pitfalls
2. If confidence < 0.65: second pass using `claude-sonnet-3-5` with same inputs; accept result regardless of confidence
3. If API fails at any point: default to `"neutral"` — never break user flow

**Output:** `"productive"` | `"neutral"` | `"distracting"` + confidence score

**Cache:** Store result per `(user_id, video_id)` for 24 hours. Skip classification if cached result exists.

**Shorts:** Always classified as `"distracting"` for MVP. No per-Short AI classification.

**Rate limit:** 50 classifications per user per day.

---

## 7. NUDGING & BLOCKING LOGIC

All counters are per user, reset daily at local midnight. Counters track: video count and watch time per category.

### 7.1 Distracting Videos

| Threshold | Action |
|-----------|--------|
| 2 videos OR 20 mins | 10-second non-dismissable overlay, video paused |
| 3 videos OR 30 mins | 30-second non-dismissable overlay, video paused |
| 4 videos OR 45 mins | 5-minute hard block of all YouTube ("Take a break" message) |

After the 5-minute block ends, user can resume. Counters do NOT reset — they persist until midnight.

**Nudge message (threshold 1 & 2):** "Are you sure you're not getting pulled off track?"

**Hard block message:** "Take a break. Come back in 5 minutes."

### 7.2 Neutral Videos

- First 2 neutral videos: no action
- From the 3rd neutral video onward: counts as distracting (adds to distracting video count AND distracting watch time)

### 7.3 Productive Videos

| Threshold | Action |
|-----------|--------|
| 3 videos OR 30 mins | 5-second non-dismissable overlay |
| 5 videos OR 60 mins | 30-second non-dismissable overlay |
| 7 videos OR 90 mins | 5-minute soft break overlay (positive tone) |

After 5-minute productive break, user can resume. Productive break resets only productive counters.

**Nudge message (threshold 1 & 2):** "Time to apply what you've learned?"

**Soft break message:** "Take a breather, keep going after!"

### 7.4 Daily Time Limit

- User sets total daily YouTube time: 0–120 minutes (0 = disabled)
- When limit reached: full-screen blocking overlay, underlying video paused and muted
- YouTube inaccessible for rest of day
- Resets at local midnight

**Hard block message:** "You've hit your daily limit. Time to focus on what matters. See you tomorrow."

### 7.5 Focus Window

- User defines time window when YouTube is permitted (within 08:00–22:00 only)
- Maximum window: 6 hours
- Outside the window: YouTube blocked, redirect to home with overlay
- Focus window defaults to DISABLED for new users (no default active window)
- Stored server-side as `focus_window_start` and `focus_window_end`

**Block message:** "Outside your focus hours. YouTube is blocked until [time]."

### 7.6 Nudge Timing Rules

- Distracting nudges: may appear mid-video (pause the video)
- Productive nudges: appear after video ends or on navigation
- Hard blocks: immediate, full-screen, non-dismissable during block period

---

## 8. CHANNEL BLOCKING

**How users block channels:**
Channels can ONLY be blocked via the Block Channel button on YouTube itself. No text input anywhere.
The button appears on three page types:
- Watch pages — next to the channel name
- Shorts pages — floating button
- Channel pages (`/@handle`, `/channel/...`) — below the channel header

**Collaborative videos:** When multiple channels are detected (via `a[href^="/@"]` in the DOM), a small picker lets the user choose which channel(s) to block. Single-channel videos block immediately.

**Identifier:** `@handle` scraped from DOM anchor hrefs. Stored as object:
`{ handle: "@MrBeast", name: "MrBeast", blockedAt: "2026-03-20" }`

**Behavior when matched:** Redirect to YouTube home with dismissable overlay ("Channel blocked"). Block check runs on page load before video plays by extracting all `@handle`s from the DOM.

**Unblocking:** No self-service unblock. User must email support@focustube.co.uk.

**Settings page:** Read-only list with two columns: @handle | date blocked. Empty state: "No channels blocked yet. Visit a YouTube channel and click Block Channel to add one."

**Persistence:** Blocked channels stored server-side in Supabase. Sync to extension within 3 minutes of change.

**Backwards compatibility:** Legacy entries stored as plain display-name strings are matched by case-insensitive display name. New entries always use @handle format.

---

## 9. SHORTS HANDLING

**User toggle in Settings:**

**Option A — Block entirely (default: off):**
- Any Shorts page → redirect to YouTube home with dismissable overlay ("Shorts blocked")

**Option B — Track with nudges (default: on):**
- Count any Short watched >5 seconds as "watched"
- Display counter in corner of screen: time watched + number of Shorts today
- Dismissable overlays at: 2 mins, 5 mins, 10 mins, 20 mins ("Are you sure you want to keep doing this?")

---

## 10. RECOMMENDATIONS HIDING

User toggle in Settings:
- Hide YouTube homepage recommendations
- Hide sidebar recommendations
- When enabled: blank/minimal homepage, no sidebar suggestions

---

## 11. SEARCH COUNTER

- Tracks YouTube searches per day
- Counter visible as "X/15 searches" in the search bar area while typing
- At 13 searches: warning message "Almost at your search limit — make sure you want to watch these"
- At 14 searches: same warning
- At 15 searches: no more searches allowed for the day (search blocked)
- Resets at local midnight

---

## 12. VISUAL OVERLAYS (ALWAYS-VISIBLE)

### Watch time counter
- Small corner display visible on all YouTube pages including fullscreen
- Shows total watch time for today

### Shorts counter
- Visible on Shorts pages only
- Shows: time watched today + number of Shorts watched today

### Search counter
- Visible while typing in YouTube search bar
- Shows: "X/15 searches"

---

## 13. CHANNEL-BASED SPIRAL SIGNALS

The system tracks how often a user watches the same channel.

| Threshold | Action |
|-----------|--------|
| 3 watches of same channel in a single day | Short nudge overlay |
| 5+ watches of same channel in last 7 days | Stronger nudge overlay |

Only the main channel is considered. Collaborators ignored.

---

## 14. DASHBOARD (TRIAL + PRO ONLY)

Accessible at `/app/dashboard`. Data refreshes on page load. Raw data retained 60 days.

**Metrics shown:**
- **Focus Score:** % of minutes spent on productive content
- **Watch time by content type** (productive / neutral / distracting) by time of day — last 60 days
- **Peak usage label:** e.g. "Peak usage: 9–11pm" (calculated from data, not AI-generated)
- **Most watched channels** — ranked by total time
- **Biggest distracting channels** — ranked by time, with "Block" button next to each

**Time ranges:** Last 7 days / Last 30 days / All time (up to 60 days)

**Free/expired users:** See blurred placeholder dashboard with upgrade prompt. Not an error state.

---

## 15. EXTENSION POPUP

### Logged-out state
```
Welcome to FocusTube
Sign in or start your free trial to take back control over YouTube.

[Start Free Trial] → focustube.co.uk/signup
[Sign In] → focustube.co.uk/login
```

### Logged-in state (Trial)
```
user@email.com
Pro trial: 23 days left

[Upgrade to Pro]
[View Dashboard] → focustube.co.uk/app/dashboard
[Settings] → focustube.co.uk/app/settings
```

### Logged-in state (Pro)
```
user@email.com
Pro plan

[View Dashboard]
[Settings]
```

### Expired state
```
Your 14-day trial has ended.
You watched X hours this month.
FocusTube helped you stay focused for Y% of that time.

[Upgrade to Pro — $5/month]
[No thanks, uninstall extension]
```

---

## 16. SETTINGS PAGE

### General settings (all users)
- Edit Goals (text, max 500 chars)
- Edit Pitfalls (text, max 500 chars)
- Manage blocked channels (read-only list, no unblock button, "Email support to unblock")
- Add new channels to block (text input, AI-normalized)

### Pro/Trial toggles
- Block Shorts (toggle, default: off)
- Hide recommendations (toggle, default: off)
- Daily time limit (slider 0–120 mins, 0 = disabled)
- Focus Window: enabled/disabled, start time, end time (15-min increments, 08:00–22:00, max 6 hours)

### Plan section
- View plan status and trial days remaining
- Upgrade CTA (if on trial)

**Free/expired users:** Pro-only settings visible but locked with upgrade prompt overlay.

---

## 17. COPY & MESSAGING

**Landing page headline:** "No More YouTube Spirals"

**Landing page subheadline:** "FocusTube adds friction where you spiral and clarity when you drift — so YouTube stops wasting your time and you remain in control."

**Main CTA:** "Start Free Trial"

**Problem section:** "Deleted the app. Blocked Shorts. Unsubscribed. Logged out. And yet — 40 minutes gone on a Tuesday night watching something you didn't plan to watch. The problem isn't you. It's that YouTube is built to pull you in. FocusTube adds the friction YouTube won't."

---

## 18. SUCCESS CRITERIA

- [ ] User signs up (email OR Google OAuth) → row created in `auth.users` and `public.users` with `plan="trial"`
- [ ] Extension popup syncs with website login state within 3 minutes
- [ ] Watch video for 30s → classified → correct counter increments
- [ ] Distracting thresholds trigger overlays at correct counts/times
- [ ] Productive thresholds trigger overlays at correct counts/times
- [ ] Neutral videos 1–2 free; 3rd onward counts as distracting
- [ ] Daily time limit triggers hard block when reached
- [ ] Focus window blocks YouTube outside defined hours
- [ ] Focus window defaults to disabled for new users
- [ ] Channel block saves to Supabase instantly, reflects in extension within 3 minutes
- [ ] Shorts: block mode redirects; track mode shows counter and nudges
- [ ] Search counter tracks, warns at 13/14, blocks at 15
- [ ] Dashboard shows accurate data for Trial/Pro users
- [ ] Free/expired users see blurred placeholder, not error state
- [ ] Trial upgrade nudges appear on days 7, 10, 11, 12, 13
- [ ] Trial expires automatically at day 14, extension disables
- [ ] Paid upgrade unlocks Pro features instantly
- [ ] Disposable email domains rejected at signup
- [ ] Dashboard loads in under 2 seconds
- [ ] Extension loads in under 1 second

---

## 19. NON-GOALS (NOT BUILDING FOR MVP)

- Journal prompting and insights (post-MVP)
- Per-Short AI classification (post-MVP)
- Personalized video weighting using historical data
- Safari extension
- Mobile apps
- Social accountability features
- Real-time dashboard updates
- Device fingerprinting / FingerprintJS
- IP blocking
- Credit card requirement for trial
