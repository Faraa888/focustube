Features to add:
High Prio:




Other FA Ideas:
- Feature for Dev and Pro / Free Toggle
- Have an overlay after the free mode shorts happens which says XYZ
- Pro mode shorts - have a counter in the corner showing exactly how many shorts theyve watched and how long / some message + button to insta block for day (non-reversible) 




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