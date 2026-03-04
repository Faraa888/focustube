# FocusTube — Technical Specification

**Version:** 1.0  
**Date:** February 2026  
**Status:** MVP (in active development)

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Architecture](#2-architecture)
3. [Authentication Flow](#3-authentication-flow)
4. [Core Features](#4-core-features-as-implemented-in-code)
5. [API Endpoints](#5-api-endpoints)
6. [Database Schema](#6-database-schema)
7. [Extension Architecture](#7-extension-architecture)
8. [Missing / Broken Features](#8-missing--broken-features)
9. [Deployment Configuration](#9-deployment-configuration)

---

## 1. Product Overview

### What FocusTube Does

FocusTube is a Chrome extension paired with a web app that helps users use YouTube intentionally. It adds friction, awareness, and limits to YouTube consumption by classifying videos using AI, tracking watch patterns over time, and progressively intervening with nudges and blocks when thresholds are crossed. It intervenes based on patterns — never on single-video judgment — and always nudges before it blocks.

### Target Users

People who recognise they have an unhealthy YouTube habit and want a structured, automated tool to enforce limits they've set for themselves — without willpower alone.

### Core Value Proposition

FocusTube sits between the user and YouTube, silently tracking their behaviour and enforcing their own stated goals. It uses AI to classify every video (productive / neutral / distracting), escalates through warning → nudge → hard block as consumption increases, and provides a dashboard showing real patterns over time.

---

## 2. Architecture

### Frontend

| Property | Value |
|---|---|
| Framework | React 18.3.1 with TypeScript |
| Build tool | Vite 5.4.19 |
| Router | React Router DOM 6.30.1 |
| Server state | TanStack React Query 5.83.0 |
| UI system | Tailwind CSS 3.4.17 + shadcn/ui (Radix UI primitives) |
| Charts | Recharts |
| Forms | React Hook Form 7.61.1 + Zod 3.25.76 |
| Auth client | Supabase JS 2.80.0 |
| Notifications | Sonner |
| Deployment | Vercel (SPA with rewrite rule in `vercel.json`) |
| Dev port | 8080 |
| Path alias | `@/*` → `./src/*` |

**Key frontend files:**

```
frontend/src/
├── pages/          Home, Login, Signup, Goals, Dashboard, Settings, Pricing, Download
├── components/     Header, Footer, dashboard/* (FocusScore, WatchTimeMap, SpiralFeed, ChannelAudit, WeeklySummary)
├── hooks/          useRequireAuth, use-mobile, use-toast
├── lib/            supabase.ts, extensionStorage.ts, utils.ts
└── App.tsx         Routing + extension logout listener
```

### Backend

| Property | Value |
|---|---|
| Runtime | Node.js |
| Framework | Express 4.18.2 |
| Language | TypeScript 5.3.3 |
| Database client | @supabase/supabase-js 2.38.4 |
| AI | openai 4.20.1 (gpt-4o-mini) |
| Payments | stripe 14.7.0 |
| Deployment | Render (service: `focustube-backend-4xah.onrender.com`) |
| CORS | Allows Chrome extensions, localhost, YouTube, Vercel domains |
| Main file | `server/src/index.ts` (~2583 lines) |
| DB helpers | `server/src/supabase.ts` (~513 lines) |
| AI prompt | `server/src/prompts/classifier.json` |

### Extension

| Property | Value |
|---|---|
| Manifest version | 3 |
| Background | Service worker (`background/background.js`, `type: module`) |
| Permissions | `storage`, `tabs` |
| Host permissions | `*://*.youtube.com/*`, backend URL, frontend URL, localhost ports |
| Content scripts | `content/content.js` + `content/overlay.css` on YouTube; `content/website-bridge.js` on frontend |
| Popup | `popup.html` + `popup.js` |
| Lib files | `lib/constants.js`, `lib/rules.js`, `lib/state.js`, `lib/spiral.js`, `lib/config.js` |

### Database

Supabase (PostgreSQL) with Row-Level Security (RLS). Service role key used server-side. Anon key used client-side for auth only.

**Tables:** `users`, `extension_data`, `video_sessions`, `video_classifications`, `journal_entries`

**Migrations:** `server/supabase-migrations/000` through `008`, plus `server/supabase-rls-setup.sql`

### External APIs

| Service | Purpose | SDK / Version |
|---|---|---|
| Supabase Auth | Email/password + Google OAuth | supabase-js 2.x |
| Supabase DB | Postgres (all persistence) | supabase-js 2.x |
| OpenAI | Video classification (`gpt-4o-mini`) | openai 4.x |
| Stripe | Subscription billing | stripe 14.x |

---

## 3. Authentication Flow

### Email Signup

**File:** `frontend/src/pages/Signup.tsx`

1. User submits email + password form
2. `supabase.auth.signUp({ email, password })` called
3. Supabase creates auth record and sends confirmation email
4. On success: `supabase.from("users").insert({ email, plan: "trial", trial_started_at, trial_expires_at })` — trial is set to 30 days from now
5. `storeEmailForExtension(email)` called — sends `FT_STORE_EMAIL_FROM_WEBSITE` postMessage to `website-bridge.js`
6. `website-bridge.js` receives postMessage, calls `chrome.runtime.sendMessage({ type: "FT_STORE_EMAIL_FROM_WEBSITE", email })` to background service worker
7. Background stores `ft_user_email` and triggers `syncPlanFromServer()`
8. Frontend navigates to `/goals` for onboarding

### Google OAuth Signup

**File:** `frontend/src/pages/Login.tsx` (handles both new and returning OAuth users)

1. User clicks "Continue with Google"
2. `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })` called
3. User redirected to Google, authenticates, redirected back to `/login` (or `/login?return=extension`)
4. On return, `useEffect` runs `supabase.auth.getSession()`
5. If session found: checks `users` table for existing record
6. If no record (new user): inserts into `users` table with `plan: "trial"`, 30-day expiry
7. `storeEmailForExtension(email)` called via postMessage bridge
8. If `?return=extension`: closes tab after 2 seconds
9. If new user: navigates to `/goals`; if returning user: navigates to `/app/dashboard`

### Email Login

**File:** `frontend/src/pages/Login.tsx`

1. User submits email + password
2. `supabase.auth.signInWithPassword({ email, password })` called
3. On success: `supabase.auth.getSession()` to get session
4. Queries `users` table: `select("plan").eq("email", email)` to get current plan
5. `storeEmailForExtension(email)` called
6. If extension context available: `chrome.storage.local.set({ ft_data_owner_email, ft_plan })`
7. If `?return=extension`: closes window after 1.5s
8. Otherwise: navigates to `/app/dashboard`

### Session Management

- Supabase handles session persistence via `localStorage` on the frontend
- `hooks/useRequireAuth.ts` guards `/app/*` routes — redirects to `/login` if no session
- Sessions auto-refresh via Supabase client
- Extension does NOT use Supabase sessions — it identifies users by email only
- `App.tsx` listens for `FT_LOGOUT_FROM_EXTENSION` window messages to handle extension-triggered logouts

### Extension Sync (What Gets Stored in chrome.storage.local)

When a user logs in via the website, the following gets written to `chrome.storage.local`:

| Key | Value | Source |
|---|---|---|
| `ft_user_email` | User email | Set by background on `FT_STORE_EMAIL_FROM_WEBSITE` |
| `ft_data_owner_email` | Normalised email (cache ownership check) | Set on login |
| `ft_plan` | `"free"` \| `"trial"` \| `"pro"` | Fetched from `/license/verify` |
| `ft_trial_expires_at` | ISO timestamp | From server |
| `ft_days_left` | Integer (days remaining) | From server |
| `ft_can_record` | Boolean | From server |

After email is stored, background calls `syncPlanFromServer()` → `GET /license/verify?email=` → writes plan keys to storage. Then calls `loadExtensionDataFromServer()` → `GET /extension/get-data?email=` → writes goals, pitfalls, blocked channels, settings to storage.

**Website → Extension communication path:**

```
Website (postMessage) → website-bridge.js (content script) → chrome.runtime.sendMessage → background.js
```

`extensionStorage.ts` sends `window.postMessage()` with a `requestId`, waits up to 5 seconds for `FT_RESPONSE` reply. If extension not installed, fails silently.

---

## 4. Core Features (As Implemented in Code)

### 4.1 Video Tracking & Classification

**What it does:** Every video watched on YouTube is classified as `productive`, `neutral`, or `distracting` using OpenAI. Classifications are cached for 24 hours per user+video pair. Classification triggers 45 seconds after the video starts playing.

**Files:**
- `extension/background/background.js` — `classifyVideo()`, `runDeferredWatchClassification()`, `scheduleWatchClassification()`, `persistWatchClassificationResult()`
- `extension/content/content.js` — `startVideoWatchTracking()`, `extractVideoMetadata()`, `extractChannelFast()`
- `server/src/index.ts` — `POST /ai/classify` handler
- `server/src/supabase.ts` — `upsertVideoClassification()`

**Flow:**
1. `content.js` detects navigation via YouTube's `yt-navigate-finish` event and URL polling
2. `extractVideoMetadata()` collects: title, description (expanded if collapsed), tags, channel, duration, category, related videos, video ID
3. `FT_NAVIGATED` message sent to background with full metadata
4. Background schedules AI classification after 45 seconds (only if user watches long enough)
5. `POST /ai/classify` called with video metadata + user goals from storage
6. Server checks `video_classifications` table for cached result (24h TTL based on `updated_at`)
7. If no cache: calls OpenAI `gpt-4o-mini` with prompt from `classifier.json`, JSON mode, temperature 0.3, max 350 tokens
8. Result cached in `video_classifications` table
9. Result stored in `ft_last_watch_classification` in chrome.storage
10. Classification updates `ft_distracting_count_global`, `ft_productive_count_global`, or `ft_neutral_count_global`
11. If OpenAI fails: neutral classification returned, user flow never blocked

**API endpoints used:** `POST /ai/classify`  
**Database tables:** `video_classifications`  
**Extension storage:** `ft_current_video_classification`, `ft_last_watch_classification`, `ft_distracting_count_global`, `ft_productive_count_global`, `ft_neutral_count_global`

### 4.2 Nudges & Blocking Logic

**What it does:** Evaluates counters after each video classification and triggers progressively severe interventions.

**Files:**
- `extension/lib/rules.js` — `evaluateThresholds()`, `evaluateBlock()`
- `extension/lib/constants.js` — all threshold values
- `extension/background/background.js` — calls both functions in `handleNavigated()`
- `extension/content/content.js` — `showBehaviorNudge()`, `showGlobalLimitOverlay()`, `showFocusWindowOverlay()`

**Distracting content thresholds** (count OR time triggers, whichever comes first):

| Threshold | Count | Time | Free Plan | Pro/Trial Plan |
|---|---|---|---|---|
| First nudge | 3 videos | 20 minutes | `nudge_10s` | `nudge_10s` |
| Second nudge | 4 videos | 40 minutes | `upgrade_prompt` | `nudge_30s` |
| Hard block | 5 videos | 60 minutes | `upgrade_prompt` | `hard_block` |

**Neutral video overflow:** First 2 neutral videos are free (`NEUTRAL_FREE_COUNT = 2`). Each neutral video beyond 2 is added to `effectiveDistractingCount`.

**Productive content thresholds:**

| Threshold | Count | Time | Action |
|---|---|---|---|
| First nudge | 3 videos | 30 minutes | `productive_nudge_5s` |
| Second nudge | 5 videos | 60 minutes | `productive_nudge_30s` |
| Break | 7 videos | 90 minutes | `productive_break` |

**Action codes returned by `evaluateThresholds()`:**
`none` | `nudge_10s` | `nudge_30s` | `hard_block` | `upgrade_prompt` | `productive_nudge_5s` | `productive_nudge_30s` | `productive_break`

**`evaluateBlock()` checks (in order):**
1. `PLAN_TEST` → never block
2. Temporary unlock active → allow
3. Channel blocked → block (`scope: "watch"`)
4. Daily time limit reached → block (`scope: "global"`)
5. `ft_blocked_today` flag set → block (except HOME page)
6. Shorts policy (Free plan strict_shorts, or Pro self-block) → block (`scope: "shorts"`)
7. Search threshold reached → block (`scope: "search"`)
8. Otherwise → allow

**Break lockout:** After a productive break triggers, a 10-minute lockout prevents immediate re-trigger (`ft_break_lockout_until` + `BREAK_LOCKOUT_DURATION_MS = 600000ms`).

**API endpoints used:** None (pure client-side logic)  
**Database tables:** `video_sessions` (watch events batched and sent after)  
**Extension storage:** All `ft_*_count_global` and `ft_*_time_global` counters

### 4.3 Channel Blocking

**What it does:** Users can permanently block specific channels. Blocked channels are stored in Supabase and synced across devices. Any video from a blocked channel is redirected immediately.

**Files:**
- `extension/lib/rules.js` — `evaluateBlock()` checks `blockedChannels` array
- `extension/background/background.js` — `handleNavigated()` passes `ft_blocked_channels` to `evaluateBlock()`; handles `FT_BLOCK_CHANNEL_PERMANENT` and `FT_BLOCK_CHANNEL_TODAY`
- `extension/content/content.js` — `showChannelBlockedOverlay()`, sends block messages
- `frontend/src/pages/Settings.tsx` — "Blocked Channels" tab, calls `POST /extension/save-data`
- `server/src/index.ts` — `POST /extension/save-data` handles blocked_channels writes

**Flow:**
1. On `WATCH` page: `extractChannelFast()` reads channel from meta tags or DOM
2. `evaluateBlock()` does case-insensitive exact match against `ft_blocked_channels` array
3. If matched: `showChannelBlockedOverlay()` rendered, video does not play
4. User can block from overlay or from Settings > Blocked Channels tab
5. `FT_BLOCK_CHANNEL_PERMANENT` → background appends to `ft_blocked_channels`, calls `saveExtensionDataToServer()`
6. `POST /extension/save-data` writes to `extension_data.blocked_channels` in Supabase
7. Server prevents shrinking the blocked list (anti-circumvention) unless admin override

**Temporary blocks** (`FT_BLOCK_CHANNEL_TODAY`): Stored in `ft_blocked_channels_today`, reset at midnight.

**API endpoints used:** `POST /extension/save-data`  
**Database tables:** `extension_data` (column: `blocked_channels`)  
**Extension storage:** `ft_blocked_channels`, `ft_blocked_channels_today`

### 4.4 Daily Time Limits

**What it does:** Tracks total YouTube watch time and blocks all YouTube (except HOME) when the daily limit is reached. Resets at local midnight.

**Files:**
- `extension/lib/rules.js` — `evaluateBlock()` checks `watchSecondsToday >= dailyLimitMin * 60`
- `extension/lib/state.js` — `ft_watch_seconds_today` counter, `maybeRotateCounters()` resets daily
- `extension/content/content.js` — `startGlobalTimeTracking()`, `stopGlobalTimeTracking()`, `showGlobalLimitOverlay()`
- `extension/background/background.js` — `saveTimerToServer()`, `mergeTimerFromServer()`
- `server/src/index.ts` — `POST /extension/save-timer`, `GET /extension/get-timer`

**Daily limit source (in priority order, `evaluateBlock()`):**
1. `ctx.effectiveSettings.daily_time_limit_minutes`
2. `ctx.ft_extension_settings.daily_time_limit_minutes`
3. Default: 60 (Free), 90 (Pro/Trial)

**Free plan default:** 60 minutes/day (hard-coded in `CONFIG_BY_PLAN`)  
**Pro/Trial plan default:** 90 minutes/day (configurable 0–120, per settings schema)  
**0 = disabled**

**Cross-device sync:** Timer saved to server every 15 minutes. On load, `mergeTimerFromServer()` takes the MAX of local and server values (so most restrictive wins).

**API endpoints used:** `POST /extension/save-timer`, `GET /extension/get-timer`  
**Database tables:** `extension_data` (timer columns added via migration)  
**Extension storage:** `ft_watch_seconds_today`, `ft_blocked_today`, `ft_last_time_milestone`

### 4.5 Focus Windows

**What it does:** Pro/Trial users can define a time window during which YouTube is allowed. Outside the window, YouTube is blocked and the user is redirected to the YouTube homepage with a message.

**Files:**
- `extension/lib/state.js` — `getEffectiveSettings()` returns focus window settings (Free plan ignores them)
- `extension/background/background.js` — `handleNavigated()` checks focus window before other blocking logic
- `extension/content/content.js` — `showFocusWindowOverlay()`
- `frontend/src/pages/Settings.tsx` — Controls tab, saves via `POST /extension/save-data`
- `server/src/index.ts` — settings stored in `extension_data.settings`

**Rules (from `.cursorrules`):**
- `focus_window_enabled: boolean` must be set
- Earliest start: 08:00, latest end: 22:00
- Max window: 6 hours
- Free plan: focus window visible in settings but locked (ignored by extension)
- Default in `state.js`: `ft_focus_window_start: "13:00"`, `ft_focus_window_end: "21:00"`, `ft_focus_window_enabled: true`

**Settings schema fields:** `focus_window_enabled`, `focus_window_start` (HH:MM), `focus_window_end` (HH:MM)

**API endpoints used:** `POST /extension/save-data` (via Settings page)  
**Database tables:** `extension_data` (column: `settings` JSONB)  
**Extension storage:** `ft_focus_window_enabled`, `ft_focus_window_start`, `ft_focus_window_end`

### 4.6 Dashboard & Analytics

**What it does:** Shows aggregated watch data for Trial/Pro users. Free users see a blurred placeholder with upgrade prompt.

**Files:**
- `frontend/src/pages/Dashboard.tsx` — Protected route, fetches `/dashboard/stats`
- `frontend/src/components/dashboard/FocusScore.tsx` — Circular progress (0–100)
- `frontend/src/components/dashboard/WatchTimeMap.tsx` — Stacked bar chart (hour buckets)
- `frontend/src/components/dashboard/SpiralFeed.tsx` — Spiral detection events list
- `frontend/src/components/dashboard/ChannelAudit.tsx` — Top channels with block action
- `frontend/src/components/dashboard/WeeklySummary.tsx` — Weekly stats
- `server/src/index.ts` — `GET /dashboard/stats` handler

**Dashboard metrics returned by `/dashboard/stats`:**
- `focusScore7Day` — Aggregated score 0–100
- `watchTime.todayMinutes`, `thisWeekMinutes`
- `watchTime.breakdownToday` / `breakdownWeek` — per classification type
- `topDistractionsThisWeek` — Most-watched distracting content
- `topChannels` — Most-watched channels overall
- `categoryBreakdown` — By category_primary
- `hourlyWatchTime` — Array of hourly buckets
- `spiralEvents` — Channel spiral detection events
- `streakDays` — Consecutive focus days (not yet implemented)
- `weeklyTrendMinutes` — 7-day array
- `windowDays: 60` — Max retention window
- `dataSource: "supabase"`

**Access control:** Dashboard checks plan on load; free users see blurred overlay.  
**Data retention:** Video sessions kept up to 60 days (pruned by `pruneVideoData()`).

**API endpoints used:** `GET /dashboard/stats?email=`  
**Database tables:** `video_sessions`, `video_classifications`, `extension_data`

### 4.7 Settings & Preferences

**What it does:** Lets users edit goals/pitfalls, manage blocked channels, and configure extension behaviour. Changes are saved to Supabase and synced to the extension.

**Files:**
- `frontend/src/pages/Settings.tsx` — Four tabs: Goals, Blocked Channels, Controls, Account
- `server/src/index.ts` — `POST /extension/save-data`, `GET /extension/get-data`
- `extension/background/background.js` — `FT_RELOAD_SETTINGS` message handler

**Settings schema (stored in `extension_data.settings` JSONB):**
```json
{
  "hide_recommendations": boolean,
  "shorts_mode": "hard" | "timed" | "off",
  "daily_time_limit_minutes": integer,
  "nudge_style": "gentle" | "assertive" | "firm",
  "focus_window_enabled": boolean,
  "focus_window_start": "HH:MM",
  "focus_window_end": "HH:MM"
}
```

**Note:** The settings schema in `state.js` includes `shorts_mode` and `nudge_style` which are not in the locked schema defined in `.cursorrules`. The `.cursorrules` schema uses `block_shorts: boolean` instead of `shorts_mode`.

**Plan gating (Free users):**
- `getEffectiveSettings()` in `state.js` enforces Free plan defaults regardless of stored settings
- Free plan: `daily_time_limit_minutes = 60`, `focus_window_enabled = false`, `hide_recommendations = false`
- Settings page shows Pro-only controls with lock overlay, not an error

**Sync flow:** Settings page saves → `POST /extension/save-data` → website sends `FT_RELOAD_SETTINGS` postMessage → `website-bridge.js` → background `FT_RELOAD_SETTINGS` → background calls `loadExtensionDataFromServer()` → content script notified via `FT_SETTINGS_RELOADED`

**API endpoints used:** `GET /extension/get-data`, `POST /extension/save-data`  
**Database tables:** `extension_data`

### 4.8 Rate Limiting

**Status: NOT IMPLEMENTED.**

The `.cursorrules` file specifies "rate limiting (IP-based + user-based), graceful 429 responses" and the backend README references it, but there is no rate limiting middleware in `server/src/index.ts`. No `express-rate-limit` or similar package is in `package.json`.

In-memory caches do exist for plan lookups (24h TTL, `Map`) and AI classifications (24h TTL, `Map`) which reduce API call frequency, but these are caches, not rate limits.

### 4.9 Shorts Handling

**What it does:** Detects YouTube Shorts pages and either blocks them immediately or tracks them separately based on plan and settings.

**Files:**
- `extension/lib/rules.js` — `evaluateBlock()` checks `pageType === "SHORTS"` + `config.strict_shorts` / `ctx.ft_block_shorts_today`
- `extension/content/content.js` — `handleShortsNavigation()`, `startShortsTimeTracking()`, `showShortsBlockedOverlay()`, `showProManualBlockOverlay()`, `showShortsBadge()`
- `extension/background/background.js` — handles `FT_BUMP_SHORTS`, `FT_INCREMENT_ENGAGED_SHORTS`
- `extension/lib/state.js` — `bumpShorts()`, `incrementEngagedShorts()`, `incrementShortsSeconds()`

**Behaviour matrix:**

| Condition | Action |
|---|---|
| Free plan (`strict_shorts: true`) | Immediate redirect to YouTube home + `showShortsBlockedOverlay()` |
| Pro/Trial + `ft_block_shorts_today = true` (self-block) | Immediate redirect + `showProManualBlockOverlay()` |
| Pro/Trial + `block_shorts = false` in settings | Allow, track in distracting counters |
| `PLAN_TEST` | Never block |

**Shorts tracking:**
- `ft_short_visits_today` — Total Shorts scrolls (bumped per page)
- `ft_shorts_engaged_today` — Engaged Shorts (>5 seconds watched)
- `ft_shorts_seconds_today` — Total Shorts watch time

**Pro badge:** `showShortsBadge()` displays a counter on Shorts pages for Pro users.

**Engagement detection:** Content script tracks time on Shorts page; `>5s` = engaged, sends `FT_INCREMENT_ENGAGED_SHORTS` to background.

**API endpoints used:** None (pure client-side logic)  
**Extension storage:** `ft_short_visits_today`, `ft_shorts_engaged_today`, `ft_shorts_seconds_today`, `ft_block_shorts_today`, `ft_pro_manual_block_shorts`

### 4.10 Recommendations Hiding

**What it does:** When `hide_recommendations = true`, hides YouTube's sidebar recommendations and homepage feed via DOM manipulation. Simple on/off, no counter logic.

**Files:**
- `extension/content/content.js` — `hideRecommendations()` function
- `extension/lib/state.js` — `getEffectiveSettings()` returns `hide_recommendations` value
- `frontend/src/pages/Settings.tsx` — Toggle in Controls tab
- `server/src/index.ts` — Saved in `extension_data.settings`

**Implementation:** DOM manipulation — CSS or `display: none` applied to specific YouTube selectors for sidebar (`#secondary`, `ytd-watch-next-secondary-results-renderer`) and homepage feed (`ytd-browse`). Applied on every navigation.

**Plan gating:** Free plan `getEffectiveSettings()` forces `hide_recommendations: false`.

**API endpoints used:** `POST /extension/save-data` (to save preference)  
**Extension storage:** `ft_extension_settings.hide_recommendations`

### 4.11 Channel Spiral Detection

**What it does:** Detects when a user is in a "spiral" — watching too many videos from the same channel within a 7-day window. Shows a nudge prompting self-reflection.

**Files:**
- `extension/lib/spiral.js` — `detectSpiral()` function
- `extension/background/background.js` — calls `detectSpiral()` after classification, handles `FT_CLEAR_SPIRAL_FLAG`
- `extension/content/content.js` — `showSpiralNudge()`, reads `ft_spiral_detected`

**Thresholds (from `constants.js`):**
- `SPIRAL_THRESHOLD_WEEK = 6` — 6 videos from same channel in 7 days
- `SPIRAL_THRESHOLD_WEEK_TIME = 5400` — 90 minutes from same channel in 7 days
- `SPIRAL_DISMISSAL_COOLDOWN_MS = 604800000` — 7-day cooldown after dismissal

**Detection logic:**
- Watch history kept for 60 days (`ft_watch_history`)
- Consecutive videos from same channel get weighted higher
- Triggers if either threshold exceeded and not in cooldown
- Sets `ft_spiral_detected: { channel, count, type, message, detected_at }`

**Extension storage:** `ft_spiral_detected`, `ft_spiral_events`, `ft_spiral_dismissed_channels`, `ft_channel_spiral_count`, `ft_watch_history`

### 4.12 Search Limits

**What it does:** Counts YouTube searches per day and shows warnings then hard-blocks after a threshold.

**Files:**
- `extension/lib/rules.js` — `evaluateBlock()` checks `searchesToday >= threshold`
- `extension/content/content.js` — `showSearchCounter()`, `updateSearchCounter()`, `checkAndShowSearchWarning()`
- `extension/lib/state.js` — `bumpSearches()`

**Thresholds (from `CONFIG_BY_PLAN`):**

| Plan | Warning | Hard block |
|---|---|---|
| Free | Search 3 and 4 | Search 5 → redirect to YouTube home |
| Pro/Trial | Search 13 and 14 | Search 15 → redirect to YouTube home |

**Warning:** Small banner near search bar, auto-dismisses after 5 seconds.

**Extension storage:** `ft_searches_today`

### 4.13 Journal / Reflection

**What it does:** After watching a distracting video for at least 1 minute, a journal prompt nudge appears. User can write a free-text reflection that gets saved to Supabase.

**Files:**
- `extension/content/content.js` — `showJournalNudge()`
- `extension/background/background.js` — handles `FT_SAVE_JOURNAL`
- `server/src/index.ts` — `POST /journal`
- `server/src/supabase.ts` — `insertJournalEntry()`

**API endpoints used:** `POST /journal`  
**Database tables:** `journal_entries`

---

## 5. API Endpoints

All endpoints on base URL: `https://focustube-backend-4xah.onrender.com`

No authentication middleware. Users identified by `email` parameter. Plan enforcement is server-side via `canUserRecord()` helper.

### `GET /health`
**Purpose:** Health check  
**Auth:** None  
**Response:**
```json
{ "ok": true, "timestamp": 1234567890, "service": "focustube-server" }
```

---

### `POST /ai/classify`
**Purpose:** Classify a YouTube video or search query as productive/neutral/distracting  
**Auth:** None (requires `user_id` field)  
**Request body:**
```json
{
  "user_id": "user@example.com",
  "context": "watch" | "search",
  "video_id": "dQw4w9WgXcQ",
  "video_title": "Video Title",
  "video_description": "...",
  "video_tags": ["tag1", "tag2"],
  "channel_name": "Channel Name",
  "video_category": "Education",
  "is_shorts": false,
  "duration_seconds": 300,
  "video_url": "https://...",
  "related_videos": [...],
  "user_goals": ["learn python"],
  "global_tag": "none",
  "text": "search query"
}
```
**Response:**
```json
{
  "distraction_level": "productive" | "neutral" | "distracting",
  "category_primary": "react tutorial",
  "confidence_distraction": 0.9,
  "goals_alignment": "aligned" | "partially_aligned" | "misaligned" | "unknown",
  "reasons": ["reason1"],
  "allowed": true,
  "category": "productive",
  "confidence": 0.9,
  "reason": "reason1",
  "block_reason_code": "ok" | "likely-rabbit-hole" | "clickbait",
  "action_hint": "allow" | "soft-warn" | "block"
}
```
**Caching:** 24h, keyed by `user_id + video_id + title_hash` or `user_id + text`  
**Fallback:** Returns neutral if OpenAI unavailable  
**Used by:** Extension (`background.js`)

---

### `POST /ai/normalize-channels`
**Purpose:** Normalise free-text channel names into display names (e.g. "mr beast" → "MrBeast")  
**Auth:** None  
**Request body:**
```json
{ "channel_names": ["vikkstar", "mr beast"] }
```
**Response:**
```json
{ "ok": true, "normalized_names": ["Vikkstar123", "MrBeast"] }
```
**Called:** Once on onboarding submit only  
**Used by:** `frontend/src/pages/Goals.tsx`

---

### `GET /license/verify`
**Purpose:** Verify user exists, return plan and trial status  
**Auth:** None  
**Query params:** `?email=user@example.com`  
**Response:**
```json
{
  "exists": true,
  "plan": "free" | "pro" | "trial",
  "can_record": true,
  "days_left": 15,
  "trial_expires_at": "2025-03-01T00:00:00Z"
}
```
**Caching:** 24h in-memory, keyed by email  
**Side effect:** Auto-downgrades expired trials to `"free"` in DB  
**Used by:** Extension (`popup.js`, `background.js`), Frontend (plan checks)

---

### `GET /extension/get-data`
**Purpose:** Fetch user's extension data (blocked channels, settings, goals, history)  
**Auth:** None  
**Query params:** `?email=user@example.com`  
**Response:**
```json
{
  "ok": true,
  "data": {
    "blocked_channels": ["Channel1"],
    "watch_history": [...],
    "channel_spiral_count": {},
    "settings": {},
    "goals": ["goal1"],
    "anti_goals": ["pitfall1"],
    "distracting_channels": [...]
  }
}
```
**Note:** Returns `anti_goals` field (should be `pitfalls` per naming conventions — known inconsistency)  
**Used by:** Extension (`background.js`), Settings page

---

### `POST /extension/save-data`
**Purpose:** Save extension data to Supabase  
**Auth:** None  
**Request body:**
```json
{
  "email": "user@example.com",
  "data": {
    "blocked_channels": [...],
    "watch_history": [...],
    "channel_spiral_count": {},
    "settings": {},
    "goals": [...],
    "anti_goals": [...]
  }
}
```
**Restrictions:** Blocks writes for free users with inactive plans. Prevents shrinking the `blocked_channels` list (anti-circumvention protection).  
**Used by:** Extension (`background.js`), Settings page, Goals page

---

### `GET /extension/get-timer`
**Purpose:** Get watch timer for cross-device sync  
**Auth:** None  
**Query params:** `?email=user@example.com`  
**Response:**
```json
{
  "ok": true,
  "watch_seconds_today": 1800,
  "timer_date": "2025-01-13",
  "timer_synced_at": "2025-01-13T12:00:00Z"
}
```
**Used by:** Extension (`background.js`) on boot and every 15 minutes

---

### `POST /extension/save-timer`
**Purpose:** Save watch timer for cross-device sync  
**Auth:** None  
**Request body:**
```json
{
  "email": "user@example.com",
  "watch_seconds_today": 1800,
  "date": "2025-01-13"
}
```
**Used by:** Extension (`background.js`) every 15 minutes

---

### `GET /dashboard/stats`
**Purpose:** Return aggregated analytics for the dashboard  
**Auth:** None  
**Query params:** `?email=user@example.com`  
**Response:** See Section 4.6 for full schema  
**Used by:** `frontend/src/pages/Dashboard.tsx`

---

### `POST /events/watch`
**Purpose:** Batch insert watch session events  
**Auth:** None  
**Request body:**
```json
{
  "user_id": "user@example.com",
  "events": [{
    "video_id": "...",
    "video_title": "...",
    "channel_name": "...",
    "watch_seconds": 300,
    "started_at": "...",
    "watched_at": "...",
    "distraction_level": "...",
    "category_primary": "...",
    "confidence_distraction": 0.9
  }]
}
```
**Filters:** Events with `watch_seconds < 30` are discarded  
**Side effect:** Prunes data older than 60 days after insert  
**Used by:** Extension (`background.js` watch event queue, flushed at 3 events or 60 seconds)

---

### `POST /journal`
**Purpose:** Save a journal/reflection entry  
**Auth:** None  
**Request body:**
```json
{
  "user_id": "user@example.com",
  "note": "Journal text",
  "distraction_level": "distracting",
  "context": {
    "url": "...",
    "title": "...",
    "channel": "...",
    "source": "...",
    "videos": [...]
  }
}
```
**Used by:** Extension (`background.js` on `FT_SAVE_JOURNAL`)

---

### `POST /stripe/create-checkout`
**Purpose:** Create a Stripe Checkout session  
**Auth:** None  
**Request body:**
```json
{ "email": "user@example.com", "planType": "monthly" | "annual" | "lifetime" }
```
**Response:**
```json
{ "ok": true, "checkoutUrl": "https://checkout.stripe.com/..." }
```
**Note:** `annual` and `lifetime` price IDs exist in server code but should be removed per `.cursorrules` (MVP monthly only)

---

### `POST /webhook/stripe`
**Purpose:** Handle Stripe webhook events  
**Auth:** Raw body required; Stripe signature verification **not implemented**  
**Events handled:**
- `checkout.session.completed` → Set plan to `"pro"`
- `customer.subscription.deleted` → Set plan to `"free"`
- `customer.subscription.updated` → Handle cancelled/unpaid/past_due → `"free"`

---

### `POST /video/update-watch-time`
**Purpose:** Update watch time for a specific video  
**Auth:** None  
**Request body:**
```json
{ "user_id": "user@example.com", "video_id": "...", "watch_seconds": 300 }
```

---

### `POST /user/update-plan`
**Purpose:** Dev/testing endpoint — update user plan directly  
**Auth:** None (should be admin-only)  
**Request body:**
```json
{ "email": "user@example.com", "plan": "free" | "pro" | "trial", "days_left": 15 }
```

---

### `GET /checkout-success`
**Purpose:** Success page after Stripe checkout  
**Response:** HTML page

### `GET /checkout-cancel`
**Purpose:** Cancel page after Stripe checkout  
**Response:** HTML page

---

## 6. Database Schema

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PRIMARY KEY | Auto-increment |
| `email` | TEXT UNIQUE | User's email — primary identifier throughout the system |
| `plan` | TEXT | `"free"` \| `"trial"` \| `"pro"` (DB stores `"trial"`, extension also stores `"trial"`) |
| `trial_started_at` | TIMESTAMPTZ | Set on first signup |
| `trial_expires_at` | TIMESTAMPTZ | Set to 30 days after `trial_started_at` |
| `goals` | TEXT | JSON array string (stored as text, not JSONB) |
| `anti_goals` | TEXT | JSON array string — **field should be `pitfalls` per naming conventions** |
| `distracting_channels` | TEXT | JSON array string |
| `stripe_customer_id` | TEXT | Set by Stripe webhook on checkout |
| `created_at` | TIMESTAMPTZ | Auto-set |
| `updated_at` | TIMESTAMPTZ | Auto-updated |

**Relationships:** Referenced by `extension_data.user_id`, `video_sessions.user_id`, `video_classifications.user_id`, `journal_entries.user_id` (all via email, not UUID)

**Note:** Auth is managed in Supabase's auth schema separately. The `users` table stores billing/plan state. The `id` field in `users` is NOT the Supabase auth UUID.

---

### `extension_data`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PRIMARY KEY | Auto-increment |
| `user_id` | TEXT | User's email (UNIQUE constraint) |
| `blocked_channels` | JSONB | Array of channel name strings |
| `watch_history` | JSONB | Array of watch event objects (short-term cache, last 7 days) |
| `channel_spiral_count` | JSONB | `{ channel_name: { today, this_week, time_this_week, last_watched } }` |
| `settings` | JSONB | Settings object (see schema in Section 4.7) |
| `goals` | TEXT[] / JSONB | User goals (also stored in `users` table — duplication) |
| `pitfalls` | TEXT[] / JSONB | User pitfalls (migration uses `anti_goals`) |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Constraint:** `UNIQUE(user_id)`

---

### `video_sessions`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PRIMARY KEY | |
| `user_id` | TEXT | User's email |
| `video_id` | TEXT | YouTube video ID |
| `video_title` | TEXT | Video title at time of watching |
| `channel_name` | TEXT | Primary channel name |
| `distraction_level` | TEXT | `"productive"` \| `"neutral"` \| `"distracting"` |
| `category_primary` | TEXT | AI-assigned category |
| `confidence_distraction` | NUMERIC | AI confidence score (0.00–1.00) |
| `watch_seconds` | INTEGER | Seconds actually watched (min 30 to be stored) |
| `watched_at` | TIMESTAMPTZ | When the session occurred |
| `date` | DATE | Date portion (for daily aggregations) |
| `title` | TEXT | Duplicate of video_title (legacy column) |
| `channel` | TEXT | Duplicate of channel_name (legacy column) |
| `category` | TEXT | Duplicate of category_primary (legacy column) |
| `duration` | INTEGER | Video duration in seconds |
| `alignment` | TEXT | Goals alignment result |
| `created_at` | TIMESTAMPTZ | |

**Retention:** Pruned after 60 days via `pruneVideoData()` called after each batch insert

---

### `video_classifications`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PRIMARY KEY | |
| `user_id` | TEXT | User's email |
| `video_id` | TEXT | YouTube video ID |
| `video_title` | TEXT | Title at time of classification |
| `channel_name` | TEXT | |
| `video_category` | TEXT | YouTube-reported category |
| `distraction_level` | TEXT | AI result: `"productive"` \| `"neutral"` \| `"distracting"` |
| `category_primary` | TEXT | AI-assigned category string |
| `confidence_distraction` | NUMERIC(3,2) | |
| `watch_seconds` | INTEGER | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Used to check 24h cache freshness |

**Constraint:** `UNIQUE(user_id, video_id)`  
**Cache TTL:** 24 hours based on `updated_at`

---

### `journal_entries`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PRIMARY KEY | |
| `user_id` | TEXT | User's email |
| `note` | TEXT | Free-text reflection written by user |
| `distraction_level` | TEXT | Classification at time of journal prompt |
| `context_url` | TEXT | URL of the video |
| `context_title` | TEXT | Video title |
| `context_channel` | TEXT | Channel name |
| `context_source` | TEXT | Source of the prompt trigger |
| `context_videos` | JSONB | Array of related videos at time of prompt |
| `created_at` | TIMESTAMPTZ | |

---

## 7. Extension Architecture

### Background Service Worker (`background/background.js`, ~1735 lines)

The background script is the central controller. It runs as a Manifest V3 service worker.

**Responsibilities:**
- Boot sequence on install/startup (`boot()`)
- Receiving `FT_NAVIGATED` messages from content script and executing the full navigation handler (`handleNavigated()`)
- Plan sync from server (`syncPlanFromServer()`, debounced 5 minutes)
- Extension data sync (`loadExtensionDataFromServer()`, every 1 hour)
- Timer sync (`saveTimerToServer()`, `mergeTimerFromServer()`, every 15 minutes)
- AI classification (`classifyVideo()`, deferred 45 seconds after navigation)
- Watch event batching and flushing (`sendWatchEventBatch()`, at 3 events or 60 seconds)
- Counter management (delegates to `state.js`)
- All `chrome.runtime.onMessage` handling

**`handleNavigated()` flow (critical path):**
1. `ensureDefaults()` — ensure storage keys exist
2. `maybeRotateCounters()` — reset if it's a new day
3. Debounced plan sync (skip if same video, force if new video)
4. Count page type (bump `ft_searches_today` on SEARCH, `ft_watch_visits_today` on WATCH)
5. Finalize previous video watch time (`finalizeVideoWatch()`)
6. Check focus window → if outside: return `{ action: "focus_window_block" }`
7. Check permanent channel block → if blocked: return `{ action: "channel_blocked" }`
8. Check spiral detection flag
9. Track current video start
10. Schedule AI classification (45-second deferred)
11. `evaluateBlock(ctx)` → check daily limit, search threshold, Shorts policy
12. `evaluateThresholds(counters, plan)` → check behavior loop thresholds
13. Return action to content script

**Background intervals (registered once on install):**
- Plan sync: every 5 minutes
- Extension data load: every 1 hour
- Timer sync: every 15 minutes

---

### Content Script (`content/content.js`, ~6300 lines)

Runs on all YouTube pages at `document_idle`. Handles all DOM interaction.

**Responsibilities:**
- Page type detection (`detectPageType()` → HOME/SEARCH/WATCH/SHORTS/OTHER)
- Video metadata extraction (`extractVideoMetadata()`, `extractChannelFast()`)
- Navigation detection (listens to `yt-navigate-finish`, `yt-navigate-start`, URL polling)
- Overlay rendering: all nudge types, block overlays, onboarding
- Counter badge rendering: search counter, Shorts counter, global time counter
- Watch time tracking: per-video and global (`startVideoWatchTracking()`, `startGlobalTimeTracking()`)
- Shorts time tracking (`startShortsTimeTracking()`)
- Behavior loop counter updates (every 60 seconds during watch)
- Recommendations hiding (DOM manipulation)
- Journal nudge display

**Key overlays rendered by content.js:**
- `showGlobalLimitOverlay()` — daily limit reached
- `showFocusWindowOverlay()` — outside focus window
- `showChannelBlockedOverlay()` — blocked channel
- `showShortsBlockedOverlay()` — Free plan Shorts block
- `showProManualBlockOverlay()` — Pro self-block Shorts
- `showBehaviorNudge()` — distracting/productive threshold nudge
- `showSpiralNudge()` — channel spiral detected
- `showJournalNudge()` — reflection prompt
- `showOnboardingOverlay()` — first-time onboarding prompt
- `showMilestonePopup()` — watch time milestone (2/5/10/15/20 minutes)

---

### Website Bridge (`content/website-bridge.js`)

Runs on the FocusTube website at `document_start`. Acts as a relay between website `postMessage` calls and `chrome.runtime.sendMessage` to the background.

**Messages it relays:**
- `FT_STORE_EMAIL_FROM_WEBSITE` → background stores email, triggers plan sync
- `FT_REMOVE_EMAIL_FROM_WEBSITE` → background clears all auth state
- `FT_RELOAD_SETTINGS` → background calls `loadExtensionDataFromServer()`

Returns `FT_RESPONSE` postMessage back to website with `requestId` for promise resolution.

---

### Popup (`popup.html` + `popup.js`)

Shows one of three states:
1. **Onboarding** — Extension not yet set up; shows sign-in button
2. **Login form** — Enter email to authenticate
3. **Status view** — Logged-in; shows plan, trial days remaining, upgrade CTA

**Functions:**
- `loadCurrentEmail()` — Load email from storage, call `verifyEmail()`
- `verifyEmail()` — `GET /license/verify?email=` → check plan, update storage
- `verifyBootstrapSession()` — `GET /extension/bootstrap?email=` (if available)
- `handleManageAccount()` — Opens website settings page
- `handleSignup()` / `handleSignIn()` — Opens website with `?return=extension`
- `renderTrialBanner()` — Shows days-left banner if on trial

**Storage listener:** Watches `ft_user_email`, `ft_plan`, `ft_days_left` changes and re-renders UI.

---

### Storage Keys (all in `chrome.storage.local`)

**Auth & plan:**

| Key | Type | Description |
|---|---|---|
| `ft_user_email` | string | Authenticated user's email |
| `ft_data_owner_email` | string | Normalised email for cache ownership |
| `ft_plan` | string | `"free"` \| `"trial"` \| `"pro"` \| `"test"` |
| `ft_trial_expires_at` | string | ISO timestamp |
| `ft_days_left` | number | Days remaining in trial |
| `ft_can_record` | boolean | Whether plan allows analytics recording |
| `ft_onboarding_completed` | boolean | Whether onboarding was completed |

**Daily counters (reset at local midnight):**

| Key | Type | Description |
|---|---|---|
| `ft_searches_today` | number | YouTube searches today |
| `ft_short_visits_today` | number | Shorts page visits today |
| `ft_shorts_engaged_today` | number | Shorts watched >5s today |
| `ft_shorts_seconds_today` | number | Seconds on Shorts today |
| `ft_watch_visits_today` | number | Regular videos watched today |
| `ft_watch_seconds_today` | number | Total YouTube watch time today (seconds) |
| `ft_blocked_today` | boolean | Global block flag for today |
| `ft_block_shorts_today` | boolean | Shorts blocked for today (Pro self-block) |
| `ft_pro_manual_block_shorts` | boolean | Pro user manually blocked Shorts |

**Behavior loop counters (reset daily):**

| Key | Type | Description |
|---|---|---|
| `ft_distracting_count_global` | number | Distracting videos today |
| `ft_distracting_time_global` | number | Distracting watch time today (seconds) |
| `ft_productive_count_global` | number | Productive videos today |
| `ft_productive_time_global` | number | Productive watch time today (seconds) |
| `ft_neutral_count_global` | number | Neutral videos today |
| `ft_neutral_time_global` | number | Neutral watch time today (seconds) |
| `ft_break_lockout_until` | number | Timestamp when break lockout expires |

**Synced with Supabase:**

| Key | Type | Description |
|---|---|---|
| `ft_blocked_channels` | array | Permanent blocked channel names |
| `ft_blocked_channels_today` | array | Temporary blocks (reset midnight) |
| `ft_watch_history` | array | Watch events (60-day rolling window) |
| `ft_channel_spiral_count` | object | Per-channel spiral tracking counts |
| `ft_channel_lifetime_stats` | object | Lifetime stats per channel |
| `ft_extension_settings` | object | Settings JSON (see schema) |
| `ft_spiral_events` | array | Spiral detection events (last 30 days) |
| `ft_spiral_dismissed_channels` | object | Cooldown tracking per channel |
| `ft_user_goals` | array | User's focus goals |
| `ft_user_pitfalls` | array | User's pitfalls |
| `ft_user_distraction_channels` | array | User's self-identified distracting channels |

**Video tracking:**

| Key | Type | Description |
|---|---|---|
| `ft_current_video_classification` | object | `{ videoId, category, startTime, title }` |
| `ft_last_watch_classification` | object | Last classification result |
| `ft_last_search_classification` | object | Last search classification result |
| `ft_watch_event_queue` | array | Batched events pending server flush |

**Other:**

| Key | Type | Description |
|---|---|---|
| `ft_unlock_until_epoch` | number | Temporary unlock expiry timestamp |
| `ft_last_reset_key` | string | Last reset date `YYYY-MM-DD` |
| `ft_spiral_detected` | object \| null | Current active spiral detection |
| `ft_last_synced_video_id` | string | For debouncing duplicate classifies |
| `ft_last_time_milestone` | number | Last milestone shown (seconds) |
| `ft_redirected_from_shorts` | boolean | Flag for Shorts redirect overlay |
| `ft_focus_window_enabled` | boolean | Focus window active |
| `ft_focus_window_start` | string | `"HH:MM"` |
| `ft_focus_window_end` | string | `"HH:MM"` |

---

### Message Passing

**Content → Background (`chrome.runtime.sendMessage`):**

| Message | Description |
|---|---|
| `FT_NAVIGATED` | Navigation event with `pageType`, `url`, `videoMetadata` |
| `FT_BUMP_SHORTS` | Increment Shorts visit counter |
| `FT_INCREMENT_ENGAGED_SHORTS` | Increment engaged Shorts counter |
| `FT_RESET_COUNTERS` | Reset all daily counters |
| `FT_BLOCK_CHANNEL_TODAY` | Temporary channel block |
| `FT_BLOCK_CHANNEL_PERMANENT` | Permanent channel block |
| `FT_CLEAR_SPIRAL_FLAG` | Clear spiral detection flag |
| `FT_SAVE_JOURNAL` | Save journal entry |
| `FT_SET_EMAIL` | Set user email |
| `FT_SYNC_PLAN` | Trigger plan sync |
| `FT_RELOAD_EXTENSION_DATA` | Reload all data from server |
| `FT_RELOAD_SETTINGS` | Reload settings from server |
| `FT_GET_STATUS` | Get trial status |

**Background → Content (`chrome.tabs.sendMessage`):**

| Message | Description |
|---|---|
| `FT_FORCE_NAV` | Force navigation re-check |
| `FT_RECHECK_BLOCKING` | Re-check blocking status |
| `FT_SETTINGS_RELOADED` | Notify content settings updated |
| `FT_PLAN_CHANGED` | Notify content plan changed |

**Website → Extension (via postMessage → website-bridge.js → chrome.runtime.sendMessage):**

| Message | Description |
|---|---|
| `FT_STORE_EMAIL_FROM_WEBSITE` | Store email after website login |
| `FT_REMOVE_EMAIL_FROM_WEBSITE` | Clear auth state on website logout |
| `FT_RELOAD_SETTINGS` | Reload settings after website settings save |

---

## 8. Missing / Broken Features

### Critical: Field Naming Inconsistencies

1. **`anti_goals` vs `pitfalls`** — The `.cursorrules` specification locks the field name as `pitfalls` everywhere. The actual code uses:
   - `anti_goals` in `users` table (migration `004_add_goals_columns.sql`)
   - `anti_goals` returned by `GET /extension/get-data` response
   - `anti_goals` in `POST /extension/save-data` body
   - `ft_user_anti_goals` may still exist in some code paths
   This is a Phase 4/5 fix per `.cursorrules` Section 17.

2. **`block_shorts` vs `shorts_mode`** — `.cursorrules` Section 8 specifies `block_shorts: boolean` in the settings schema. `state.js` uses `shorts_mode: "hard" | "timed" | "off"`. These are inconsistent.

3. **`pro_trial` vs `trial`** — `.cursorrules` specifies DB stores `pro_trial`, extension uses `"trial"`. The actual code stores `"trial"` everywhere including the DB (`users.plan`). The server's `/license/verify` normalises the value to `"trial"` when returning to the extension. The DB value should be `"pro_trial"` per spec but is currently `"trial"`.

### Rate Limiting: Not Implemented

`.cursorrules` specifies rate limiting (IP-based + user-based) on all endpoints. `server/src/index.ts` has no rate limiting middleware. No `express-rate-limit` in `package.json`. This is a security and abuse risk.

### Stripe Webhook Signature Verification: Not Implemented

`POST /webhook/stripe` uses `bodyParser.text()` to get the raw body but does not call `stripe.webhooks.constructEvent()` to verify the `Stripe-Signature` header. Any request to this endpoint claiming to be a Stripe event would be processed without validation.

### No Backend Authentication Middleware

All endpoints are publicly accessible with only the `email` parameter for identification. There is no JWT verification, no API key, no session token check. Any caller who knows a user's email can read and modify their data.

### `/user/update-plan` Should Be Admin-Only

`POST /user/update-plan` changes any user's plan with no authentication. This is a testing endpoint that is exposed in production.

### Plan Value: `pro_trial` Not Used in DB

`.cursorrules` Section 4 states the DB should store `pro_trial` for trial users. The actual `users` table stores `"trial"`. Migration `000_create_users.sql` and the signup code both use `"trial"`. This is a pending Phase 5 change.

### Dead Code Still Present

Per `.cursorrules` Section 16, these items should be deleted but may still exist:
- `ft_allowance_videos_left` / `ft_allowance_seconds_left` in `state.js` DEFAULTS/resetShape
- `ft_reset_period` weekly/monthly logic in `state.js`
- `ft_user_anti_goals` in `state.js` DEFAULTS
- Allowance decrement on distracting video in `background.js` (~line 1234)
- `STRIPE_PRICE_ANNUAL` / `STRIPE_PRICE_LIFETIME` references in `index.ts`

**Status:** `state.js` DEFAULTS already uses `ft_user_pitfalls` (renamed). `resetShape()` only has daily reset logic. However, the `constants.js` still exports `PERIOD_WEEKLY` and `PERIOD_MONTHLY` constants which are dead.

### Dashboard: Streak Days Not Implemented

`GET /dashboard/stats` returns `"streakDays": 0` — always hardcoded to 0. The streak calculation is not implemented.

### Settings Schema Mismatch

The settings object stored in Supabase (per `state.js` comment) includes:
- `nudge_style: "gentle" | "assertive" | "firm"`
- `shorts_mode: "hard" | "timed" | "off"`

But `.cursorrules` Section 8 specifies:
- `block_shorts: boolean`
- No `nudge_style` field

The Settings page (`Settings.tsx`) renders a nudge style selector and `block_shorts` boolean toggle — it's unclear which schema the extension actually reads.

### Focus Window Default Is Active

`state.js` DEFAULTS set `ft_focus_window_enabled: true` with a default window of 13:00–21:00. New users who haven't set up settings may find YouTube blocked outside these hours before they've configured anything.

### `POST /extension/bootstrap` Not Implemented

`.cursorrules` Section 6 specifies `GET /extension/bootstrap` as the primary endpoint returning plan, trial_days_remaining, goals, pitfalls, blocked_channels, settings. The actual implementation uses separate endpoints: `/license/verify` + `/extension/get-data`. `popup.js` calls `/extension/bootstrap` (`verifyBootstrapSession()`), which either doesn't exist or is a partial implementation.

### Goals Data Duplication

Goals are stored in both `users.goals` (as TEXT) and `extension_data` (as array). The onboarding flow (`Goals.tsx`) writes to `users` via Supabase direct, but the extension reads from `/extension/get-data` which reads from `extension_data`. These can diverge.

### Forgot Password Page Missing

`Login.tsx` links to `/forgot-password` but there is no route or page for it in `App.tsx`.

### `DEBUG_MODE = true` in Production

`extension/lib/constants.js` has `export const DEBUG_MODE = true` — this should be `false` in production builds as it enables extra console logging.

### CORS: Production Domain Not Listed

`manifest.json` `externally_connectable` lists `focustube-beta.vercel.app` but not `focustube.co.uk`. If the production domain is different, extension ↔ website bridge communication will fail.

---

## 9. Deployment Configuration

### Environment Variables

**Frontend (Vite — prefix `VITE_`, available in browser):**

| Variable | Purpose |
|---|---|
| `VITE_BACKEND_URL` | Backend API base URL |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key (used client-side for auth) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (client-side) |
| `VITE_EXTENSION_ID` | Chrome extension ID (for `externally_connectable`) |

**Backend (Node.js — server-side only, never exposed to client):**

| Variable | Purpose |
|---|---|
| `PORT` | Express server port (default: 3000) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (full DB access) |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_CLASSIFIER_MODEL` | OpenAI model name (default: `"gpt-4o-mini"`) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_PRICE_MONTHLY` | Stripe Price ID for monthly subscription |
| `STRIPE_PRICE_ANNUAL` | Stripe Price ID for annual (unused in MVP) |
| `STRIPE_PRICE_LIFETIME` | Stripe Price ID for lifetime (unused in MVP) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (referenced but not used) |
| `APP_BASE_URL` | Base URL of the app (for Stripe redirect URLs) |
| `ADMIN_SECRET` | Admin secret for force-clearing blocked channels |
| `NODE_ENV` | `"development"` \| `"production"` |

### OAuth Redirect URIs

Supabase Auth must have these redirect URIs configured in the Supabase dashboard:

- `https://focustube-beta.vercel.app/login`
- `https://focustube-beta.vercel.app/login?return=extension`
- `http://localhost:8080/login`
- `http://localhost:8080/login?return=extension`
- Production domain equivalents (`focustube.co.uk` if applicable)

### Webhook Endpoints

Stripe webhook must point to: `POST https://focustube-backend-4xah.onrender.com/webhook/stripe`

Stripe webhook events to subscribe to:
- `checkout.session.completed`
- `customer.subscription.deleted`
- `customer.subscription.updated`

### Build Commands

**Frontend:**
```bash
npm run build    # Vite build to dist/
npm run dev      # Vite dev server on port 8080
```

**Backend:**
```bash
npm run build    # tsc → dist/
npm run start    # node dist/index.js
npm run dev      # ts-node-dev (hot reload)
```

**Extension:**
- No build step (plain JavaScript/ES modules)
- Load unpacked in Chrome: `chrome://extensions → Load unpacked → select /extension folder`

### Deploy Targets

| Component | Platform | Config file |
|---|---|---|
| Frontend | Vercel | `frontend/vercel.json` (SPA rewrite: all routes → `/index.html`) |
| Backend | Render | No config file found; configured via Render dashboard |
| Database | Supabase | Managed; migrations in `server/supabase-migrations/` |
| Extension | Chrome Web Store | Manual submission (no CI/CD configured) |

### Database Migrations

Run in Supabase SQL editor in order:
```
server/supabase-migrations/000_create_users.sql
server/supabase-migrations/001_create_journal_entries.sql
server/supabase-migrations/002_create_video_classifications.sql
server/supabase-migrations/003_create_video_sessions.sql
server/supabase-migrations/004_add_goals_columns.sql
server/supabase-migrations/005_fix_rls_policies.sql
server/supabase-migrations/006_create_extension_data.sql
server/supabase-migrations/007_add_rls_policies.sql
server/supabase-migrations/008_add_journal_columns.sql
server/supabase-rls-setup.sql
```

### CORS Configuration (Backend)

`server/src/index.ts` allows these origins:
- `chrome-extension://*`
- `http://localhost:*` (various ports: 8078–8083, 3000)
- `https://*.youtube.com`
- `https://focustube-beta.vercel.app`

Production deployment requires adding `https://focustube.co.uk` (and any other production frontend domain) to the CORS allowed list.
