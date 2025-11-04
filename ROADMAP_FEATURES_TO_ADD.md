Features to add:
High Prio:




Other FA Ideas:
- Feature for Dev and Pro / Free Toggle
- Have an overlay after the free mode shorts happens which says XYZ
- Pro mode shorts - have a counter in the corner showing exactly how many shorts theyve watched and how long / some message + button to insta block for day (non-reversible) 





# 🚀 FocusTube Build Roadmap

A clear, priority-ordered plan from current state → launchable v1 → polished v2.  
Each step is isolated and testable.

---

## ✅ Phase 1 — Core to Chargeable MVP (v1 Launch)

| # | Action | Outcome | Est. Time | Target Day |
|:-:|:--|:--|:--|:--|
| [ ] **1. Stabilise Core Extension** | Shorts/Search blocking and overlays fully stable (no delay, no reload issues). | 5h | Day 1 |
| [ ] **2. Finalise Dev/User Toggle Panel** | Switch between Dev/User + Free/Pro instantly, counters reset cleanly. | 3h | Day 1 |
| [ ] **3. Refine Shorts Milestone Popups** | Accurate tracking and motivational messages every few minutes watched. | 4h | Day 2 |
| [ ] **4. Add Global Watch Timer + 30-min Reminders** | Tracks total YouTube time across tabs, shows gentle “take a break” overlay. | 6h | Day 3 |
| [ ] **5. Integrate AI “Focus Relevance” Filter** | OpenAI endpoint checks if search/video is off-topic; blocks or warns user. | 10h | Day 4–5 |
| [ ] **6. Add Supabase Backend (Auth + Data)** | Email/Google login; store plans & usage data in database. | 8h | Day 6 |
| [ ] **7. Connect Stripe Payments + Webhooks** | Stripe Checkout upgrades user → webhook updates plan in Supabase. | 8h | Day 7 |
| [ ] **8. Sync Plan with Extension** | Background fetches plan at startup and after payment success. | 3h | Day 8 |
| [ ] **9. QA: Multi-Tab, Incognito & Edge Cases** | Validate counters, redirects, and AI logic across sessions. | 5h | Day 9 |
| [ ] **10. Launch Prep (Chrome Store)** | Final ZIP, privacy policy, logos, screenshots, short demo. | 3h | Day 10 |

### 🟩 **LAUNCH v1 (Chargeable MVP)**
- Fully functional Chrome extension  
- AI-powered relevance filter  
- Stripe payments + Supabase sync  
- End-to-end monetisable and testable

---

## 🔧 Phase 2 — From MVP to Full Product (v2)

| # | Action | Outcome | Est. Time | Target Day |
|:-:|:--|:--|:--|:--|
| [ ] **11. Add Analytics & Event Logging** | Capture usage metrics in Supabase for insights and reports. | 4h | Day 11 |
| [ ] **12. UI / UX Polish** | Improve overlays, add themes, smooth animations, mobile responsiveness. | 6h | Day 12 |
| [ ] **13. Chrome Store Optimisation & Reviews** | Final polish for listing, marketing copy, screenshots, support email. | 5h | Day 13 |

### 🟦 **MVP v2**
- Stable, trackable, and visually refined  
- Ready for scale, users, and marketing push

---

⏱ **Total Time:**  
- **v1 (Launchable)** → ~60–65 hours (~10 days @ 5–6h/day)  
- **v2 (Polished MVP)** → +20 hours (~3–4 days)

---

### 💡 Notes
- Each step should be committed and tested before moving to the next.  
- Cursor should be run in **“Explain before apply”** mode to avoid regressions.  
- `state.js`, `background.js`, and `content.js` remain single-source-of-truth for logic.

---


























ChatGPT Suggestions:
Added:




To Add:
- Lesson 7F — Dev/User Mode Toggle (1.5h)
Add a persistent on-page toggle for Dev Mode ↔ User Mode and Pro ↔ Free.
Switching modes instantly resets counters, reloads config defaults, and logs state clearly.
Purpose: enable rapid feature testing and mimic true user behavior without reinstalling or clearing storage.
Scope: background.js (mode flag + reset), content.js (floating UI), state.js (reset + apply plan).

- Lesson 8 — Core Hardening (90m)
Debounce SPA nav, unify page-type detection, strict message error-handling, idempotent storage init, minimal debug logging.

- Lesson 9 — Shorts UX (Free/Pro) (2.5h)
Free: pause+mute+overlay with “Go Home.” Pro: corner counter badge and “Block Shorts today” toggle (self-block flag persisted).

- Lesson 10 — Search Threshold UX (90m)
Block overlay on exceeding searches; clear reason text; throttle duplicate overlays; one-click dismiss/ack.

- Lesson 11 — Global Time Cap (2h)
Track watch seconds; enforce daily cap; latch ft_blocked_today; resume next reset period.

- Lesson 12 — Settings Popup (3h)
Plan toggle (Free/Pro/Test), search/time thresholds, reset period (daily/weekly/monthly), dev “test mode,” quick reset buttons.

- Lesson 13 — Options Page & Schema (2h)
Full settings UI, schema validation, versioned migrations, defaults auditor, export/import config JSON.

- Lesson 14 — Dev Telemetry Panel (90m)
Live counters, last decision, pageType, plan, reasons; single “clear all” and per-counter reset.

- Lesson 15 — Overlay Polish (2h)
overlay.css cleanup, focus trap, ARIA roles, ESC to dismiss (when allowed), dark theme, minimal i18n scaffold.

- Lesson 16 — QA Harness (90m)
Repeatable manual checklist, small message-mock utilities, test fixtures for page types, performance sanity timings.

- Lesson 17 — Packaging & Versioning (1h)
Build script, semantic version bump, CHANGELOG, signed zip, git tags/branches.

- Lesson 18 — Chrome Web Store Checklist (2h)
Icons, screenshots, promo copy, privacy policy, permissions rationale, policy compliance notes, submission.

- Lesson 19 — Safari Port (Optional) (4h)
Manifest tweaks, polyfills, WebKit quirks, signing, basic QA.

- Lesson 20 — AI Pre-Wire (Stubs) (2h)
Classifier interface, rate-limit gates, cache keys, fallback to rules, error paths; no external calls yet.

- Lesson 21 — AI Integration (4h)
Fetch video metadata, prompt build, call provider (OpenAI), cache results, degrade gracefully; Pro-gated toggle.

- Lesson 22 — Pro Gating & Temp Unlock (2h)
Feature flags by plan; temporary unlock timer/UI; audit logging; reset with rotation.

- Lesson 23 — Payments (Stripe) (3h)
Stripe Checkout/Portal links, webhook stubs (upgrade/downgrade), plan sync to storage, error handling, test mode.

- Lesson 24 — Charity Unlock (2h)
Donation providers research, “proof” capture (receipt URL/reference), manual verification flow, store unlock note/expiry, UX copy.

Total (without Safari/AI): ~16–18h
With Safari + AI + Payments/Charity: +11–13h













Things worth Noting:
⚙️ TECHNICAL REALITY — What You Can & Can’t Control

✅ You fully control
	•	Enforcing limits while the extension is active (block, redirect, overlay).
	•	Tracking and storing user actions (shorts watched, search count, etc.).
	•	Resetting counters daily / weekly.
	•	Forcing login and checking a plan tier from your backend.
	•	Resetting or switching plans instantly when changed.
	•	Detecting and downgrading Dev/Unpacked installs.
	•	Encrypting or minifying code before publishing.

⚙️ Partial control
	•	Detecting extension disable / reload and requiring re-auth.
	•	Limiting devices per account (via backend).
	•	Detecting developer mode.
	•	Using signed tokens for pro features.

❌ Not in your control
	•	Preventing uninstall.
	•	Blocking usage in other browsers.
	•	Preventing local file editing or bypass scripts.
	•	Stopping people who simply browse in incognito or another profile.

⸻

💡 COMMERCIAL STRATEGY SNAPSHOT

Free version
	•	Purpose: friction + habit reflection.
	•	Block Shorts & heavy search use.
	•	Serve light guilt / reflection overlays.
	•	Keeps users in ecosystem.

Pro version
	•	Purpose: empowerment & insight.
	•	AI-driven reflection (“you could’ve done X instead”).
	•	Customizable rules.
	•	Cloud sync, analytics, counters, and smart reminders.

Conversion driver:
Free feels restrictive but helpful → Pro unlocks freedom + intelligence.

⸻

🧭 MVP FOCUS
	1.	Reliable tracking & blocking. (No visual bugs, works across tabs.)
	2.	Backend link for auth, plan, and data persistence.
	3.	AI insight prompts — simple OpenAI call with habit reflection.
	4.	Stripe payments + plan update.
	5.	Analytics log (for user + internal metrics).

That’s a shippable MVP.