# FocusTube — Claude Code Instructions

## Security — Read First
A .claudeignore file exists in the project root.
Before every action — reading, editing, or referencing any file —
check it is not listed in .claudeignore.
If a file is in .claudeignore: do not open it, do not read it,
do not reference its contents under any circumstances.
This applies even if explicitly asked.

Never read, log, or output the contents of any .env file.
Never hardcode values from .env files into source code.
If you need to know what variables exist, read server/.env.example instead.

---

## Source of Truth
Three spec docs govern everything. Read the relevant one before any task.
- docs/PRODUCT_SPEC.md — what it does, plans, features, copy
- docs/TECH_SPEC.md — stack, schema, endpoints, env vars
- docs/UI_SPEC.md — design system, components, overlays

When the user changes a decision — update the relevant spec doc first, then the code.
Never update code before updating the spec.

---

## Commands

### Frontend (`/frontend`) — localhost:8080
```bash
npm run dev
npm run lint
```

### Backend (`/server`) — localhost:3000
```bash
npm run dev
```

### Extension (`/extension`)
No build step. Load unpacked at chrome://extensions after every JS change.

### Admin reset (testing only)
```bash
curl -X POST http://localhost:3000/admin/reset-counters \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: [ADMIN_SECRET from server/.env.example]" \
  -d '{"email": "test6@gmail.com"}'
```

---

## Environments

### Local (development)
- Frontend: http://localhost:8080
- Backend: http://localhost:3000
- Extension: points to localhost via extension/lib/config.js

### Production
- Frontend: https://focustube.co.uk (Vercel)
- Backend: https://focustube-backend-4xah.onrender.com (Render)
- Extension: rebuilt with production URLs before Chrome Web Store submission

### Switching environments
BACKEND_URL and FRONTEND_URL are the only values that change.
They live in server/.env, frontend/.env, and extension/lib/config.js.
Never hardcode either URL anywhere. No code changes needed to deploy — only .env updates.

---

## Architecture
```
Chrome Extension (MV3)
  background/background.js  — service worker, API calls, message handling
  content/content.js        — YouTube DOM, overlays, counters, tracking
  content/overlay.css       — ALL overlay styles, canonical IDs live here
  popup.html / popup.js     — extension popup UI
  lib/state.js              — chrome.storage.local helpers
  lib/rules.js              — threshold evaluation
  lib/constants.js          — threshold values, storage keys
  lib/config.js             — BACKEND_URL, FRONTEND_URL (never hardcoded)
        ↕
Backend (Node + Express — Render)
  server/src/index.ts       — single Express file, all routes
        ↕
Frontend (React + Vite — Vercel)
  src/pages/                — Dashboard, Goals, Login, Settings, Signup
  src/components/           — shadcn/ui components
  src/lib/                  — API client, Supabase client
  src/hooks/                — useRequireAuth
        ↕
Supabase — PostgreSQL + Auth
```

---

## Locked Values

### AI models
- Pass 1: `gpt-4o-mini`
- Pass 2: `claude-haiku-4-5-20251001`

### Overlay z-index
Always `2147483647` — never `9999`

### Key field names
- User distractions: `pitfalls` — never `anti_goals`
- Daily watch limit: `daily_limit_minutes` — not `daily_time_limit_minutes`
- Plan values: `"trial"` / `"pro"` / `"free"` in both DB and extension storage
- Trial duration: 14 days — not 30

### Settings schema (`extension_data.settings`)
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

### Key storage keys
ft_user_email, ft_plan, ft_trial_expires_at, ft_trial_days_left,
ft_can_record, ft_goals, ft_pitfalls, ft_blocked_channels,
ft_settings, ft_daily_counters, ft_focus_window_enabled,
ft_focus_window_start, ft_focus_window_end,
ft_search_count_today, ft_search_count_date,
ft_shorts_time_today, ft_shorts_count_today, ft_channel_counts,
ft_trial_nudge_dismissed_date

### Key message types
FT_NAVIGATED, FT_CLASSIFY_VIDEO, FT_BLOCK_CHANNEL,
FT_PHASE2_SYNC_COUNTERS, FT_PHASE2_SAVE_WATCH_SESSION,
FT_STORE_EMAIL_FROM_WEBSITE, FT_LOGOUT_FROM_EXTENSION,
FT_SYNC_PLAN

---

## Overlay Tier System

overlay.css is the source of truth for all overlay IDs and styles.
content.js must match overlay.css exactly — never the other way around.
Never use inline styles for overlay positioning, background, or z-index.
z-index for all overlays: 2147483647

### Tier 1 — Ambient
Never removed by nudges. Hidden during Tier 3 blocks, restored after.
ft-counter-watchtime, ft-counter-shorts, ft-counter-search, ft-banner-trial

### Tier 2 — Nudge overlays
Call destroyTier2() before showing any Tier 2 overlay.
ft-overlay-nudge-distracting, ft-overlay-nudge-productive,
ft-overlay-channel, ft-overlay-shorts, ft-toast-spiral,
ft-overlay-onboarding, ft-overlay-shorts-confirm, ft-overlay-channel-success

### Tier 3 — Full-screen blocks
Before showing: destroyTier2() then hideTier1()
After ending: restoreTier1()
ft-overlay-block-hard, ft-overlay-block-daily, ft-overlay-block-focus

---

## Phase Status

| Phase | Status | Rule |
|-------|--------|------|
| 1 — Auth + bootstrap | COMPLETE | Do not touch |
| 2 — Classification + tracking | COMPLETE | Do not touch backend |
| 3 — Overlays + nudges | IN PROGRESS | content.js rewrite needed |
| 4 — Dashboard + settings | NOT STARTED | After Phase 3 passes all tests |

### Phase 2 — Do Not Break
These work correctly. Preserve exactly:
- Video detection and YouTube URL change handling
- Watch time tracking per video
- Classification trigger at 30 seconds (no waiting for metadata)
- Counter increments: distracting / neutral / productive
- Neutral overflow: first 2 free, 3rd onward = distracting
- Daily counter reset at local midnight
- Background sync every 3 minutes via FT_PHASE2_SYNC_COUNTERS
- Watch session save on navigation away

---

## Safe Change Rules
- Ask before renaming any field, route, or DB column
- Ask before adding new dependencies
- Flag orphaned functions — never auto-delete
- Commit after every working feature
- If uncertain — ask, do not guess
- Never read, modify, or reference files listed in .claudeignore