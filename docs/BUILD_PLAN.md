# BUILD_PLAN.md
# FocusTube — Rebuild Execution Plan

**Strategy:** Clean rebuild. Windsurf reads the three spec docs and writes everything fresh. No legacy code carried forward.

**Reference docs (Windsurf must read before any phase):**
- `PRODUCT_SPEC.md` — what the product does
- `TECH_SPEC.md` — how to build it
- `UI_SPEC.md` — how it looks

---

## KEEP (Don't Touch)

Nothing from the old codebase is kept verbatim. However, the following patterns and structures carry forward as confirmed-correct references for the rebuild:

- Supabase auth flow (email + OAuth) — logic is correct, implementation needs cleanup
- Database table names: `users`, `extension_data`, `video_sessions`, `video_classifications`, `journal_entries`
- Stripe integration pattern (create-checkout → webhook → update plan)
- shadcn/ui component library selection
- React + Vite + Tailwind + TypeScript stack
- Vercel (frontend) + Render (backend) deployment targets
- Extension manifest v3 structure with service worker background

---

## DELETE (Remove From Old Codebase — Do Not Rebuild)

| Item | Reason |
|------|--------|
| Hardcoded `https://focustube-backend-4xah.onrender.com` in 10+ files | Replace with `BACKEND_URL` env var |
| `STRIPE_PRICE_ANNUAL` and `STRIPE_PRICE_LIFETIME` env vars and references | Dead code — monthly only for MVP |
| `ft_allowance_videos_left`, `ft_allowance_seconds_left` in state.js | Dead code |
| `ft_reset_period` weekly/monthly logic | Dead code |
| `ft_user_anti_goals` | Renamed to `pitfalls` everywhere |
| `PERIOD_WEEKLY`, `PERIOD_MONTHLY` constants | Dead code |
| `nudge_style` field in settings schema | Not in spec |
| `POST /extension/bootstrap` partial implementation | Replace with clean `/extension/bootstrap` GET endpoint |
| `DEBUG_MODE = true` hardcoded | Must be `false` in prod, controlled by `NODE_ENV` |
| Commented-out Google OAuth buttons | Enable fully |
| Missing `/forgot-password` route | Build it |
| `CORS_ORIGIN` env var (read but not used) | Remove — use `FRONTEND_URL` |
| `pro_trial` vs `trial` inconsistency | Use `"trial"` everywhere in DB and extension |
| Stripe webhook with no signature verification | Rebuild with `stripe.webhooks.constructEvent()` |
| No rate limiting | Rebuild all endpoints with `express-rate-limit` |
| `/user/update-plan` with no auth | Rebuild with `ADMIN_SECRET` header check |
| `streakDays: 0` hardcoded in dashboard | Remove streak from response (not in spec) |

---

## PHASE 1: Foundation — Auth, Database, Backend Bootstrap
**Target: 1 day**

### Tasks

**1.1 Backend setup**
- Fresh `server/src/index.ts` with Express
- CORS reading from `FRONTEND_URL` env var (not hardcoded)
- `express-rate-limit` installed and applied to all routes
- `BACKEND_URL`, `FRONTEND_URL`, `ANTHROPIC_API_KEY` added to env var list
- `GET /health` endpoint
- Stripe webhook rebuilt with signature verification using `stripe.webhooks.constructEvent()`
- `/user/update-plan` protected by `ADMIN_SECRET` header check

**1.2 Database schema**
- Run migrations 000–008 + RLS setup in Supabase SQL editor
- Verify all tables exist: `users`, `extension_data`, `video_sessions`, `video_classifications`, `journal_entries`
- Verify `extension_data.settings` defaults: `focus_window_enabled: false` (not true)
- Verify `pitfalls` column name (not `anti_goals`) in `extension_data`

**1.3 Disposable email blocklist**
- `DISPOSABLE_EMAIL_DOMAINS` env var (comma-separated)
- Server-side check on signup before user creation
- Return `400 { error: "Email provider not supported" }`

**1.4 Auth endpoints and flows**
- `GET /extension/bootstrap` — single endpoint returning plan, trial data, goals, pitfalls, blocked channels, settings
- `GET /license/verify` — lightweight plan check for popup
- Email signup: creates `auth.users` + `public.users` with `plan="trial"`, `trial_expires_at = now + 14 days`
- Google OAuth: creates `public.users` row if new user, routes to `/goals` for new or `/app/dashboard` for returning
- Login: queries `public.users` for plan, sends email to extension via bridge
- Forgot password page built at `/forgot-password` using `supabase.auth.resetPasswordForEmail()`

**1.5 Frontend auth pages**
- `/signup` — email form + Google OAuth button (both enabled)
- `/login` — email form + Google OAuth button (both enabled)
- `/forgot-password` — email form, success alert
- `useRequireAuth` hook — guards `/app/*` routes
- `website-bridge.js` — postMessage bridge on `focustube.co.uk` domain
- `storeEmailForExtension()` utility

**1.6 Extension foundation**
- `manifest.json` — reads `BACKEND_URL` and `FRONTEND_URL` from build-time env
- `lib/config.js` — exports `BACKEND_URL`, `FRONTEND_URL` (never hardcoded)
- `lib/constants.js` — `DEBUG_MODE = NODE_ENV !== "production"`
- `lib/state.js` — all chrome.storage.local keys per TECH_SPEC section 6
- Background service worker: handle `FT_STORE_EMAIL_FROM_WEBSITE`, trigger `/extension/bootstrap` on login
- `popup.js` + `popup.html` — logged out / trial / pro / expired states

### Files to create
```
server/src/index.ts
server/src/supabase.ts
server/.env.example
frontend/src/pages/Signup.tsx
frontend/src/pages/Login.tsx
frontend/src/pages/ForgotPassword.tsx
frontend/src/hooks/useRequireAuth.ts
frontend/src/lib/supabase.ts
frontend/src/lib/extensionBridge.ts
frontend/src/App.tsx (routing)
extension/manifest.json
extension/lib/config.js
extension/lib/constants.js
extension/lib/state.js
extension/background/background.js
extension/popup.html
extension/popup.js
extension/content/website-bridge.js
```

### Phase 1 pass criteria (must all pass before Phase 2)
- [ ] Email signup creates rows in both `auth.users` and `public.users`
- [ ] Google OAuth signup creates `public.users` row, routes to `/goals`
- [ ] Google OAuth returning user routes to `/app/dashboard`
- [ ] Disposable email domain (e.g. mailinator.com) rejected at signup
- [ ] Login sends email to extension via postMessage bridge
- [ ] Extension popup shows correct state: logged-out / trial / pro / expired
- [ ] `GET /extension/bootstrap` returns correct plan, goals, pitfalls, settings
- [ ] `focus_window_enabled` defaults to `false` for new users
- [ ] `GET /health` returns `{ status: "ok" }`
- [ ] Rate limiting returns `429` when exceeded
- [ ] Stripe webhook verifies signature before processing
- [ ] `BACKEND_URL` is read from env var — no hardcoded URLs anywhere
- [ ] `/forgot-password` sends reset email and shows success state

---

### Phase 1 Windsurf Prompt
```
Read PRODUCT_SPEC.md, TECH_SPEC.md, and UI_SPEC.md before writing any code.

Build Phase 1: Foundation — Auth, Database, Backend Bootstrap.

Tasks:
1. Fresh Express backend (server/src/index.ts) with:
   - CORS reading from FRONTEND_URL env var
   - express-rate-limit on all routes per TECH_SPEC section 9
   - GET /health endpoint
   - GET /extension/bootstrap endpoint per TECH_SPEC section 4
   - GET /license/verify endpoint
   - POST /webhook/stripe with stripe.webhooks.constructEvent() signature verification
   - POST /user/update-plan protected by ADMIN_SECRET header
   - Disposable email check on signup using DISPOSABLE_EMAIL_DOMAINS env var
   - BACKEND_URL never hardcoded — always from env

2. Frontend auth pages:
   - /signup with email form + Google OAuth button (both enabled)
   - /login with email form + Google OAuth button (both enabled)
   - /forgot-password with email input and success state
   - useRequireAuth hook guarding /app/* routes
   - website-bridge.js postMessage bridge on FRONTEND_URL domain
   - storeEmailForExtension() utility

3. Extension foundation:
   - manifest.json reading BACKEND_URL and FRONTEND_URL from build-time env
   - lib/config.js exporting BACKEND_URL, FRONTEND_URL
   - lib/constants.js with DEBUG_MODE = NODE_ENV !== "production"
   - lib/state.js with all chrome.storage.local keys per TECH_SPEC section 6
   - Background service worker handling FT_STORE_EMAIL_FROM_WEBSITE
   - popup.js + popup.html with all 4 states (logged-out, trial, pro, expired)

Design system: dark theme only, colors from UI_SPEC section 1, shadcn/ui components.
Auth flows: exactly per TECH_SPEC section 5.
Database schema: per TECH_SPEC section 3.

Do NOT build: video classification, nudges, overlays, dashboard, settings page. Those are later phases.
Do NOT hardcode any URLs. Do NOT use pro_trial — use "trial" everywhere.
```

---

## PHASE 2: Core Tracking — Classification & Counter Engine
**Target: 1 day**

### Tasks

**2.1 AI classifier endpoint**
- `POST /ai/classify` with two-pass logic:
  - Pass 1: `gpt-4o-mini`
  - If confidence < 0.65: Pass 2: `claude-sonnet-3-5` (Anthropic SDK)
  - Cache in `video_classifications` with 24h TTL
  - Default to `"neutral"` on any API failure
- Rate limit: 50/user/day
- Classification prompt per TECH_SPEC section 8

**2.2 Watch session recording**
- `POST /video/update-watch-time` — records completed video session to `video_sessions`
- `POST /extension/save-timer` — saves daily counter state
- `GET /extension/get-timer` — returns today's counters

**2.3 Extension counter engine**
- `lib/rules.js` — evaluates nudge/block thresholds
- `lib/spiral.js` — spiral detection logic
- Counter state in `chrome.storage.local` (`ft_daily_counters`)
- Daily reset logic: compare stored date vs today's local date, reset on mismatch
- Counter categories: distracting, neutral, productive (video count + watch seconds each)
- Neutral rule: first 2 free, 3rd onward adds to distracting counters

**2.4 Extension content script — tracking**
- `content/content.js` — video detection and watch time tracking
- Detect video page load and video changes (URL change listener)
- Trigger classification after 30 seconds of watch time
- On classification result: increment correct counter category
- Save counters to backend every 3 minutes OR every 10 video events
- Detect Shorts pages (`/shorts/` URL) — always classify as distracting

**2.5 Data sync**
- Background worker polls `/extension/get-data` every 3 minutes
- On data change: update local storage cache
- Bootstrap sync on wakeup

### Phase 2 pass criteria
- [ ] Watch video for 30s → `POST /ai/classify` called → result returned
- [ ] Low-confidence result triggers second pass with Claude Sonnet 3.5
- [ ] API failure defaults to `"neutral"` — video still plays
- [ ] Cached result returned within 24h — no duplicate API call
- [ ] Correct counter increments after classification
- [ ] Neutral videos 1–2: no counter change. 3rd: adds to distracting
- [ ] Shorts: always increments distracting counter
- [ ] Counters reset at local midnight
- [ ] `POST /extension/save-timer` saves correct data to Supabase
- [ ] Classification rate limit (50/day) returns 429 when exceeded

---

### Phase 2 Windsurf Prompt
```
Read PRODUCT_SPEC.md, TECH_SPEC.md, and UI_SPEC.md before writing any code.

Build Phase 2: Core Tracking — Classification & Counter Engine.
Phase 1 is complete. Do not modify auth, routing, or bootstrap endpoints.

Tasks:
1. POST /ai/classify with two-pass logic (TECH_SPEC section 8):
   - Pass 1: gpt-4o-mini
   - If confidence < 0.65: Pass 2: claude-sonnet-3-5 (Anthropic SDK, ANTHROPIC_API_KEY env var)
   - Cache in video_classifications, 24h TTL
   - Default "neutral" on any failure
   - Rate limit: 50/user/day

2. Watch session endpoints:
   - POST /video/update-watch-time — records to video_sessions
   - POST /extension/save-timer — saves daily counter state
   - GET /extension/get-timer — returns today's counters

3. Extension counter engine:
   - lib/rules.js — threshold evaluation per PRODUCT_SPEC section 7
   - lib/spiral.js — spiral detection
   - Counter state in chrome.storage.local (ft_daily_counters)
   - Daily reset at local midnight
   - Neutral rule: first 2 free, 3rd+ adds to distracting

4. content/content.js — tracking only (no overlays yet):
   - Detect video page loads and URL changes
   - Track watch time per video
   - Trigger /ai/classify after 30 seconds
   - Increment correct counters based on classification
   - Shorts detection (always distracting)
   - Sync counters every 3 minutes or every 10 video events

Do NOT build overlays, nudges, blocks, dashboard, or settings. Those are Phase 3 and 4.
```

---

## PHASE 3: Features & Nudges
**Target: 1 day**

### Tasks

**3.1 Nudge and block overlays**
- `content/overlay.css` — all overlay styles per UI_SPEC section 5
- Distracting overlay (non-dismissable, countdown timer, pauses video)
- Hard block overlay (5-minute timer, no dismiss, full-screen)
- Daily limit block overlay (blocks rest of day, shows midnight reset time)
- Focus window block overlay (shows when YouTube will unblock)
- Channel block overlay (dismissable, redirects to home)
- Shorts block overlay (dismissable, redirects to home)

**3.2 Nudge trigger logic in content.js**
- After each classification: check all thresholds via `rules.js`
- Distracting: 2 videos/20min → 10s nudge; 3 videos/30min → 30s nudge; 4 videos/45min → 5-min block
- Productive: 3 videos/30min → 5s nudge; 5 videos/60min → 30s nudge; 7 videos/90min → 5-min soft break
- Daily limit: check total seconds vs limit on each watch event
- Nudge timing: distracting mid-video (pause video); productive after video ends or navigation

**3.3 Focus window enforcement**
- On every YouTube page load: check current time vs `ft_focus_window_enabled`, `ft_focus_window_start`, `ft_focus_window_end`
- If outside window: show focus window block overlay
- Focus window defaults to disabled — no block if not configured

**3.4 Channel blocking**
- On every video page load: check channel name vs `ft_blocked_channels`
- If match: show channel block overlay, redirect to YouTube home
- "Block Channel" button in extension popup (on video pages): call `/extension/save-data` with updated blocked_channels, update local cache immediately

**3.5 Shorts handling**
- If `ft_settings.block_shorts = true`: redirect to home with Shorts block overlay on any `/shorts/` URL
- If tracking mode: show Shorts counter in corner, show nudge overlays at 2/5/10/20 minute thresholds

**3.6 Recommendations hiding**
- If `ft_settings.hide_recommendations = true`: inject CSS to hide YouTube homepage grid and sidebar recommendations

**3.7 Search counter**
- Track YouTube search submissions in `ft_search_count_today`
- Inject counter display into search bar area
- At 13 searches: warning color + message
- At 14 searches: same
- At 15: block search (prevent form submission / navigation)
- Reset at local midnight

**3.8 Watch time counter overlay**
- Always-visible corner display on all YouTube pages including fullscreen
- Shows today's total watch time
- Updates every minute

**3.9 Channel spiral signals**
- Track per-channel watch count today and last 7 days in local storage
- 3 watches same channel same day → short nudge overlay
- 5+ watches same channel in last 7 days → stronger nudge overlay

**3.10 Trial expiry nudges**
- Days 17, 23, 27, 28, 29: check `ft_trial_days_left` on first YouTube page load per day
- Show dismissable banner (top of page) once per day
- Also show in popup on open

### Phase 3 pass criteria
- [ ] Distracting: 2 videos/20min → 10s non-dismissable overlay, video paused
- [ ] Distracting: 3 videos/30min → 30s non-dismissable overlay
- [ ] Distracting: 4 videos/45min → 5-min hard block (resumes after, counters persist)
- [ ] Productive: 3 videos/30min → 5s nudge after video ends
- [ ] Productive: 5 videos/60min → 30s nudge
- [ ] Productive: 7 videos/90min → 5-min soft break
- [ ] Neutral: 3rd video correctly adds to distracting counters
- [ ] Daily time limit triggers full-screen block when reached
- [ ] Focus window blocks YouTube outside defined hours
- [ ] Focus window does NOT block if `focus_window_enabled = false`
- [ ] Blocked channel → redirect to home with dismissable overlay
- [ ] "Block Channel" button saves to Supabase, reflects in extension within 3 minutes
- [ ] Shorts block mode → redirect on any /shorts/ URL
- [ ] Shorts track mode → counter visible, nudge at 2/5/10/20 min
- [ ] Search counter visible while typing, warns at 13–14, blocks at 15
- [ ] Watch time counter visible on all YouTube pages including fullscreen
- [ ] Trial day 17/23/27/28/29 → dismissable banner on first YouTube visit

---

### Phase 3 Windsurf Prompt
```
Read PRODUCT_SPEC.md, TECH_SPEC.md, and UI_SPEC.md before writing any code.

Build Phase 3: Features & Nudges.
Phases 1 and 2 are complete. Do not modify auth, bootstrap, classification, or counter logic.

Tasks:
1. All overlay types per UI_SPEC section 5 and PRODUCT_SPEC section 7:
   - Distracting nudge overlay (non-dismissable, countdown, pauses video)
   - Hard block overlay (5-min timer, full-screen, no dismiss)
   - Daily limit block (rest of day, midnight reset message)
   - Focus window block (shows unlock time)
   - Channel block (dismissable, redirects home)
   - Shorts block (dismissable, redirects home)

2. Nudge trigger logic in content.js:
   - After each classification: evaluate all thresholds via rules.js
   - Thresholds exactly per PRODUCT_SPEC section 7
   - Distracting nudges mid-video (pause video first)
   - Productive nudges after video ends or on navigation

3. Focus window enforcement on every YouTube page load.
   - Only active if focus_window_enabled = true
   - Default is disabled — do not block new users

4. Channel blocking on every video page load.
   - "Block Channel" button: saves to Supabase immediately, local cache updated

5. Shorts handling: block mode redirects, track mode shows counter + nudges.

6. Recommendations hiding via injected CSS when setting enabled.

7. Search counter: inject into YouTube search area, track/warn/block per PRODUCT_SPEC section 11.

8. Always-visible watch time counter in corner (including fullscreen).

9. Channel spiral signals: nudge at 3/day and 5+ in 7 days.

10. Trial expiry nudges: days 17, 23, 27, 28, 29 — dismissable banner, once per day.

Design all overlays per UI_SPEC section 5. Dark theme, consistent with web app colors.
Do NOT build dashboard or settings page. Those are Phase 4.
```

---

## PHASE 4: Dashboard & Settings UI
**Target: 1 day**

### Tasks

**4.1 Dashboard endpoint**
- `GET /dashboard/stats` with hourly batch aggregation
- Returns: focus_score, total_watch_seconds, by_category, by_hour, peak_hours, top_channels, distracting_channels
- Time ranges: 7d, 30d, all (up to 60 days)
- Focus Score = % of minutes spent on productive content

**4.2 Dashboard page (`/app/dashboard`)**
- Summary stats row: Focus Score, total watch time, peak usage time
- Time range selector (7d / 30d / all)
- Stacked bar chart by hour of day (Recharts)
- Most watched channels list
- Distracting channels list with "Block" button per channel
- Free/expired: blurred placeholder with upgrade banner — not error state
- Empty state: "Start watching to see your focus patterns here."
- Load time target: under 2 seconds

**4.3 Goals onboarding page (`/goals`)**
- Goals textarea
- Pitfalls textarea
- Channels to block textarea
- On submit: call `/ai/normalize-channels`, then save to Supabase via `/extension/save-data`
- Loading states: "Normalising channel names..." → "Saving..."
- Skip link: saves empty, navigates to YouTube

**4.4 Settings page (`/app/settings`)**
- Tab 1: Goals — edit goals and pitfalls
- Tab 2: Channels — add blocked channels (with AI normalization), read-only blocked list, "Email support to unblock" message
- Tab 3: Controls — block shorts toggle, hide recommendations toggle, daily limit slider (0–120), focus window controls with validation
- Tab 4: Plan — plan status, upgrade CTA, Stripe portal link
- Pro/Trial users: full settings
- Free/expired users: lock overlay on entire settings page

**4.5 Settings sync**
- On settings save: call `POST /extension/save-data`
- Extension picks up new settings within 3 minutes via background poll

**4.6 Data cleanup job (server-side)**
- Purge `video_sessions` rows older than 60 days
- Run as a scheduled task or on `/health` calls (simple approach: delete where `watched_at < now() - interval '60 days'`)

### Phase 4 pass criteria
- [ ] Dashboard loads under 2 seconds for Trial/Pro users
- [ ] Focus Score calculated correctly: % of productive minutes
- [ ] Watch time chart shows data by hour, color-coded by category
- [ ] Most watched channels ranked by time
- [ ] Distracting channels list has working "Block" button
- [ ] Free/expired users see blurred placeholder — not an error or empty page
- [ ] Time range selector filters data correctly
- [ ] Goals page saves goals, pitfalls, and normalized channels to Supabase
- [ ] Settings save propagates to extension within 3 minutes
- [ ] Focus window validation: 08:00–22:00 only, max 6 hours, error shown inline
- [ ] Blocked channels show as read-only list with "email support to unblock" message
- [ ] Settings lock overlay shows for free/expired users

---

### Phase 4 Windsurf Prompt
```
Read PRODUCT_SPEC.md, TECH_SPEC.md, and UI_SPEC.md before writing any code.

Build Phase 4: Dashboard & Settings UI.
Phases 1, 2, and 3 are complete. Do not modify auth, classification, counter engine, or overlays.

Tasks:
1. GET /dashboard/stats endpoint per TECH_SPEC section 4:
   - Hourly batch aggregation
   - Focus Score = % productive minutes
   - Time ranges: 7d, 30d, all (up to 60 days)
   - Returns: by_category, by_hour, peak_hours, top_channels, distracting_channels

2. /app/dashboard page per UI_SPEC section 4:
   - Summary stats, time range selector, Recharts stacked bar chart by hour
   - Most watched + distracting channels lists
   - Distracting channels: "Block" button calls /extension/save-data
   - Free/expired: blurred placeholder + upgrade banner (not error state)
   - Load time: under 2 seconds

3. /goals onboarding page per UI_SPEC section 4:
   - Goals + Pitfalls textareas + Channels to block
   - Normalize channels via /ai/normalize-channels before save
   - Loading states: "Normalising channel names..." → "Saving..."
   - Skip link: saves empty, navigates to YouTube

4. /app/settings page per UI_SPEC section 4:
   - 4 tabs: Goals / Channels / Controls / Plan
   - Channels tab: read-only blocked list, no unblock button, "email support to unblock" message
   - Controls tab: shorts toggle, recommendations toggle, daily limit slider, focus window with validation
   - Plan tab: plan status, upgrade CTA
   - Free/expired: full-page lock overlay
   - On save: call /extension/save-data

5. Server-side data cleanup: purge video_sessions older than 60 days.

Design per UI_SPEC section 4. Dark theme. shadcn/ui components.
```

---

## PHASE 5: Polish & Deploy
**Target: 0.5 days**

### Tasks

**5.1 Security audit**
- [ ] All endpoints have rate limiting
- [ ] No hardcoded URLs anywhere — grep for `focustube-backend` and `onrender.com`
- [ ] No API keys in code — grep for key patterns
- [ ] Stripe webhook has signature verification
- [ ] `DEBUG_MODE = false` in production
- [ ] Input validation on all endpoints (schema validate, length limits, HTML strip)
- [ ] CORS reads from `FRONTEND_URL` env var
- [ ] `/user/update-plan` requires `ADMIN_SECRET`
- [ ] OAuth uses state parameter (Supabase handles this)

**5.2 Extension manifest final check**
- [ ] `externally_connectable` lists production `FRONTEND_URL` (not beta Vercel URL)
- [ ] `host_permissions` uses env var values, not hardcoded domains
- [ ] `DEBUG_MODE` correctly false in production build

**5.3 OAuth redirect URIs (Supabase dashboard)**
Add all production redirect URIs per TECH_SPEC section 13.

**5.4 Stripe webhook (Stripe dashboard)**
Point webhook to production backend URL. Subscribe to: `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.updated`.

**5.5 Environment variables (all platforms)**
- Vercel: set all `VITE_*` variables
- Render: set all server-side variables
- Verify `BACKEND_URL` on Vercel points to Render URL
- Verify `FRONTEND_URL` on Render points to Vercel/production URL

**5.6 Smoke test checklist**
- [ ] Sign up with email → confirmation email arrives → goals page loads
- [ ] Sign up with Google → goals page loads
- [ ] Disposable email (mailinator.com) → rejected
- [ ] Extension popup: logged-out state shows correctly
- [ ] Log in on website → extension popup updates within 3 minutes
- [ ] Watch a video for 30 seconds → classification fires (check network tab)
- [ ] Watch 2 distracting videos → 10-second nudge overlay appears
- [ ] Watch 4 distracting videos → 5-minute hard block appears
- [ ] Set daily limit to 5 minutes → block triggers after 5 minutes
- [ ] Set focus window to exclude current hour → YouTube blocked
- [ ] Block a channel via extension button → channel redirects on next visit
- [ ] Shorts: block mode redirects → track mode shows counter
- [ ] Search 15 times → search blocked
- [ ] Dashboard loads data for trial user
- [ ] Settings save → extension reflects changes within 3 minutes
- [ ] Stripe checkout → Pro plan activated after webhook
- [ ] Trial expiry: manually set `trial_expires_at` to past → extension disables

---

## WINDSURF WORKING RULES (Apply To Every Phase)

1. Read all three spec docs before writing any code
2. Never hardcode `BACKEND_URL`, `FRONTEND_URL`, or any production URL
3. `pitfalls` is the field name everywhere — not `anti_goals`, not `distractions`
4. `focus_window_enabled` defaults to `false` — new users must not be blocked
5. `DEBUG_MODE` is `false` in production
6. Plan value in DB is `"trial"` (not `"pro_trial"`)
7. Rate limiting on every endpoint — no exceptions
8. Stripe webhook always verifies signature
9. Never expose service role key, OpenAI key, or Anthropic key to client
10. When in doubt, degrade gracefully — never break the user's YouTube session
