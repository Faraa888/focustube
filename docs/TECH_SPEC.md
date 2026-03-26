# TECH_SPEC.md
# FocusTube — Technical Specification (Rebuild Reference)

---

## 1. TECH STACK

### Frontend
| Property | Value |
|----------|-------|
| Framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| Router | React Router DOM 6 |
| Server state | TanStack React Query 5 |
| UI | Tailwind CSS 3 + shadcn/ui (Radix UI) |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Auth client | Supabase JS 2 |
| Notifications | Sonner |
| Deployment | Vercel |
| Dev port | 8080 |

### Backend
| Property | Value |
|----------|-------|
| Runtime | Node.js |
| Framework | Express 4 |
| Language | TypeScript |
| DB client | @supabase/supabase-js 2 |
| AI — pass 1 | openai SDK (gpt-4o-mini) |
| AI — pass 2 | @anthropic-ai/sdk (claude-sonnet-3-5) |
| Payments | stripe 14 |
| Rate limiting | express-rate-limit |
| Deployment | Render |

### Extension
| Property | Value |
|----------|-------|
| Manifest version | 3 |
| Type | Chrome extension (desktop only) |
| Background | Service worker (ES module) |
| Permissions | `storage`, `tabs` |
| Content scripts | YouTube pages + frontend bridge |
| No build step | Plain JavaScript/ES modules |

### Database
- Supabase (PostgreSQL) with Row-Level Security
- Service role key used server-side only
- Anon key used client-side for auth only

---

## 2. ENVIRONMENT VARIABLES

### Frontend (Vite — `VITE_` prefix, public)
| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (auth only) |
| `VITE_BACKEND_URL` | Backend API base URL — used everywhere, never hardcoded |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `VITE_EXTENSION_ID` | Chrome extension ID |

### Backend (server-side only, never exposed to client)
| Variable | Purpose |
|----------|---------|
| `PORT` | Express port (default: 3000) |
| `NODE_ENV` | `"development"` or `"production"` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Full DB access (never client-side) |
| `OPENAI_API_KEY` | OpenAI key for pass-1 classification |
| `ANTHROPIC_API_KEY` | Anthropic key for pass-2 classification |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_MONTHLY` | Stripe Price ID for $5/month |
| `BACKEND_URL` | Used for Stripe redirect URL construction |
| `FRONTEND_URL` | Used for CORS and Stripe redirect URLs |
| `ADMIN_SECRET` | Admin route protection |
| `DISPOSABLE_EMAIL_DOMAINS` | Comma-separated list of blocked email domains |

### Extension (build-time injected via `lib/config.js`)
| Variable | Value source |
|----------|-------------|
| `BACKEND_URL` | Injected at build time from env; single source of truth |
| `FRONTEND_URL` | Injected at build time |

**Critical rule:** `BACKEND_URL` must never be hardcoded in any file across frontend, backend, or extension. Every reference reads from the env var.

---

## 3. DATABASE SCHEMA

### Table: `users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key, references `auth.users.id` |
| `email` | text | Unique, not null |
| `plan` | text | `"trial"` \| `"pro"` \| `"free"` |
| `trial_started_at` | timestamptz | Set on signup |
| `trial_expires_at` | timestamptz | Set on signup (now + 14 days) |
| `created_at` | timestamptz | Default: now() |
| `updated_at` | timestamptz | Updated on any change |

### Table: `extension_data`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `user_id` | uuid | References `users.id` |
| `goals` | text[] | Array of goal strings |
| `pitfalls` | text[] | Array of pitfall strings (field name is always `pitfalls`) |
| `blocked_channels` | text[] | Array of normalized channel names |
| `settings` | jsonb | See settings schema below |
| `updated_at` | timestamptz | Updated on any change |

**Settings jsonb schema:**
```json
{
  "block_shorts": false,
  "hide_recommendations": false,
  "daily_limit_minutes": 0,
  "focus_window_enabled": false,
  "focus_window_start": "08:00",
  "focus_window_end": "22:00"
}
```

Note: `focus_window_enabled` defaults to `false`. New users must not have YouTube blocked before configuring their window.

### Table: `video_sessions`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `user_id` | uuid | References `users.id` |
| `video_id` | text | YouTube video ID |
| `video_title` | text | |
| `channel_name` | text | Main channel only |
| `classification` | text | `"productive"` \| `"neutral"` \| `"distracting"` |
| `watch_seconds` | integer | Total seconds watched |
| `watched_at` | timestamptz | Session start timestamp |
| `created_at` | timestamptz | |

Raw data retained for 60 days. Purge job runs server-side.

### Table: `video_classifications`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `user_id` | uuid | References `users.id` |
| `video_id` | text | YouTube video ID |
| `classification` | text | `"productive"` \| `"neutral"` \| `"distracting"` |
| `confidence` | float | 0.0–1.0 |
| `model_used` | text | `"gpt-4o-mini"` or `"claude-sonnet-3-5"` |
| `classified_at` | timestamptz | |
| `expires_at` | timestamptz | `classified_at + 24 hours` — cache TTL |

### Table: `journal_entries`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `user_id` | uuid | References `users.id` |
| `video_title` | text | |
| `channel_name` | text | |
| `note` | text | Raw user note |
| `created_at` | timestamptz | |

Not processed automatically. AI summary generated only when user clicks "View journal insights".

### RLS Policies
- All tables: users can only read/write their own rows (`user_id = auth.uid()`)
- Backend uses service role key (bypasses RLS)
- Frontend uses anon key (subject to RLS)

---

## 4. API ENDPOINTS

All endpoints:
- Require `email` in request body or query param for user identification
- Validate `email` format server-side
- Return `401` if user not found
- Return `429` with message if rate limited
- Never expose stack traces — generic error messages to client only
- Use HTTPS only

### Authentication & Bootstrap

#### `GET /extension/bootstrap`
Returns everything the extension needs on startup. Called once on install and once per login.

**Request:** `?email=user@example.com`

**Response:**
```json
{
  "plan": "trial",
  "trial_expires_at": "2026-03-18T12:00:00Z",
  "trial_days_remaining": 28,
  "can_record": true,
  "goals": ["Learn to code", "Build my SaaS"],
  "pitfalls": ["gaming videos", "vlogs"],
  "blocked_channels": ["PewDiePie", "MrBeast"],
  "settings": {
    "block_shorts": false,
    "hide_recommendations": false,
    "daily_limit_minutes": 60,
    "focus_window_enabled": true,
    "focus_window_start": "09:00",
    "focus_window_end": "12:00"
  }
}
```

**Rate limit:** 20 requests/user/hour

#### `GET /license/verify`
Lightweight plan check. Used by popup on open.

**Request:** `?email=user@example.com`

**Response:**
```json
{
  "plan": "trial",
  "trial_days_remaining": 28,
  "can_record": true
}
```

**Rate limit:** 60 requests/user/hour

### Classification

#### `POST /ai/classify`
Classifies a video. Two-pass logic runs server-side.

**Request body:**
```json
{
  "email": "user@example.com",
  "video_id": "dQw4w9WgXcQ",
  "title": "Video title",
  "channel": "Channel name",
  "description": "Video description",
  "category": "Education",
  "tags": ["tag1", "tag2"]
}
```

**Logic:**
1. Check cache — return cached result if `expires_at` > now
2. Pass 1: `gpt-4o-mini` with user goals/pitfalls in prompt
3. If confidence < 0.65: Pass 2: `claude-sonnet-3-5`, accept result regardless of confidence
4. If any API error: return `"neutral"`
5. Cache result in `video_classifications`

**Response:**
```json
{
  "classification": "distracting",
  "confidence": 0.87,
  "cached": false,
  "model": "gpt-4o-mini"
}
```

**Rate limit:** 50 requests/user/day

#### `POST /ai/normalize-channels`
Normalizes free-text channel names via OpenAI. Called once on onboarding submit and on settings save.

**Request body:**
```json
{
  "email": "user@example.com",
  "channel_names": ["pewdepie", "Mr Beast", "markiplier"]
}
```

**Response:**
```json
{
  "normalized": ["PewDiePie", "MrBeast", "Markiplier"]
}
```

**Rate limit:** 10 requests/user/hour

### Extension Data Sync

#### `GET /extension/get-data`
Returns current goals, pitfalls, blocked channels, and settings for a user.

**Request:** `?email=user@example.com`

**Rate limit:** 20 requests/user/hour

#### `POST /extension/save-data`
Saves updated extension data. Full replace of goals, pitfalls, blocked channels, and settings.

**Request body:**
```json
{
  "email": "user@example.com",
  "goals": [...],
  "pitfalls": [...],
  "blocked_channels": [...],
  "settings": {...}
}
```

**Rate limit:** 20 requests/user/hour

#### `POST /extension/save-timer`
Saves daily watch time counters. Called every 3 minutes while watching or every 10 videos.

**Request body:**
```json
{
  "email": "user@example.com",
  "date": "2026-02-18",
  "distracting_videos": 2,
  "distracting_seconds": 1200,
  "neutral_videos": 1,
  "neutral_seconds": 300,
  "productive_videos": 3,
  "productive_seconds": 1800,
  "total_seconds": 3300
}
```

**Rate limit:** 20 requests/user/hour

#### `GET /extension/get-timer`
Returns today's watch time counters.

**Request:** `?email=user@example.com&date=2026-02-18`

**Rate limit:** 20 requests/user/hour

### Watch Events

#### `POST /video/update-watch-time`
Records a completed video session.

**Request body:**
```json
{
  "email": "user@example.com",
  "video_id": "dQw4w9WgXcQ",
  "video_title": "Video title",
  "channel_name": "Channel name",
  "classification": "distracting",
  "watch_seconds": 240
}
```

**Rate limit:** 200 requests/user/hour

### Dashboard

#### `GET /dashboard/stats`
Returns aggregated stats for dashboard. Hourly batch aggregation.

**Request:** `?email=user@example.com&range=7d` (range: `7d` | `30d` | `all`)

**Response:**
```json
{
  "focus_score": 62.5,
  "total_watch_seconds": 14400,
  "by_category": {
    "productive": { "seconds": 9000, "videos": 15 },
    "neutral": { "seconds": 2400, "videos": 4 },
    "distracting": { "seconds": 3000, "videos": 8 }
  },
  "by_hour": [...],
  "peak_hours": "9-11pm",
  "top_channels": [
    { "channel": "Y Combinator", "seconds": 3600, "classification": "productive" }
  ],
  "distracting_channels": [
    { "channel": "MrBeast", "seconds": 1800, "classification": "distracting" }
  ]
}
```

**Rate limit:** 60 requests/user/hour

### User Management

#### `POST /user/update-plan`
Admin-only. Protected by `ADMIN_SECRET` header. Updates a user's plan.

**Request body:**
```json
{
  "email": "user@example.com",
  "plan": "pro",
  "admin_secret": "..."
}
```

### Admin Endpoints

All admin endpoints accept either `X-Admin-Secret: ADMIN_SECRET` or `Authorization: Bearer ADMIN_SECRET` header. Return `403` if missing or incorrect. Never expose these URLs publicly.

#### `POST /admin/set-trial`
Manually set a user's trial expiry. Used for testing trial expiry and upgrade flows.

**Request body:**
```json
{
  "email": "user@example.com",
  "trial_expires_at": "2026-02-18T00:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "email": "user@example.com",
  "trial_expires_at": "2026-02-18T00:00:00Z"
}
```

#### `POST /admin/set-plan`
Manually set a user's plan. Used for testing plan states (trial, pro, free).

**Request body:**
```json
{
  "email": "user@example.com",
  "plan": "free"
}
```

**Response:**
```json
{
  "success": true,
  "email": "user@example.com",
  "plan": "free"
}
```

#### `GET /admin/user`
Fetch full user record for debugging.

**Request:** `?email=user@example.com`

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "plan": "trial",
  "trial_started_at": "...",
  "trial_expires_at": "...",
  "created_at": "..."
}
```

#### `POST /admin/reset-counters`
Resets all blocking state for a user for testing. Clears `daily_limit_minutes` and `focus_window_enabled` in `extension_data.settings`, and deletes today's `video_sessions`.

**Note:** Chrome local storage (`ft_watch_seconds_today`, `ft_daily_counters`, `ft_focus_window_enabled`) must be cleared separately via the console reset snippet — the backend cannot reach the extension's local storage.

**Request body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true
}
```

#### `DELETE /admin/reset-user`
Deletes all `video_sessions`, `video_classifications`, `journal_entries`, and `extension_data` for a user. Does NOT delete the auth record or `users` row. Used for clean testing.

**Request body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "deleted": {
    "video_sessions": 14,
    "video_classifications": 14,
    "journal_entries": 0,
    "extension_data": 1
  }
}
```

**Rate limit:** 10 requests/hour (all admin endpoints combined). Admin endpoints log every call server-side.

---

### Billing

#### `POST /stripe/create-checkout`
Creates a Stripe Checkout session for monthly plan.

**Request body:** `{ "email": "user@example.com" }`

**Rate limit:** 10 requests/user/hour

#### `POST /webhook/stripe`
Receives Stripe webhook events. Validates `Stripe-Signature` header using `stripe.webhooks.constructEvent()`. Uses `bodyParser.raw` for raw body.

Events handled:
- `checkout.session.completed` → set `plan = "pro"`
- `customer.subscription.deleted` → set `plan = "free"`
- `customer.subscription.updated` → update plan accordingly

#### `GET /checkout-success`
Redirect target after successful Stripe checkout. Updates plan, redirects to dashboard.

#### `GET /checkout-cancel`
Redirect target after cancelled checkout. Redirects to pricing page.

### Onboarding

#### `GET /health`
No auth. Returns `{ "status": "ok" }`.

---

## 5. AUTHENTICATION FLOW

### Email Signup
1. User submits email + password
2. Server checks email against disposable domain blocklist — reject with `400` if matched
3. `supabase.auth.signUp({ email, password })` called client-side
4. Supabase creates `auth.users` record, sends confirmation email
5. Client inserts into `public.users`: `{ email, plan: "trial", trial_started_at: now, trial_expires_at: now + 14d }`
6. Client calls `storeEmailForExtension(email)` via postMessage bridge
7. Extension background stores `ft_user_email`, triggers bootstrap sync
8. Frontend navigates to `/goals`

### Google OAuth Signup
1. User clicks "Continue with Google"
2. `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })` called
3. Redirect to Google → back to `/login` (or `/login?return=extension`)
4. On return: `supabase.auth.getSession()` — if session found:
5. Check `public.users` for existing row by email
6. If no row (new user): insert with `plan: "trial"`, 14-day expiry; navigate to `/goals`
7. If row exists (returning user): navigate to `/app/dashboard`
8. Call `storeEmailForExtension(email)` via postMessage bridge
9. If `?return=extension`: close tab after 2 seconds

### Email Login
1. User submits email + password
2. `supabase.auth.signInWithPassword({ email, password })` called
3. On success: query `public.users` for plan
4. Call `storeEmailForExtension(email)` via postMessage bridge
5. If `?return=extension`: close window after 1.5s
6. Otherwise: navigate to `/app/dashboard`

### Session Management
- Supabase handles session persistence via `localStorage`
- `useRequireAuth` hook guards `/app/*` routes
- Sessions auto-refresh via Supabase client
- Extension does NOT use Supabase sessions — email-based identification only
- `App.tsx` listens for `FT_LOGOUT_FROM_EXTENSION` window messages

### Disposable Email Check
- Maintained as `DISPOSABLE_EMAIL_DOMAINS` env var (comma-separated list)
- Checked server-side on signup before user creation
- Return `400 { error: "Email provider not supported" }` — do not reveal it's a blocklist check

---

## 6. EXTENSION ARCHITECTURE

### File Structure
```
extension/
├── manifest.json
├── popup.html
├── popup.js
├── background/
│   └── background.js        # Service worker (ES module)
├── content/
│   ├── content.js           # YouTube page script
│   ├── overlay.css          # Overlay styles
│   └── website-bridge.js    # Frontend ↔ extension bridge
└── lib/
    ├── config.js            # BACKEND_URL, FRONTEND_URL (env-injected)
    ├── constants.js         # Thresholds, counter keys, timing
    ├── rules.js             # Nudge/block logic evaluation
    ├── state.js             # chrome.storage.local read/write
    └── spiral.js            # Spiral detection logic
```

### chrome.storage.local Keys
| Key | Type | Purpose |
|-----|------|---------|
| `ft_user_email` | string | Logged-in user email |
| `ft_plan` | string | `"trial"` \| `"pro"` \| `"free"` |
| `ft_trial_expires_at` | string | ISO timestamp |
| `ft_trial_days_left` | number | Days remaining |
| `ft_can_record` | boolean | Whether tracking is active |
| `ft_goals` | string[] | User goals |
| `ft_pitfalls` | string[] | User pitfalls (always `pitfalls`, not `anti_goals`) |
| `ft_blocked_channels` | string[] | Blocked channel names |
| `ft_settings` | object | Full settings object |
| `ft_daily_counters` | object | Per-day video and time counts by category |
| `ft_last_sync` | string | ISO timestamp of last server sync |
| `ft_focus_window_enabled` | boolean | Focus window on/off |
| `ft_focus_window_start` | string | e.g. `"09:00"` |
| `ft_focus_window_end` | string | e.g. `"12:00"` |
| `ft_search_count_today` | number | Search count for today |
| `ft_search_count_date` | string | Date string for count (reset check) |
| `ft_shorts_time_today` | number | Seconds of Shorts watched today |
| `ft_shorts_count_today` | number | Number of Shorts watched today |

### Daily Counter Reset
- On each page load, compare `ft_daily_counters.date` with today's local date
- If different: reset all counters to zero, update date
- Focus window: never reset — it's a persistent user setting

### Background Service Worker Responsibilities
- Handle `FT_STORE_EMAIL_FROM_WEBSITE` message → store email, trigger bootstrap
- Sync with `/extension/bootstrap` on install and on login
- Periodic sync with `/extension/save-timer` every 3 minutes while active tab is YouTube
- Check trial expiry on startup
- Send `FT_LOGOUT_FROM_EXTENSION` to website bridge on logout

### Content Script Responsibilities (`content.js`)
- Detect video page load and video changes
- Track watch time per video
- Trigger classification after 30 seconds of watch time
- Evaluate nudge/block rules via `rules.js`
- Render overlays and counters
- Track Shorts watch time and count
- Track search queries
- Intercept channel navigation for channel blocks
- Hide recommendations when setting enabled

### Website Bridge (`website-bridge.js`)
- Injected on `focustube.co.uk` pages only
- Listens for `postMessage` from frontend pages
- Forwards messages to background via `chrome.runtime.sendMessage`
- Handles: `FT_STORE_EMAIL_FROM_WEBSITE`, `FT_LOGOUT_FROM_EXTENSION`

### Popup (`popup.js`)
- On open: call `/license/verify` to get fresh plan status
- Render correct state (logged out / trial / pro / expired)
- Show trial upgrade nudge on days 17, 23, 27, 28, 29 (first popup open of the day)

### Manifest Requirements
```json
{
  "manifest_version": 3,
  "permissions": ["storage", "tabs"],
  "host_permissions": [
    "*://*.youtube.com/*",
    "BACKEND_URL/*",
    "FRONTEND_URL/*"
  ],
  "externally_connectable": {
    "matches": ["FRONTEND_URL/*"]
  },
  "background": {
    "service_worker": "background/background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["*://*.youtube.com/*"],
      "js": ["content/content.js"],
      "css": ["content/overlay.css"],
      "run_at": "document_idle"
    },
    {
      "matches": ["FRONTEND_URL/*"],
      "js": ["content/website-bridge.js"]
    }
  ]
}
```

---

## 7. DATA SYNC STRATEGY

### Extension → Backend
- Sync timer data: every 3 minutes while YouTube tab is active, OR every 10 video events
- Bootstrap sync: on extension install, on login, on wakeup from sleep
- Settings changes made in website propagate to extension within 3 minutes (polled by background worker)

### Backend → Extension
- Extension polls `/extension/get-data` every 3 minutes in background worker
- On data change (new blocked channel, settings update), extension gets it within 3 minutes

### Conflict resolution
- Server is always source of truth
- Extension local storage is cache only
- On bootstrap, always overwrite local cache with server data

---

## 8. AI CLASSIFICATION — TWO-PASS LOGIC

```
POST /ai/classify
  ↓
Check video_classifications cache
  ↓ (cache miss)
Pass 1: gpt-4o-mini
  Input: title, channel, description, category, tags, user goals, user pitfalls
  Output: { classification, confidence }
  ↓
confidence >= 0.65?
  YES → cache result, return
  NO  → Pass 2: claude-sonnet-3-5
         Same input
         Output: { classification, confidence }
         Cache result (model: "claude-sonnet-3-5"), return
  ↓
Any API error at any point → return "neutral", do not cache
```

**Prompt structure (both passes):**
```
You are classifying YouTube videos for a user who is trying to avoid distraction.

User goals: {goals}
User pitfalls (things they find distracting): {pitfalls}

Video info:
Title: {title}
Channel: {channel}
Description: {description}
Category: {category}
Tags: {tags}

Classify this video as one of: productive, neutral, distracting.
Also provide a confidence score from 0.0 to 1.0.

Rules:
- productive: directly helps the user achieve their stated goals
- distracting: matches user pitfalls OR is entertainment with no productive value
- neutral: neither clearly productive nor clearly distracting
- Base classification on content first; override with user goals/pitfalls only when a direct match

Respond with JSON only: {"classification": "...", "confidence": 0.0}
```

---

## 9. RATE LIMITING

Implemented via `express-rate-limit` middleware. Applied per route.

| Endpoint | Limit |
|----------|-------|
| `POST /ai/classify` | 50/user/day |
| `POST /ai/normalize-channels` | 10/user/hour |
| `GET /extension/bootstrap` | 20/user/hour |
| `GET /license/verify` | 60/user/hour |
| `GET /extension/get-data` | 20/user/hour |
| `POST /extension/save-data` | 20/user/hour |
| `POST /extension/save-timer` | 20/user/hour |
| `GET /extension/get-timer` | 20/user/hour |
| `POST /video/update-watch-time` | 200/user/hour |
| `GET /dashboard/stats` | 60/user/hour |
| `POST /stripe/create-checkout` | 10/user/hour |
| `POST /signup` (auth) | 5/IP/hour |
| `POST /login` (auth) | 5/IP/hour |

All rate limit responses: `HTTP 429` with `{ "error": "Too many requests. Please try again later." }`

---

## 10. SECURITY REQUIREMENTS

### Authentication & Authorization
- All backend endpoints require valid `email` matching a row in `public.users`
- JWT verification for sensitive endpoints (verify Supabase JWT from `Authorization` header)
- `/user/update-plan` requires `ADMIN_SECRET` header — reject anything else
- Plan enforcement always server-side. Client-side plan state never trusted for access decisions
- Stripe webhook: always verify `Stripe-Signature` using `stripe.webhooks.constructEvent()`

### Input Validation (every endpoint)
- Schema validate all request bodies (reject unknown fields)
- Email: max 255 chars, valid email format
- Goals/pitfalls: max 500 chars each
- Channel names: max 100 chars each, strip HTML
- Daily limit: integer 0–120
- Focus window times: valid HH:MM format, 08:00–22:00 range
- Watch seconds: positive integer
- Reject malformed input with `400` — never crash, never store unvalidated data

### Key Security
- No API keys in code — all via environment variables
- Client-side: only `VITE_SUPABASE_ANON_KEY` and `VITE_STRIPE_PUBLISHABLE_KEY`
- Service role key, OpenAI key, Anthropic key, Stripe secret: server-side only
- All keys rotatable without code changes

### HTTPS & Headers
- All communication over HTTPS only
- Secure cookies: `httpOnly: true`, `secure: true`, `sameSite: "strict"`
- Content Security Policy headers on all responses
- CORS: allow only `chrome-extension://*`, `FRONTEND_URL`, `localhost:*` (dev only)
- No user data in URL parameters

### XSS & Injection Prevention
- Strip HTML from all text inputs before storage
- Parameterized queries via Supabase client (automatic)
- Sanitize all user-generated content before rendering
- Never render raw HTML from user input

### Error Handling
- Never expose stack traces to client
- Log errors server-side with full context
- Return `{ "error": "Something went wrong" }` for unexpected failures
- Extension must remain usable if backend is unavailable (degrade gracefully to neutral classification, skip nudges)

### DEBUG_MODE
- `DEBUG_MODE = false` in production builds
- `DEBUG_MODE = true` in development only
- Controlled via `NODE_ENV` check in `constants.js`

---

## 11. CORS CONFIGURATION

Backend `server/src/index.ts` allows:
- `chrome-extension://*`
- `FRONTEND_URL` (from env var)
- `http://localhost:*` (development only — gated by `NODE_ENV !== "production"`)
- `*://*.youtube.com` (for extension content script requests)

Never hardcode domain names in CORS config. Read from `FRONTEND_URL` env var.

---

## 12. STRIPE INTEGRATION

- Monthly plan only: `STRIPE_PRICE_MONTHLY` ($5/month)
- No annual or lifetime plans in MVP (no dead price ID env vars)
- Checkout: `POST /stripe/create-checkout` → returns `{ checkoutUrl }`
- Frontend redirects to Stripe Checkout URL
- Success: Stripe redirects to `GET /checkout-success` → update plan in DB → redirect to dashboard
- Cancel: Stripe redirects to `GET /checkout-cancel` → redirect to pricing
- Webhook: `POST /webhook/stripe` with signature verification
- Webhook events: `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.updated`

---

## 13. DEPLOYMENT

| Component | Platform | Notes |
|-----------|----------|-------|
| Frontend | Vercel | SPA rewrite: all routes → `/index.html` |
| Backend | Render | `npm run build` (tsc) then `npm run start` (node dist/index.js) |
| Database | Supabase | Migrations run manually in Supabase SQL editor |
| Extension | Chrome Web Store | Manual submission; load unpacked for development |

### OAuth Redirect URIs (Supabase dashboard)
- `https://focustube.co.uk/login`
- `https://focustube.co.uk/login?return=extension`
- `https://focustube.co.uk/goals`
- `http://localhost:8080/login` (dev)
- `http://localhost:8080/login?return=extension` (dev)
- `http://localhost:8080/goals` (dev)

### Stripe Webhook URL
`POST https://[BACKEND_URL]/webhook/stripe`

### Database Migration Order
```
000_create_users.sql
001_create_journal_entries.sql
002_create_video_classifications.sql
003_create_video_sessions.sql
004_add_goals_columns.sql
005_fix_rls_policies.sql
006_create_extension_data.sql
007_add_rls_policies.sql
008_add_journal_columns.sql
supabase-rls-setup.sql
```
