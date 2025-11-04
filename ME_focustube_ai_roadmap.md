# 🤖 FocusTube — AI Roadmap & UX Integration

## 🧩 AI Vision
FocusTube’s AI exists to **turn self-awareness into self-control** — transforming raw engagement data into reflections and nudges that help users act intentionally.

---

## 🧱 1. MVP (Current Phase)
**Goal:** Deliver baseline intelligence for content classification and behavioral tracking.

### Features
- Classify search queries + video titles using OpenAI (GPT-4)
- Label: `Learning`, `Inspiring`, `Distracting`, `Neutral`
- Rules-based thresholds (e.g., 5 “distracting” videos/day)
- Overlay reflections (“You’ve spent 10 min on tutorials — time to build?”)

### Tech
- `/ai/classify` endpoint (Express)
- OpenAI API (gpt-4-mini or gpt-4-turbo)
- Supabase storage for logs
- No auth required for MVP testing

---

## 🧠 2. Smart Nudges (Next Phase)
**Goal:** Introduce adaptive awareness with AI-driven context detection.

### Features
- Nudges based on intent drift: “You’ve watched 3 videos on this topic — ready to start building?”
- Real-time insights from watching patterns (topic repetition, binge detection)
- Personalized thresholds (learn from user data)

### Tech
- AI prompt chaining (e.g. classify → summarize → nudge)
- Supabase Edge Function (serverless)
- Secure API auth via Supabase JWT

---

## 🧭 3. Adaptive Personalization
**Goal:** Create a personal AI profile for each user.

### Features
- Learns preferred topics and identifies “productive” vs “distracting” for each user
- Weekly reflections: “You learn fastest from coding tutorials but lose focus on lifestyle videos.”
- Fine-tunes tone and nudge strength over time

### Tech
- Supabase RLS tables per user
- OpenAI fine-tuning (if needed)
- Optional embeddings for topic grouping

---

## 📊 4. Reflection & Reporting Layer
**Goal:** Turn daily data into insight and motivation.

### Features
- Daily “Focus Report” overlay or email
- Shows time spent, topics explored, missed goals
- Suggests next steps: “You spent 20 min learning Python — here’s a 1-hour project idea.”

### Tech
- Scheduled function or CRON
- Email (Resend / Supabase Functions)
- AI summary generation

---

## 🌍 5. Cross-Platform Intent Engine
**Goal:** Extend beyond YouTube to full digital awareness.

### Vision
- Detect intent across all browser tabs or OS apps
- Surface AI reflections wherever you drift (Twitter, Reddit, etc.)
- Optional phone integration for holistic focus insights

### Tech
- Native app integration (later phase)
- Browser-wide service worker hooks
- Shared Supabase profile across devices

---

## 💡 Guiding Principle
> The AI should feel like **a mirror, not a wall.**
Its job is to help users *see* their patterns, not punish them.