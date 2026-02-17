# FocusTube — Transfers Context Document
**Version:** v2 (MVP)

---

## What This Product Is

FocusTube is a Chrome extension plus web app that helps users use YouTube intentionally. It adds friction, awareness, and limits at the right moments. It does not replace YouTube.

The core audience is wantrepreneurs and builders who use YouTube for learning but repeatedly fall into distraction loops despite good intentions.

---

## Core Philosophy

- Users define goals and common distractions (called pitfalls)
- Every video is classified as productive, neutral, or distracting
- Interventions are pattern-based, not single-video based
- Nudge first, block second
- Never punish without warning
- Users are adults — the product builds awareness, not a cage

---

## What the Product Does (Mental Model)

The extension watches what a user does on YouTube and maintains counters. When counter thresholds are reached, it intervenes — first with a nudge overlay, then with a harder block. The user can always see what's happening. The product never acts silently.

---

## MVP Constraints

The MVP is not trying to be perfect. It is trying to be:

- Usable enough to prove the concept
- Reliable enough to trust daily
- Good enough to charge £4.99/month for

AI classification accuracy is "good enough", not perfect. The intervention logic matters more than the classification precision.

---

## Engineering Posture

- Simple logic over clever logic
- Server state always wins over local state
- Local extension storage is cache only — never authoritative
- Degrade gracefully on any failure — never break user flow
- Do not add features not in the spec

---

## Field Names Are Locked

These are the exact field names used across all layers. No aliases, no synonyms.

| Concept | Field name |
|---|---|
| User distractions | `pitfalls` |
| Trial start | `trial_started_at` |
| Trial expiry | `trial_expires_at` |
| Focus window start | `focus_window_start` |
| Focus window end | `focus_window_end` |
| Daily watch limit | `daily_time_limit_minutes` |
| Plan value (trial) | `pro_trial` |
| Plan value (paid) | `pro` |
| Plan value (free) | `free` |

---

## What Is Out of Scope for MVP

- Safari extension
- Mobile apps
- Native desktop apps
- Transcript-based analysis
- Real-time dashboard updates
- Social accountability features
- WebSockets or real-time sync
- Perfect AI accuracy
- Gamification
- Mid-feed Shorts blocking (intercept individual Shorts in the feed before they play)
