# FocusTube — Backend Document
**Version:** v2 (MVP)

---

## Stack

| Layer | Technology |
|---|---|
| API server | Node.js + Express on Render |
| Database + Auth | Supabase (Postgres) |
| AI | OpenAI gpt-4o-mini |
| Payments | Stripe Checkout + Webhooks |

---

## Database Tables

### `users`
Auth and billing only. No preferences stored here.

| Column | Type | Notes |
|---|---|---|
| `email` | text | Primary identifier |
| `plan` | text | Values: `free`, `pro_trial`, `pro` — DB stores `pro_trial`, extension cache uses `trial` |
| `trial_started_at` | timestamptz | Set on signup |
| `trial_expires_at` | timestamptz | trial_started_at + 30 days |
| `stripe_customer_id` | text | Set on first payment |

### `extension_data`
One row per user. All persistent preferences and state.

| Column | Type | Notes |
|---|---|---|
| `goals` | text[] | User's stated goals |
| `pitfalls` | text[] | User's stated distractions — NEVER anti_goals || `blocked_channels` | text[] | Persists across devices |
| `blocked_channels_today` | text[] | Temporary daily blocks |
| `settings` | jsonb | See settings schema below |
| `focus_window_start` | text | HH:MM format |
| `focus_window_end` | text | HH:MM format |
| `channel_spiral_count` | jsonb | Per-channel watch counts + time |
| `channel_lifetime_stats` | jsonb | Total videos + seconds per channel |
| `watch_history` | jsonb | Rolling 30-day watch history |

### `video_sessions`
Raw watch events. Used for dashboard aggregation.
Retained for 60 days then purged.

| Column | Type |
|---|---|
| `user_id` | text |
| `video_id` | text |
| `video_title` | text |
| `channel_name` | text |
| `watch_seconds` | integer |
| `started_at` | timestamptz |
| `watched_at` | timestamptz |
| `distraction_level` | text |
| `category_primary` | text |
| `confidence_distraction` | float |

### `video_classifications`
Cached AI results per `(user_id, video_id)`.
Cache TTL: 24 hours.

### `journal_entries`
Raw journaling text with context.

| Column | Type |
|---|---|
| `user_id` | text |
| `note` | text |
| `distraction_level` | text |
| `context` | jsonb (channel, title, url, source) |
| `created_at` | timestamptz |

### `channel_classifications` (Phase 11 — post-core)
Shared repository of channel-level classifications for Shorts.

| Column | Type | Notes |
|---|---|---|
| `channel_id` | text | YouTube channel ID |
| `channel_name` | text | |
| `classification` | text | `educational`, `entertainment`, `mixed` |
| `confidence` | float | 0-1 |
| `classified_at` | timestamptz | |
| `classification_count` | integer | How many users triggered this |

---

## Settings Schema (Locked)

The `settings` JSON object in `extension_data`:

```json
{
  "block_shorts": boolean,
  "hide_recommendations": boolean,
  "daily_time_limit_minutes": integer,
  "focus_window_enabled": boolean,
  "focus_window_start": "HH:MM",
  "focus_window_end": "HH:MM"
}
```

- `daily_time_limit_minutes`: 0 = disabled, max 120
- `focus_window_start`: minimum "08:00"
- `focus_window_end`: maximum "22:00"
- Max window duration: 6 hours

---

## API Endpoints (Locked)

Do not rename, add, or remove without explicit instruction.

### Bootstrap
- `GET /extension/bootstrap`
  Returns: `plan`, `trial_days_remaining`, `goals`, `pitfalls`, `blocked_channels`, `blocked_channels_today`, `settings`, `focus_window_start`, `focus_window_end`, `channel_spiral_count`

- `POST /extension/state`
  Partial updates: `blocked_channels`, `blocked_channels_today`, `settings`, `goals`, `pitfalls`, `channel_spiral_count`, `watch_history`

### AI
- `POST /ai/classify`
  Input: video metadata (`video_id`, `video_title`, `channel_name`, `video_description`, `video_tags`, `is_shorts`, `duration_seconds`, `related_videos`) + `user_goals` + `user_id`
  Output: `distraction_level`, `category_primary`, `category_secondary`, `confidence_distraction`, `confidence_category`, `goals_alignment`, `reasons`, `action_hint`

- `POST /ai/parse-channels`
  Input: raw free-text channel names from onboarding
  Output: structured array of `{ channel_name, channel_id }`
  Called ONCE on onboarding submit only. Never on re-login.

### Events
- `POST /events/watch` — batch watch events
- `POST /events/journal` — journal entry save
- `POST /video/update-watch-time` — legacy watch time (kept for backward compatibility)

### Billing
- `POST /stripe/create-checkout` — create Stripe checkout session (monthly only, £4.99/month)
- `POST /stripe/webhook` — Stripe payment events (idempotent)
- `GET /billing/portal` — Stripe customer portal link

**MVP pricing: monthly only.** Annual and lifetime plans are out of scope.

### User
- `POST /user/update-plan` — update plan in Supabase
- `GET /journal` — fetch journal entries
- `POST /journal` — save journal entry

### Health
- `GET /health` — server health check

---

## State Sync Rules

- Server state ALWAYS wins on conflict
- Local extension storage is cache only
- On login → fetch immediately, overwrite cache
- On upgrade → fetch immediately
- On settings change → fetch immediately
- Polling fallback → every 6 hours
- If backend unreachable → use cached rules, do not clear state
- On suspend/unload → flush watch event queue and save data to server

---

## AI Classification Rules

1. Classify based on content alone (title, channel, metadata)
2. Override only if video directly matches a user goal or pitfall
3. Cache result per `(user_id, video_id)` for 24 hours
4. Shorts: always classified as distracting — no AI call needed
5. Free users: classification skipped, default to neutral
6. If OpenAI unavailable → classify as neutral, never break flow
7. Classification only runs after user has watched for 45 seconds (avoids classifying skipped videos)
8. Related videos metadata is included in classification request for context

---

## Search Limits

Enforced server-side and in extension.

| Plan | Warning | Hard block |
|---|---|---|
| Free | Search 3 and 4 | Search 5 |
| Pro | Search 13 and 14 | Search 15 |

---

## Security Requirements

- No API keys or secrets in client or extension code
- All secrets via environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_BASE_URL`
- HTTPS only
- CORS locked to site and extension origins
- Rate limiting on all endpoints (IP-based + user-based)
- All user inputs validated and sanitised before storage
- Plan enforcement is server-side only — never trust client state
- Stripe webhooks must be idempotent

---

## Failure Modes

- AI unavailable → neutral classification
- Backend unreachable → use cached rules
- Channel parse fails → save raw input, flag, continue onboarding
- Stripe webhook delayed → idempotent retry
- Partial write → server state wins on next sync
