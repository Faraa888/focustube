# FocusTube Copy Overview v3
**Focus:** Pain → Solution → Conversion  
**Landing page tone:** Clear, direct, conversion-focused  
**Extension tone:** Accountability through questions, not commands

**Rules:**
- Every line earns its place — cut fluff
- Trial = 30 days, always
- No emojis
- Brand = FocusTube (one word, F and T capitalised)
- Extension copy asks questions, doesn't lecture

---

## PART 1: LANDING PAGE (Home.tsx)

### Hero Section
- **Badge:** `Try free for 30 days. No card.`
- **Headline:** `You don't lack willpower. You lack guardrails.`
- **Subheadline:** `FocusTube adds friction where you spiral and clarity when you drift — so YouTube stops wasting your time.`
- **Primary CTA:** `Start Free Trial`
- **Secondary CTA:** `See How It Works`

### Problem Section
- **Headline:** `You've tried everything.`
- **Body:** `Deleted the app. Blocked Shorts. Unsubscribed. Logged out. And yet — 40 minutes gone on a Tuesday night watching something you didn't plan to watch. The problem isn't you. It's that YouTube is built to pull you in. FocusTube adds the friction YouTube won't.`

### How It Works
- **Headline:** `Three steps. One minute.`
- **Step 1 Title:** `Install the extension`
- **Step 1 Body:** `One click. Works on Chrome, Edge, Brave.`
- **Step 2 Title:** `Set your focus goals`
- **Step 2 Body:** `Tell FocusTube what you're working on and what pulls you off track. Takes 30 seconds.`
- **Step 3 Title:** `Browse with limits`
- **Step 3 Body:** `FocusTube tracks patterns, blocks distractions, and nudges you back when you drift.`

### What It Does
- **Headline:** `Smart limits. Not blanket blocks.`
- **Subheadline:** `You stay in control until the pattern becomes a problem.`

**Feature 1:**
- Title: `AI filters every video`
- Body: `Classifies content as productive, neutral, or distracting based on your goals. No guessing.`

**Feature 2:**
- Title: `Graduated nudges`
- Body: `Gentle warnings before hard blocks. You get 3 chances before YouTube locks for the day.`

**Feature 3:**
- Title: `Block channels permanently`
- Body: `One click to block the channels that always pull you in. Syncs across devices.`

**Feature 4:**
- Title: `Set a focus window`
- Body: `YouTube only opens during hours you choose. Outside that window — blocked.`

**Feature 5:**
- Title: `Daily time limit`
- Body: `Set your max watch time. When you hit it, YouTube locks until tomorrow.`

**Feature 6:**
- Title: `Track your patterns`
- Body: `See your watch time, distraction trends, and focus score over time.`

**Feature 7:**
- Title: `Private journal`
- Body: `Note what pulled you off track. No AI reads it unless you ask.`

**Feature 8:**
- Title: `Control Shorts`
- Body: `Block them outright or count them toward your daily distraction limit.`

### Final CTA
- **Headline:** `Stop spiralling. Start shipping.`
- **Subheadline:** `30 days free. No card required. Cancel anytime.`
- **Button:** `Start Free Trial`

---

## PART 2: PRICING PAGE (Pricing.tsx)

### Header
- **Headline:** `One plan. Simple pricing.`
- **Subheadline:** `Try Pro free for 30 days. Downgrade anytime.`

### Free Plan Card
- **Name:** `Free`
- **Price:** `£0 / month`
- **Tagline:** `The basics.`
- **Features:**
  - `Block Shorts toggle`
  - `Hide recommendations`
  - `Soft nudges`
- **Button:** `Get Started`

### Pro Plan Card
- **Name:** `Pro`
- **Price:** `£4.99 / month`
- **Badge:** `30-day free trial`
- **Tagline:** `For people serious about focus.`
- **Features:**
  - `Everything in Free, plus:`
  - `AI video classification`
  - `Hard blocks after 3 warnings`
  - `Daily time limit`
  - `Focus Window`
  - `Block channels (synced)`
  - `Usage dashboard`
  - `Private journal`
- **Button:** `Start Free Trial`
- **Note:** `No card required.`

### FAQ
**Q:** `What happens after 30 days?`  
**A:** `You downgrade to Free automatically. No charge. Upgrade anytime.`

**Q:** `Can I cancel?`  
**A:** `Yes. Cancel anytime from settings.`

**Q:** `Do you offer refunds?`  
**A:** `Yes. Email us within 30 days of your first charge.`

**Q:** `What payment methods?`  
**A:** `Visa, Mastercard, Amex via Stripe.`

**Q:** `Does it work on mobile or Safari?`  
**A:** `Not yet. Chrome desktop only. Mobile and Safari are planned.`

**Q:** `Does my subscription sync across devices?`  
**A:** `Yes. Sign in on any Chrome device and your Pro features follow.`

### Support CTA
- **Text:** `Questions?`
- **Link:** `Email support@focustube.co.uk`

---

## PART 3: EXTENSION OVERLAYS

### Principle
Extension copy is **accountability-focused**. Ask questions, don't command. Make the user aware, don't lecture them.

---

### 1. Distracting Nudge — 10s (3 videos / 20 min)
Video pauses. Timer counts down from 10. Auto-dismisses.

- **Headline:** `Still on track?`
- **Body:** `You've watched ${count} distracting videos today.`
- **Timer:** `${seconds}s`
- **Buttons:** `Continue` / `Add Note`

---

### 2. Distracting Nudge — 30s (4 videos / 40 min)
Video pauses. Timer counts down from 30. Auto-dismisses.

- **Headline:** `Is this what you planned to do?`
- **Body:** `You've watched ${count} distracting videos. One more and YouTube locks for the day.`
- **Timer:** `${seconds}s`
- **Buttons:** `Continue` / `Add Note`

---

### 3. Hard Block (5 videos / 60 min)
Full screen. No dismiss. Resets tomorrow.

- **Headline:** `YouTube is locked for today.`
- **Body:** `You hit your limit. Use the time on something that moves you forward.`
- **Stats:**
  - `${count} distracting videos today`
  - `${timeText} watched`
- **Button:** `View Dashboard`

---

### 4. Daily Time Limit Block
Full screen. No dismiss. Resets at midnight.

- **Headline:** `Daily limit reached.`
- **Body:** `You've used your ${limitText}. Tomorrow is a fresh start.`
- **Stats:**
  - `Time watched: ${timeText}`
  - `Videos watched: ${count}`
- **Button:** `View Dashboard`

---

### 5. Focus Window Block
Full screen. No dismiss. Shows when YouTube accessible again.

- **Headline:** `Outside your focus window.`
- **Body:** `YouTube opens again at ${endTime}.`
- **No buttons**

---

### 6. Productive Nudge — 5s (3 videos / 30 min)
Appears after video ends. Auto-dismisses after 5s.

- **Headline:** `What will you apply?`
- **Body:** `You've watched ${count} productive videos. Time to use what you learned.`
- **Timer:** `${seconds}s`
- **Button:** `Add Note`

---

### 7. Productive Nudge — 30s (5 videos / 60 min)
Appears after video ends. Auto-dismisses after 30s.

- **Headline:** `Time to build something.`
- **Body:** `You've been learning for a while. What's your next action?`
- **Timer:** `${seconds}s`
- **Buttons:** `Continue` / `Add Note`

---

### 8. Productive Break (7 videos / 90 min)
Full screen. Non-dismissible. 5-minute timer.

- **Headline:** `Take 5 minutes.`
- **Body:** `You've been watching for ${timeText}. Step away. Reflect. Then come back.`
- **Timer:** `${minutes}:${seconds}`
- **No buttons until timer ends**

---

### 9. Channel Spiral — Daily (3 watches same channel)
Video pauses. Auto-dismisses after 10s.

- **Headline:** `You keep coming back here.`
- **Body:** `${count} videos from ${channel} today. Still intentional?`
- **Timer:** `${seconds}s`
- **Buttons:** `Continue` / `Block Channel` / `Add Note`

---

### 10. Channel Spiral — Weekly (5+ watches same channel)
Full screen. Requires action.

- **Headline:** `Pattern detected.`
- **Body:** `${count} videos from ${channel} this week. Is this aligned with your goals?`
- **Buttons:** `Continue` / `Block Channel` / `Add Note`

---

### 11. Block Channel Confirmation
Appears when user clicks Block Channel.

- **Headline:** `Block ${channelName}?`
- **Body:** `Blocking a distraction is discipline, not failure.`
- **Buttons:** `Cancel` / `Block Channel`

---

### 12. Shorts Block (Free plan, toggle on)
Full screen redirect.

- **Headline:** `Shorts blocked.`
- **Body:** `Upgrade to Pro to track Shorts as part of your focus limits instead.`
- **Buttons:** `Back to Home` / `Upgrade to Pro`

---

### 13. Search Warning Banner (Free: 3-4 searches, Pro: 13-14 searches)
Small banner near search bar. Auto-dismisses after 5s.

Free:
- Search 3: `2 searches left today.`
- Search 4: `1 search left today.`

Pro:
- Search 13: `2 searches left today.`
- Search 14: `1 search left today.`

---

### 14. Search Block
Redirect to YouTube home.

Free:
- **Headline:** `Search limit reached.`
- **Body:** `You've used all 5 searches today. Upgrade to Pro for 15 daily searches.`
- **Button:** `Upgrade to Pro`

Pro:
- **Headline:** `Search limit reached.`
- **Body:** `You've used all 15 searches today. Tomorrow resets.`
- **No button — just redirect**

---

### 15. Upgrade Prompt (Free user hits Pro threshold)
Full screen. Shown instead of hard block.

- **Headline:** `You've hit a Pro limit.`
- **Body:** `Upgrade to enforce blocks, set time limits, and track your patterns.`
- **Buttons:** `Upgrade to Pro` / `Dismiss`

---

### 16. Journal Entry
Appears when user clicks Add Note.

- **Headline:** `What pulled you off track?`
- **Context:** `Watching: ${videoTitle} from ${channel}`
- **Textarea placeholder:** `What made you click? What were you hoping to find?`
- **Buttons:** `Save` / `Dismiss`
- **Close:** `×`

---

## PART 4: EXTENSION POPUP

### Logged Out / Onboarding View
- **Welcome:** `Start with full access. Try Pro free for 30 days. No card required.`
- **Feature grid:** (icons only, no text in grid)
  - AI Filtering
  - Channel Blocking
  - 30-Day Trial
  - Dashboard
  - Focus Goals
  - Time Limits
  - Shorts Control
  - Focus Window
  - Journal
- **Buttons:** `Start Trial` / `Sign In` / `Continue Free`

### Logged In View
- **Status:** Checkmark + email
- **Plan:** `Plan: ${PLAN}`
- **Trial banner (if trial):** `${daysLeft} days left in trial. Upgrade to keep Pro features.`
- **Button:** `Manage Account`

### Validation Messages
- `Enter your email address`
- `Enter a valid email`
- `Connecting...`
- `Connected.`
- `Cannot connect. Check your internet.`
- `Email not found. Sign up first.`

---

## PART 5: ONBOARDING (Goals.tsx)

### Header
- **Headline:** `What do you want from YouTube?`
- **Subheadline:** `This takes 60 seconds. Helps FocusTube work better.`

### Form
- **Goals label:** `What should YouTube help you with?`
- **Goals placeholder:** `e.g. Learn coding, study for exams, watch business content`
- **Pitfalls label:** `What usually pulls you off track?`
- **Pitfalls placeholder:** `e.g. Gaming videos, reaction content, vlogs`
- **Pitfalls helper:** `Be honest — this is just for you.`
- **Channels label:** `Channels to block? (optional)`
- **Channels placeholder:** `e.g. MrBeast, KSI, Sidemen`
- **Channels helper:** `You can add more later.`

### Buttons
- **Submit:** `Save Goals`
- **Loading:** `Saving...`
- **Skip:** `Skip for now`

---

## PART 6: SIGNUP & LOGIN

### Signup (Signup.tsx)
- **Headline:** `Start your free trial`
- **Subheadline:** `30 days of Pro. No card required.`
- **Email label:** `Email`
- **Email placeholder:** `you@example.com`
- **Password label:** `Password`
- **Password placeholder:** `Choose a password`
- **Button:** `Create Account`
- **Loading:** `Creating account...`
- **OAuth:** `Continue with Google`
- **Divider:** `or`
- **Helper:** `Already have an account? Sign in`

### Login (Login.tsx)
- **Headline:** `Welcome back`
- **Subheadline:** `Sign in to continue`
- **Email label:** `Email`
- **Email placeholder:** `you@example.com`
- **Password label:** `Password`
- **Password placeholder:** `Your password`
- **Button:** `Sign In`
- **Loading:** `Signing in...`
- **OAuth:** `Continue with Google`
- **Divider:** `or`
- **Helper:** `Don't have an account? Start free trial`

---

## PART 7: SETTINGS (Settings.tsx)

### Goals Section
- **Headline:** `Your goals`
- **Goals label:** `What do you use YouTube for?`
- **Pitfalls label:** `What pulls you off track?`
- **Button:** `Save Goals`
- **Loading:** `Saving...`

### Blocked Channels
- **Headline:** `Blocked channels`
- **Empty:** `No channels blocked yet.`
- **Add placeholder:** `Channel name`
- **Add button:** `Block`
- **Remove button:** `Unblock`

### Toggles
- **Headline:** `Behaviour`
- **Block Shorts:** `Block Shorts` / `Redirect all Shorts to home.`
- **Hide recs:** `Hide recommendations` / `Remove sidebar suggestions.`

### Time Limits
- **Headline:** `Time limits`
- **Daily limit:** `Daily watch limit` / `Hard block when reached. 0 = disabled.` / `minutes (max 120)`
- **Focus Window:** `Focus Window` / `YouTube blocked outside this window.`
- **Window start:** `From`
- **Window end:** `To`
- **Window note:** `Max 6 hours. Between 08:00 and 22:00 only.`
- **Button:** `Save Settings`
- **Loading:** `Saving...`

### Plan
- **Headline:** `Your plan`
- **Free:** `Free plan`
- **Trial:** `Pro trial — ${daysLeft} days left`
- **Pro:** `Pro`
- **Upgrade button:** `Upgrade to Pro`
- **Note:** `£4.99/month. Cancel anytime.`

### Pro-Locked Setting
- **Message:** `Available on Pro.`
- **Button:** `Upgrade to Pro`

---

## PART 8: DOWNLOAD PAGE (Download.tsx)

### Header
- **Badge:** `Takes 30 seconds.`
- **Headline:** `Install FocusTube`
- **Subheadline:** `Start using YouTube with intention in under a minute.`

### Install Card
- **Headline:** `Chrome Extension`
- **Body:** `Works on Chrome, Edge, Brave, and other Chromium browsers.`
- **Button:** `Add to Chrome`

### Setup
- **Headline:** `3 steps`
- **Step 1:** `Install` / `Click Add to Chrome, then confirm.`
- **Step 2:** `Set goals` / `Tell FocusTube what you want from YouTube. 60 seconds.`
- **Step 3:** `Browse` / `FocusTube runs automatically. Visit YouTube.`

### Tips
- **Headline:** `After installing`
- **Tip 1:** `Pin the extension: Click the puzzle icon, find FocusTube, pin it.`
- **Tip 2:** `Create account to sync settings and access dashboard.`
- **Tip 3:** `Adjust settings anytime via extension icon.`

### Next
- **Text:** `Already installed?`
- **Buttons:** `Create Account` / `Dashboard`

### Support
- **Text:** `Need help?`
- **Link:** `support@focustube.co.uk`

---

## PART 9: PRIVACY POLICY (Privacy.tsx)

### Header
- **Headline:** `Privacy Policy`

### What We Collect
- Video titles and channel names (for AI classification)
- Time spent watching
- Your goals, pitfalls, and settings
- Email for login

### How We Use It
Your data powers nudges, spiral detection, and distraction tracking. Never sold. Never used for ads.

### Data Security
All communication encrypted over HTTPS. Industry-standard security.

### Your Rights
Access, edit, or delete your data anytime. Email support@focustube.co.uk.

### Data Retention
Watch history: 60 days. Account data: until deletion.

### Sub-processors
We use Supabase (database), OpenAI (AI classification), Render (hosting), and Stripe (payments).

### Legal Basis (GDPR)
We process your data under legitimate interest to provide the service you signed up for.

### Right to Erasure
Email support@focustube.co.uk to delete your account and all data.

### Footer
Last updated: ${date}

---

## PART 10: TERMS OF SERVICE (Terms.tsx)

### Header
- **Headline:** `Terms of Service`

### Acceptance
By using FocusTube, you agree to these terms.

### Service Description
FocusTube is a Chrome extension that helps you use YouTube intentionally. Some features use AI.

### User Responsibilities
- Must be 13+ to use FocusTube
- Keep credentials secure
- Do not reverse engineer
- Use ethically

### Payments
Pro plans billed monthly via Stripe. Cancel anytime. Refunds within 30 days of first charge.

### Liability
FocusTube provided as-is. Not liable for indirect losses.

### Changes
We may update terms. Continued use = acceptance.

### Contact
support@focustube.co.uk

### Footer
Last updated: ${date}

---

## CURSOR INSTRUCTIONS

When applying copy from this file:
- Match strings exactly
- Preserve ${variable} syntax
- Trial = 30 days always
- No emojis
- Extension copy = questions, not commands
- Landing page copy = pain → solution → action
