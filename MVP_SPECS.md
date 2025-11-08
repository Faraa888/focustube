# Trial

# **FocusTube Trial Lifecycle Plan (14-Day Flow)**

## **Trial overview**

All new users start with a 14-day free trial of FocusTube Pro (no card required).

During the trial, users have full access to all Pro features — AI filtering, insights dashboard, custom goals, and extended time limits.

The system tracks the number of days since trial_started_at and triggers in-app messages + automated emails at key milestones (Day 5, 7, 10, 13, 14).

If no payment is made by the end of Day 14, the user is automatically downgraded to the Free plan.

---

## **Data setup**

In Supabase:

- plan → “trial” | “pro” | “free”
- trial_started_at (timestamp)
- trial_expires_at (timestamp = trial_started_at + 14 days)
- stripe_customer_id (nullable)
- stripe_subscription_id (nullable)

---

## **Backend logic**

- When a user signs up → plan=“trial”, trial_started_at=now, trial_expires_at=now+14 days
- GET /license/verify → returns { plan, trial_expires_at, days_left }
- Stripe webhook → if payment success, set plan="pro" immediately
- Daily cron job → downgrades any users where plan="trial" and trial_expires_at <= now() to plan="free"
- Optional: email triggers via Postmark/Sendgrid at milestones below

---

## **Frontend + Extension behaviour**

Each time the user opens the dashboard or extension, FocusTube checks /license/verify and determines:

- current plan (trial, pro, free)
- days left in trial (based on trial_expires_at)
- whether to show a milestone message, overlay, or CTA

---

## **14-Day Trial Flow**

### **Day 0: Signup**

- User clicks “Start My Free Trial”
- Authenticates via Google or email
- Redirected to onboarding → set goals & distractions
- Plan set to trial
- Trial banner shown: “You’re on a 14-day FocusTube Pro trial. Experience distraction-free YouTube.”

---

### **Day 5: Engagement Moment**

Trigger type: Overlay in dashboard + optional email

Message:

“We’re starting to see your usage patterns. Curious when you drift most?”

CTA: “See Your Distraction Curve →”

Purpose: subtle mid-trial engagement to get user checking insights early.

---

### **Day 7: Midpoint Reinforcement**

Trigger type: Popup or banner

Message:

“You’re halfway through your Pro trial.

So far you’ve avoided [X] minutes of distraction.

Want to see what else your habits reveal?”

CTA: “Unlock deeper insights →”

Purpose: tie emotional payoff (progress + curiosity) to habit data.

---

### **Day 10: Value Showcase (Soft Sell)**

Trigger type: Dashboard highlight + email summary

Show key stats:

- Total minutes watched
- Distraction risk % (daily + per video)
- Most distracting time of day
- Top aligned vs. misaligned categories
    
    Message:
    
    “You’re starting to see the picture. Keep your focus streak going.”
    
    CTA: “Stay on Pro →”
    
    Purpose: show concrete value before the hard sell.
    

---

### **Day 13: Final Reminder (Urgency)**

Trigger type: Overlay + email

Message:

“Tomorrow, your Pro access ends.

You’ll keep the basics — but lose AI filtering, insights, and goal tracking.”

CTA: “Stay on Pro for £6.99/month →”

Purpose: clear deadline + benefits reminder.

---

### **Day 14: Downgrade (if not upgraded)**

Trigger type: System downgrade + post-downgrade banner

Plan automatically set to “free” via daily cron job.

In-app message:

“Your Pro trial has ended. You’re now on FocusTube Free: core blockers, no insights.”

CTA: “Reactivate Pro anytime →”

Optional feedback prompt: “What made you choose not to upgrade?”

Purpose: clean, respectful off-ramp that leaves the door open.

---

## **Email summary (optional automated sequence)**

- Day 5: light engagement — “Your FocusTube insights are ready.”
- Day 7: progress + curiosity — “You’ve saved X minutes so far.”
- Day 10: value — “Your week of focus in review.”
- Day 13: urgency — “Your trial ends tomorrow.”
- Day 14: downgrade — “Your FocusTube Pro trial has ended.”

---

## **Implementation checklist**

- Add 14-day trial logic (Supabase + backend)
- Add daily cron job for trial expiry
- /license/verify returns days_left and plan
- Add milestone triggers to web dashboard
- Integrate with email service for optional reminders
- Add frontend logic to show banners / overlays per day milestone
- On downgrade, auto-hide Pro features and blur insights
- Keep Stripe CTA consistent everywhere

---

## **Example key copy (for design consistency)**

- “See Your Distraction Curve →”
- “Unlock deeper insights →”
- “Stay on Pro →”
- “Reactivate Pro anytime →”

---

This is now **locked in** as the FocusTube trial lifecycle.

Next, we’ll map the **user flow** (signup → purchase → install → usage → dashboar

# AI feature

## **🔒 AI Classification Plan (MVP)**

### **1️⃣ When it triggers**

- Only after the user watches **≥90 seconds** (or 30 % of the video).
- Skip all Shorts — auto-label **distracting**.
- Run once per video; store result.

---

### **2️⃣ What data it sends**

For each video watched:

- Title
- Description
- Channel name
- 3–5 suggested video titles
- User goals + anti-goals (from onboarding)
- Last 3 labelled videos (to detect drift)

No transcripts or numeric weights yet.

**3️⃣ Prompt structure (v1)**

You are classifying a YouTube video for a focus app.

User goals: [list]
User anti-goals: [list]
Last 3 videos: [title + label each]

Current video:

- Title:
- Description:
- Channel:
- Suggested videos:

Decide if this video is:

- ALIGNED (directly supports a goal)
- BORDERLINE (loosely connected or habit content)
- DISTRACTING (irrelevant or opposite of goals)

Also label:

- topic (main subject)
- intent (educational, entertainment, inspiration, news, opinion, etc.)
- format (tutorial, vlog, review, etc.)
Give a short 20-word reason.

GPT returns:

{
"alignment": "ALIGNED | BORDERLINE | DISTRACTING",
"topic": "...",
"intent": "...",
"format": "...",
"reason": "20-word text"
}

### **4️⃣ Drift rule (behavioural logic)**

- If **2+ of the last 3** were **distracting** → treat current BORDERLINE as **distracting**.
- If **3 BORDERLINE** in a row → treat next BORDERLINE as **distracting**.
    
    Keeps the experience adaptive but simple.
    

---

### **5️⃣ Global channel tagging**

- Once per channel, run a lightweight GPT call:
    
    “What is this channel mainly about?”
    
    → return {theme: "...", tendency: "educational|entertainment|mixed"}.
    
- Store globally (shared for all users).
- Re-use this tag in future classifications to give GPT context, no per-user cost.

---

### **6️⃣ Storage**

- Log only videos watched ≥90 s.
- Save {video_id, alignment, topic, intent, format, reason, watched_seconds, date}.
- Keep 60 days of history; purge older entries.
- Respect privacy (add a clear data disclaimer on site).

# User flow

# **FocusTube MVP Product Flow Document**

## **1. Overview**

FocusTube is a Chrome extension and companion web app that helps users use YouTube intentionally. It detects distraction, tracks viewing behavior, and gives AI-driven insights into focus habits.

The product has three parts:

- **Website (Frontend)** → Built in Lovable, hosted on Vercel → signup, marketing, dashboard, settings
- **Extension** → behavior control, tracking, overlays
- **Backend (Node + Supabase)** → Hosted on Railway/Render → data storage, AI classification, journal synthesis, Stripe integration

---

## **2. Core User Flow**

### **Step 1 — Landing**

User visits **focustube.com**

Sees clear marketing + CTA:

- Primary: “Start 14-Day Free Trial” (no card)
- Secondary: “Buy Pro” (appears after trial expires)

Landing explains:

- Why FocusTube exists
- Free vs Pro features
- Screenshots/video demo
- Link to Pricing / FAQ / Privacy

---

### **Step 2 — Signup**

User creates account:

- Google Auth (preferred; same as YouTube)
- Collect goals and common distractions
- Store in Supabase users table (goals, anti_goals, trial_start, plan=‘trial’)
    
    Redirect → Download page
    

---

### **Step 3 — Download**

Shows “Install the Chrome Extension” → Chrome Web Store link.

After install:

- Onboarding overlay inside extension asks for confirmation of goals (if not already saved).
- Shows “You’re in Pro mode for 14 days” confirmation banner.

---

### **Step 4 — Using FocusTube**

While browsing YouTube:

- Extension tracks watch time, search count, and Shorts usage.
- Sends video metadata to backend for AI classification (“aligned” / “neutral” / “distracting”).
- Blocks or nudges based on plan.
- Optional popup asks: “What pulled you off track?” → user can add journal note (stored in DB).

---

### **Step 5 — Trial Lifecycle**

Day-based sequence:

- Day 5 → soft insight email (“See your distraction curve”)
- Day 7 → reinforce Pro value (“You’ve avoided X mins of distraction”)
- Day 10 → show dashboard highlights (“Keep your focus streak going”)
- Day 13 → urgency reminder
- Day 14 → downgrade to Free + CTA to upgrade

Backend handles:

- trial_start date check
- On day 14 → auto-update plan to “free”
- Stripe checkout → plan=“pro” when paid

---

## **3. Website Pages**

### **Landing / Marketing**

- Clear value prop
- Feature comparison Free vs Pro
- “Start Free Trial” + “Buy Pro”
- Testimonials / FAQs / Privacy

### **Dashboard (Pro only)**

Shows user focus data and AI insights.

**Top Section — Snapshot**

- Focus Score (aligned % today)
- Total Watch Time
- Streak Days Focused
- Time Saved vs Yesterday

**Mid Section — Trends**

- Watch Time (7-day line chart)
- Alignment Breakdown (pie or bar)
- Peak Distraction Hours (bar or heatmap)

**Deep Section — Behavior**

- Top Viewed Channels
- Top Distraction Themes
- Content Split (learning / entertainment)
- Journal summary (AI synthesis when user clicks)

**Footer Insight**

Short motivational insight or suggestion.

---

### **Settings Page**

- Edit goals / distractions
- Toggle features:
    - Shorts blocking (hard / soft / off)
    - Daily limit (60–240 min)
    - Allowed viewing hours
    - Hide homepage / recommendations
    - Nudge tone (gentle / assertive)
- Manage plan (Stripe link)
- Delete journal data

---

### **Journal System**

Captured via extension pop-up → saved in DB → summarised on demand via OpenAI.

**User flow:**

1. Popup asks: “What pulled you off track?”
2. Save to DB with context (video title, URL, source type).
3. User clicks “See your journal” on dashboard → triggers one-time AI synthesis (cached 24h).
4. Summary shows: key triggers, reflection text, and actionable insights.

**Privacy:** single-line consent at first entry + “Delete all journal data” in Settings.

---

## **4. MVP Dashboard Metrics**

**Primary (v1)**

- Total watch time today
- Focus split today (Aligned vs Not aligned %)
- Focus streak (days)
- Time saved vs yesterday

**Trends**

- Watch time last 7 days
- Focus % trend
- Peak distraction hours

**Lists**

- Top distracting channels
- Last 5 journal notes
- Button: “See Your Journal” (runs synthesis)

---

## **5. Extension Integration (MVP Scope)**

- Detect page type (shorts, search, watch, home)
- Block or overlay based on user plan
- Track:
    - Watch seconds
    - Shorts viewed
    - Searches today
    - Channels watched
- Journal: “Add note” button on overlays and badges
- Periodically sync to Supabase (daily aggregate)

---

## **6. Data Summary (Supabase Tables)**

- users → id, email, plan, trial_start, goals[], anti_goals[], stripe_id
- video_sessions → user_id, video_id, title, channel, category, duration, alignment, date, watch_seconds
- journal_entries → user_id, note, context (url, title, source), created_at
- journal_summaries → user_id, summary_text, insights_json, generated_at
- settings → user_id, shorts_block, daily_limit, hours_allowed, tone

---

## **7. Pricing Logic**

| **Plan** | **Price** | **Description** |
| --- | --- | --- |
| Free | £0 | Basic blockers, 60-min limit, no insights |
| Pro | £6.99/mo or £59/yr | Full AI filtering, analytics, journal, limits up to 240min |
| Trial | £0 (14 days) | Temporary Pro access, auto-downgrades after expiry |

## **8. Future Layers (v2+)**

- Accountability partner / leaderboard
- Adaptive goal recommendations
- AI-driven nudges (“Your watch pattern drifts every 9pm – want to auto-block then?”)
- Channel-based focus tagging refinement

# Content Below

# **FocusTube MVP Feature Specification**

## **Core Principles**

- FocusTube reduces “productive distraction” on YouTube.
- Free plan = restrict and nudge.
- Pro plan = awareness, control, and flexibility.
- Everything should feel fast, light, and supportive — not heavy-handed.

---

## **Core Features**

### **1. Shorts Control**

- **Free:** Hard block — any attempt to open /shorts redirects to homepage with overlay “Shorts are blocked to protect your focus.”
- **Pro:** Default allows up to **10 minutes/day**, with reminders at 2, 5, and 10 minutes.
- **Toggle (Pro-only):**
    - Hard block always
    - Allow 10 min/day (default)
    - Allow unlimited (user accepts distraction)

Backend stores usage count; extension enforces blocks.

---

### **2. Recommendations Feed (Sidebar + Homepage)**

- **Free:** Hidden by default (sidebar and homepage feed removed).
- **Pro:** Toggle available (default hidden).
- Optionally, blurred instead of removed (v2 aesthetic mode).

This reduces reactive browsing and keeps focus intentional.

---

### **3. Daily Time Limit**

- **Free:** Fixed 60 minutes/day.
- **Pro:** Default 90 minutes/day, adjustable between 15–150 minutes.
- Optional nudge at 50%, 75%, 90%, 100%.
- After limit reached → soft overlay first (“You’ve hit your focus budget”) then optional hard block.

---

### **4. Intentional Nudges**

- When a “distracting” video (based on AI classifier) starts playing:
    - Soft overlay: “Looks off-focus — still want to continue?”
    - Two buttons: “Continue” / “Refocus”.
- If the user continues multiple times in a row (3+), trigger a stronger nudge.
- Optional tone setting in dashboard: Gentle / Assertive.

Goal is subtle behavioral awareness — not guilt.

---

### **5. Smart Filtering (Free)**

- Basic AI classifier (title + description only).
- Flags “distracting” videos before play.
- No deep context or transcript analysis.
- Used to trigger lightweight reminders, not blocking.

---

### **6. Smart Filtering (Pro)**

- Advanced classifier uses:
    - Video title + description + channel name
    - Channel tag (entertainment/learning/etc)
    - User goals + common pitfalls
- Can apply nudges or pre-play blocks depending on user tolerance settings.
- Adds classification to daily dashboard data.

---

### **7. Searches**

- **Free:** No search limit, but optional nudge after 5 queries in one session.
- **Pro:** Nudge at 10 queries/day: “Still looking, or starting to spiral?”
- Uses same overlay style as Shorts — quick, low friction.

---

### **8. Dashboard (Pro)**

- Accessed via website → shows key metrics:
    - Watch time today + focus score
    - 7-day trend line
    - Peak distraction hours
    - Top distracting channels
    - Last 5 journal entries
    - AI summary of journal (on demand)
- Button: “See your journal” → triggers one OpenAI summary call (cached 24h).

---

### **9. Custom Goals & Pitfalls (Pro)**

- Collected at signup or adjustable later.
- Stored in DB.
- Used for AI classification context (“aligns with user goals”).
- Shown at top of dashboard for awareness.

---

### **10. Subscription Analysis (Pro)**

- Extension fetches user’s subscribed channels (via YouTube DOM scraping).
- Counts total channels and detects categories via global tag DB.
- Insights:
    - “You’re subscribed to 80 channels — 40% are entertainment-heavy.”
    - “Top 3 channels causing distraction: X, Y, Z.”
- Suggestion CTA: “Clean feed” (links to YouTube subscriptions page).

---

### **11. Pop-ups / Overlays**

- Used for:
    - Limit warnings (Shorts, Daily time, Search)
    - Intentional nudges
    - Focus streak messages
    - “Add journal note” prompt
- Types:
    - Soft toast (bottom corner)
    - Medium modal (nudge)
    - Full overlay (hard block or end of limit)

---

### **12. Extension Menu (Mini Icon)**

- Persistent small icon bottom right of YouTube.
- Hover → expands quick panel with:
    - “Open Dashboard” (new tab)
    - “Settings” (new tab)
    - “Block Shorts”
    - “Block YouTube” (hard block toggle)
- Should not block content — smooth hover animation.

---

## **Optional (v2)**

- Blur mode for recommended feed instead of hide.
- “Focus partner” feature (share streaks).
- Advanced journaling (“what emotion triggered this?”).
- AI recommendations: “Try learning-focused content similar to your goals.”


API Contract (MVP)
	•	GET /license/verify → { plan: "trial"|"pro"|"free", days_left?: number }
	•	POST /ai/classify → { title, description, channel, suggestions[], goals[], anti_goals[], recent[] } → { alignment, topic, intent, format, reason }
	•	POST /events/watch → { video_id, title, channel, seconds, started_at, finished_at } → 200
	•	POST /journal → { note, context } → 200
	•	POST /webhook/stripe (Stripe → Supabase plan sync)

Env (server)
	•	OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, CORS_ORIGIN


### Repo Layout

/extension
  manifest.json
  background/
  content/
  lib/ (state.js, rules.js, constants.js)
  styles/overlay.css
/server
  src/index.ts
  src/aiClassify.ts
  src/license.ts
  src/events.ts
  src/journal.ts
  src/stripeWebhook.ts
  src/supabase.ts
  .env.example  tsconfig.json  package.json
/web
  app/ (Next.js or Remix)
  pages: /, /pricing, /dashboard, /settings, /auth/callback
  lib/supabaseClient.ts
/docs
  MVP_SPEC.md
  API.md (optional split from above)