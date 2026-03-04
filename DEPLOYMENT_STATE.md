# DEPLOYMENT STATE
_Generated from actual config files and source code. No guesses._

---

## FRONTEND DEPLOYMENT

**Platform:** Vercel
- Config file: `frontend/vercel.json`
- CORS allowlist in `server/src/index.ts` explicitly names `focustube-beta.vercel.app`

**Build command:** `vite build`
- Defined in `frontend/package.json` → `scripts.build`

**Output directory:** `dist` (Vite default; not overridden in `vite.config.ts`)

**Framework:** React 18 + Vite 5 (plugin: `@vitejs/plugin-react-swc`)
- Detected from `frontend/package.json` and `frontend/vite.config.ts`

**Node version required:** Not pinned. No `.nvmrc` or `.node-version` file present.
- TypeScript target is `ES2020` (`frontend/tsconfig.app.json`)
- `@types/node` pinned to `^22.16.5` in devDependencies

**Dev command:** `vite` (runs on port `8080`, host `::`)
- Port defined in `frontend/vite.config.ts`

**Preview command:** `vite preview`

**Environment variables referenced (names only):**
- `VITE_SUPABASE_URL` — used in `frontend/src/lib/supabase.ts`
- `VITE_SUPABASE_ANON_KEY` — used in `frontend/src/lib/supabase.ts`
- `VITE_BACKEND_URL` — defined in `frontend/.env`; **not used in frontend source code** (pages hardcode the Render URL directly)
- `VITE_STRIPE_PUBLISHABLE_KEY` — defined in `frontend/.env`; not found used in frontend source
- `VITE_EXTENSION_ID` — defined in `frontend/.env` with a **formatting bug**: line reads `fjidkljalheiiopfieeepoknicgmefmgVITE_EXTENSION_ID=fjidkljalheiiopfieeepoknicgmefmg` (key and value concatenated, missing newline)

**Vercel rewrite rule** (`frontend/vercel.json`):
```json
{ "source": "/(.*)", "destination": "/index.html" }
```
Single catch-all rewrite for SPA routing.

---

## BACKEND DEPLOYMENT

**Platform:** Render
- No `render.yaml` found in repo
- Production URL hardcoded across codebase: `https://focustube-backend-4xah.onrender.com`
- Files containing this URL: `extension/content/content.js`, `extension/popup.js`, `extension/background/background.js`, `extension/lib/state.js`, `extension/lib/config.js`, `frontend/src/pages/Goals.tsx`, `frontend/src/pages/Settings.tsx`, `frontend/src/pages/Dashboard.tsx`, `frontend/src/components/dashboard/ChannelAudit.tsx`, `server/test-classifier-*.js`

**Start command:** `node dist/index.js`
- Defined in `server/package.json` → `scripts.start`

**Build command:** `tsc`
- Defined in `server/package.json` → `scripts.build`
- Output compiled to `server/dist/` (set in `server/tsconfig.json` → `outDir`)
- Entry point after build: `dist/index.js`

**Port configuration:**
- `const PORT = process.env.PORT || 3000;` — `server/src/index.ts` line 31
- Render injects `PORT` automatically

**Node version required:** Not pinned. No `.nvmrc` or `.node-version` file present.
- TypeScript target is `ES2020` (`server/tsconfig.json`)
- `@types/node` pinned to `^20.10.6`

**Environment variables referenced (names only):**
- `PORT` — server/src/index.ts line 31
- `NODE_ENV` — server/src/index.ts lines 193, 2288, 2410, 2568
- `CORS_ORIGIN` — defined in `server/.env.example`; **not used in `server/src/index.ts`** (CORS logic is hardcoded, not read from this variable)
- `SUPABASE_URL` — server/src/supabase.ts line 6
- `SUPABASE_SERVICE_ROLE_KEY` — server/src/supabase.ts line 7
- `STRIPE_SECRET_KEY` — server/src/index.ts line 77
- `STRIPE_WEBHOOK_SECRET` — server/.env.example (referenced by name; consumed inside webhook handler)
- `STRIPE_PRICE_MONTHLY` — server/src/index.ts line 89
- `STRIPE_PRICE_ANNUAL` — server/src/index.ts line 90 _(dead code per Section 16 of .cursorrules)_
- `STRIPE_PRICE_LIFETIME` — server/src/index.ts line 91 _(dead code per Section 16 of .cursorrules)_
- `OPENAI_API_KEY` — server/src/index.ts line 96
- `OPENAI_CLASSIFIER_MODEL` — server/src/index.ts line 478 (optional override for classification model)
- `ADMIN_SECRET` — server/src/index.ts lines 1267–1268 (used to gate an admin route)

---

## EXTERNAL SERVICES CONFIGURED

### Supabase
- **Frontend client:** `frontend/src/lib/supabase.ts`
  - Uses anon key (`VITE_SUPABASE_ANON_KEY`)
  - Auth config: `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: true` (needed for OAuth redirects)
- **Backend client:** `server/src/supabase.ts`
  - Uses service role key (`SUPABASE_SERVICE_ROLE_KEY`) — admin access, bypasses RLS
  - Auth config: `autoRefreshToken: false`, `persistSession: false`
- **Features used:**
  - Auth (email/password + Google OAuth via `supabase.auth.signInWithOAuth`)
  - Database reads/writes to: `users`, `video_classifications`, `video_sessions`, `journal_entries` tables
  - No Supabase Storage usage found

### OpenAI
- **Client:** `server/src/index.ts` lines 96–106
- **Models referenced:**
  - `gpt-4o-mini` — hardcoded default in two places: lines 480, 1001
  - Configurable override via `OPENAI_CLASSIFIER_MODEL` env var (line 478)
- **API calls:**
  - `openaiClient.chat.completions.create(...)` — video classification (line 573)
  - `openaiClient.chat.completions.create(...)` — retry on parse failure (line 600)
  - `openaiClient.chat.completions.create(...)` — channel name normalization (line 1000)

### Stripe
- **Client:** `server/src/index.ts` lines 77–86
  - Stripe API version: `"2023-10-16"`
- **Endpoints implemented:**
  - `POST /stripe/create-checkout` — creates a Stripe Checkout session (line 2198)
  - `POST /webhook/stripe` — receives Stripe webhook events (line 2283); uses `bodyParser.raw`
  - `GET /checkout-success` — redirect landing after successful checkout (line 2424)
  - `GET /checkout-cancel` — redirect landing after cancelled checkout (line 2497)
- **Checkout success/cancel URLs** are dynamically built from `req.protocol` + `req.get("host")` (lines 2255–2256), not hardcoded
- **Price IDs configured:** `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL` (dead), `STRIPE_PRICE_LIFETIME` (dead)

### Google OAuth
- **Provider:** Supabase Auth (not direct Google API)
- **Usage in frontend:**
  - `frontend/src/pages/Login.tsx` line 109: `supabase.auth.signInWithOAuth({ provider: "google", ... })`
  - `frontend/src/pages/Signup.tsx` line 30: same call
- **Redirect URIs used:**
  - Login: dynamic `redirectUrl` variable (computed at runtime based on `?return=extension` query param) — `frontend/src/pages/Login.tsx` line 112
  - Signup: `${window.location.origin}/goals` — `frontend/src/pages/Signup.tsx` line 33
- **Scopes:** Not explicitly configured in code; uses Supabase defaults for Google provider
- **Note:** Both Login and Signup UI comment out the Google OAuth button as "Disabled for MVP, will enable later" (lines 211 and 196 respectively), but the handler code is active

---

## URLS & ENDPOINTS

**Production frontend URL:**
- `https://focustube-beta.vercel.app`
- Sources: `extension/manifest.json` (host_permissions, content_scripts, externally_connectable), `server/src/index.ts` CORS allowlist, `TECHNICAL_SPEC.md`, `docs/TEST_PLAN.md`, `MANUAL_TEST_PLAN.md`

**Production backend URL:**
- `https://focustube-backend-4xah.onrender.com`
- Hardcoded (not env-var driven) in: `extension/content/content.js` line 38, `extension/popup.js` line 4, `extension/background/background.js` line 1211, `extension/lib/state.js` line 362, `extension/lib/config.js` lines 12 + 22, `frontend/src/pages/Goals.tsx`, `frontend/src/pages/Settings.tsx`, `frontend/src/pages/Dashboard.tsx`, `frontend/src/components/dashboard/ChannelAudit.tsx`, `server/test-classifier-*.js`

**Supabase project URL:**
- `https://asskfpjajdqnoiwfzedk.supabase.co`
- Source: `frontend/.env` line 2 (`VITE_SUPABASE_URL`)

**All backend API routes** (from `server/src/index.ts`):

| Method | Path | Line |
|--------|------|------|
| GET | `/health` | 208 |
| POST | `/ai/classify` | 223 |
| POST | `/video/update-watch-time` | 759 |
| GET | `/license/verify` | 813 |
| POST | `/ai/normalize-channels` | 943 |
| GET | `/extension/get-data` | 1083 |
| POST | `/extension/save-data` | 1211 |
| POST | `/extension/save-timer` | 1415 |
| GET | `/extension/get-timer` | 1501 |
| GET | `/dashboard/stats` | 1581 |
| POST | `/user/update-plan` | 1986 |
| POST | `/events/watch` | 2050 |
| POST | `/journal` | 2145 |
| POST | `/stripe/create-checkout` | 2198 |
| POST | `/webhook/stripe` | 2283 |
| GET | `/checkout-success` | 2424 |
| GET | `/checkout-cancel` | 2497 |

**Note:** Routes defined in spec (`/extension/bootstrap`, `/extension/state`, `/events/video-session`, `/events/journal`, `/ai/parse-channels`, `/billing/portal`) do not match the implemented routes above. The actual implementation uses different paths.

---

## BUILD & SCRIPTS

**Frontend** (`frontend/package.json`):

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite` | Local dev server (port 8080) |
| `build` | `vite build` | Production build |
| `build:dev` | `vite build --mode development` | Development build |
| `lint` | `eslint .` | Lint check |
| `preview` | `vite preview` | Preview production build locally |

**Backend** (`server/package.json`):

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `ts-node-dev --respawn --transpile-only src/index.ts` | Local dev server with hot reload |
| `build` | `tsc` | Compile TypeScript → `dist/` |
| `start` | `node dist/index.js` | Run compiled production build |
| `type-check` | `tsc --noEmit` | Type check without emitting |

**Database migrations:** No migration scripts found in either `package.json`. No migration tool (Prisma, Knex, Flyway, etc.) configured. Schema changes are managed directly in Supabase dashboard.

**Test/deploy scripts:** No deploy scripts in either `package.json`. Three manual test scripts exist in `server/` root (not in `package.json` scripts):
- `server/test-classifier-focused.js`
- `server/test-classifier-urls.js`
- `server/test-classifier-bulk.js`
