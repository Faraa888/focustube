# FocusTube Copy Overview

Complete copy reference for all frontend pages and extension overlays.
Edit this file first, then apply changes to the codebase.

**Rules for Cursor:**
- All trial references = 30 days. Never 14.
- No emojis anywhere in UI copy.
- No fake social proof stats.
- Brand name = FocusTube (one word, capital F, capital T).
- Dynamic variables use `${variable}` syntax — preserve exactly.
- Button loading states must match their default label (e.g. "Sign In" -> "Signing in...").

---

## PART 1: EXTENSION POPUP
**Files:** `extension/popup.html`, `extension/popup.js`

### Header
- **Title:** `FocusTube`
- **Subtitle (dynamic):**
  - Default: `Connect your account`
  - Onboarding view: `Get started`
  - Login view: `Sign in`
  - Status view: `Account`

### Onboarding View (shown when no account connected)
- **Welcome text:** `Welcome to FocusTube. Start with full access — no card required. Try Pro free for 30 days. No pressure. Just focus.`
- **Feature grid items:**
  - `AI Filtering`
  - `Channel Blocking`
  - `30-Day Free Trial`
  - `Insight Dashboard`
  - `Custom Focus Goals`
  - `Time Limits`
  - `Shorts Control`
  - `Focus Window`
  - `Private Journal`
- **Buttons:**
  - `Start 30-Day Trial`
  - `Sign In`
  - `Continue with Free`

### Login Form
- **Label:** `Email address`
- **Input placeholder:** `you@example.com`
- **Button:** `Connect Account`
- **Button loading state:** `Connecting...`
- **Helper text:** `Don't have an account? Sign up` (links to signup page)
- **Back button:** `Back`

### Status View (logged in)
- **Status indicator:** checkmark
- **Email display:** Shows user's email
- **Plan display:** `Plan: ${PLAN}` (values: FREE, PRO, TRIAL)
- **Trial banner (shown when plan = TRIAL):**
  - Title: `Pro trial: ${daysLeft} day(s) left`
  - Subtitle: `Keep AI filtering, channel blocking, and insights by upgrading.`
  - Button: `Upgrade`
- **Button:** `Manage Account`

### Validation and Error Messages
- `Please enter your email address`
- `Please enter a valid email address`
- `Connecting...`
- `Connected! Welcome, ${email}`
- `Cannot connect to server. Please check your internet connection.`
- `Email not found. Please sign up first.`
- `Error opening website. Please visit the website to manage your account.`

---

## PART 2: EXTENSION OVERLAYS
**File:** `extension/content/content.js`

### 1. Shorts Block Overlay (Free plan)
Shown when a Free user visits a Shorts page and Block Shorts toggle is on.
- **Title:** `FocusTube Active`
- **Message:** `Shorts are blocked on the Free plan. Upgrade to Pro to unlock Shorts with smart filters and focus tracking.`
- **Buttons:**
  - `Back to Home`
  - `Upgrade to Pro`

### 2. Onboarding Overlay (first-time users, not signed in)
Shown once when extension is installed and no account is connected.
- **Title:** `Welcome to FocusTube`
- **Intro:** `Sign in to unlock Pro features and take control of your YouTube habits.`
- **Instructions:**
  - Header: `Click the FocusTube icon in your browser toolbar to:`
  - Items:
    - `Start your 30-day free Pro trial`
    - `Sign in to an existing account`
    - `Continue with the Free plan`
- **Button:** `Got it`

### 3. Distracting Content — 10s Nudge
Shown mid-video at 3 distracting videos OR 20 minutes. Video pauses. Auto-dismisses after 10 seconds.
- **Title:** `Still on track?`
- **Message:** `You've watched ${count} distracting videos today.`
- **Countdown:** `${seconds}s`
- **Buttons:**
  - `Continue`
  - `Add Note`

### 4. Distracting Content — 30s Nudge
Shown mid-video at 4 distracting videos OR 40 minutes. Video pauses. Auto-dismisses after 30 seconds.
- **Title:** `Check in with yourself.`
- **Message:** `You've watched ${count} distracting videos today. Is this what you planned to do?`
- **Countdown:** `${seconds}s`
- **Buttons:**
  - `Continue`
  - `Add Note`

### 5. Distracting Content — Hard Block
Shown at 5 distracting videos OR 60 minutes. Full screen. No dismiss. Resets next day.
- **Title:** `YouTube blocked for today.`
- **Message:** `You've hit your focus limit. Come back tomorrow.`
- **Stats:**
  - `Distracting videos today: ${count}`
  - `Time watched today: ${timeText}`
- **Button:** `Check Your Dashboard`

### 6. Daily Time Limit — Hard Block
Shown when daily_time_limit_minutes is reached. Full screen. No dismiss. Resets at midnight.
- **Title:** `Daily limit reached.`
- **Message:** `You've used your ${limitText} YouTube allowance for today. Come back tomorrow.`
- **Stats:**
  - `Time watched today: ${timeText}`
  - `Videos watched: ${videoCount}`
- **Button:** `Check Your Dashboard`

### 7. Focus Window Block
Shown when user visits YouTube outside their defined Focus Window. Full screen. No dismiss.
- **Title:** `Outside your focus window.`
- **Message:** `Your YouTube window is ${startDisplay} to ${endDisplay}.`
- **Note:** No buttons. Hard block until window opens.

### 8. Productive Content — 5s Nudge
Shown after video ends or on navigation at 3 productive videos OR 30 minutes.
- **Title:** `Good progress.`
- **Message:** `You've watched ${count} productive videos. What will you apply?`
- **Countdown:** `${seconds}s`
- **Button:** `Add Note`

### 9. Productive Content — 30s Nudge
Shown after video ends or on navigation at 5 productive videos OR 60 minutes.
- **Title:** `Time to apply what you learned.`
- **Message:** `You've been watching productive content for a while. What's your next action?`
- **Countdown:** `${seconds}s`
- **Buttons:**
  - `Continue`
  - `Add Note`

### 10. Productive Content — 5-Minute Break
Shown after video ends or on navigation at 7 productive videos OR 90 minutes. Non-dismissible until timer expires.
- **Title:** `Take a 5-minute break.`
- **Message:** `You've been learning for a while. Step away, reflect, then come back.`
- **Countdown:** `${minutes}:${seconds}`

### 11. Channel Spiral Nudge — Daily (3 watches)
Shown mid-video after 3 watches of the same channel in a day. Auto-dismisses after 10 seconds.
- **Title:** `You keep coming back.`
- **Message:** `You've watched ${count} videos from ${channel} today.`
- **Countdown:** `${seconds}s`
- **Buttons:**
  - `Continue`
  - `Block Channel`
  - `Add Note`

### 12. Channel Spiral Nudge — Weekly (5+ watches)
Shown mid-video after 5+ watches of the same channel in the last 7 days. Full screen nudge.
- **Title:** `Pattern detected.`
- **Message:** `You've watched ${count} videos from ${channel} in the last 7 days.`
- **Buttons:**
  - `Continue`
  - `Block Channel`
  - `Add Note`

### 13. Channel Block Confirmation
Shown when user clicks Block Channel.
- **Title:** `Block channel?`
- **Message:** `Blocking a distraction is a decision, not a failure.`
- **Confirmation:** `Block "${channelName}"?`
- **Buttons:**
  - `Cancel`
  - `Block Channel`

### 14. Upgrade Prompt (Free users at Pro threshold)
Shown instead of hard block when a Free user hits a Pro-only trigger.
- **Title:** `You've hit a focus limit.`
- **Message:** `Upgrade to Pro to enforce breaks, hard blocks, and daily limits.`
- **Buttons:**
  - `Upgrade to Pro`
  - `Dismiss`

### 15. Journal Entry
Shown when user clicks Add Note from any nudge overlay.
- **Title:** `What pulled you off track?`
- **Subtitle:** `Watching ${videoTitle} from ${videoChannel}.`
- **Textarea placeholder:** `What made you click on this? What were you hoping to find?`
- **Buttons:**
  - `Save`
  - `Dismiss`
- **Close:** `x`

---

## PART 3: FRONTEND PAGES

### PAGE 1: Home
**File:** `frontend/src/pages/Home.tsx`

#### Hero Section
- **Badge:** `Free for 30 days. No card needed.`
- **Headline:** `YouTube without the spiral.`
- **Subheadline:** `FocusTube filters distractions, sets smart limits, and nudges you back to your goals — so you stop spiralling and start doing.`
- **Buttons:**
  - `Start Free Trial`
  - `Install Extension`

#### Problem Statement
- **Headline:** `You don't need more willpower.`
- **Body:** `You've deleted the app. You've blocked Shorts. You've unsubscribed from channels. And yet, you still fall down the rabbit hole. FocusTube helps you break the cycle — with smarter limits and real accountability.`

#### How It Works
- **Section title:** `How it works`
- **Step 1:**
  - Title: `Install`
  - Description: `Add the extension to Chrome in one click. Setup takes 30 seconds.`
- **Step 2:**
  - Title: `Set your goals`
  - Description: `Tell FocusTube what you're working on and what tends to pull you off track.`
- **Step 3:**
  - Title: `Browse with guardrails`
  - Description: `FocusTube tracks your habits, filters distractions, and nudges you back when you drift.`

#### Features
- **Section title:** `What it does`
- **Subtitle:** `Built for people who know better — but still spiral.`
- **Feature cards:**
  - Title: `Distraction Detection` / Description: `AI classifies every video as productive, neutral, or distracting — based on your goals.`
  - Title: `Graduated Nudges` / Description: `Warnings before blocks. You stay in control until the pattern becomes a problem.`
  - Title: `Channel Blocking` / Description: `Block the channels that pull you in. They stay blocked across all your devices.`
  - Title: `Focus Window` / Description: `Set a time window for YouTube. Outside it, the site is blocked.`
  - Title: `Daily Limits` / Description: `Set a daily watch limit. When you hit it, YouTube locks for the rest of the day.`
  - Title: `Usage Insights` / Description: `See your watch patterns, focus score, and distraction trends over time.`
  - Title: `Private Journal` / Description: `Capture what pulled you off track. No AI reads it unless you ask.`
  - Title: `Shorts Control` / Description: `Block Shorts outright or let them feed into your distraction counter.`

#### Closing CTA
- **Title:** `Start watching YouTube intentionally.`
- **Subtitle:** `30 days free. No card required.`
- **Button:** `Start Free Trial`

---

### PAGE 2: Pricing
**File:** `frontend/src/pages/Pricing.tsx`

#### Header
- **Title:** `Simple pricing.`
- **Subtitle:** `Start free. Upgrade when you're ready.`

#### Free Plan
- **Name:** `Free`
- **Price:** `£0`
- **Description:** `The basics, always free.`
- **Features:**
  - `Shorts blocking toggle`
  - `Hide recommendations toggle`
  - `Soft nudges`
  - `Basic extension access`
- **Button:** `Install Extension`

#### Pro Plan
- **Name:** `Pro`
- **Price:** `£4.99 / month`
- **Description:** `For people serious about their focus.`
- **Badge:** `30-day free trial`
- **Features:**
  - `Everything in Free`
  - `AI video classification`
  - `Hard blocks and graduated nudges`
  - `Daily time limit enforcement`
  - `Focus Window`
  - `Channel blocking (synced across devices)`
  - `Usage dashboard`
  - `Private journal`
- **Button:** `Start 30-Day Trial`
- **Note:** `No card required. Cancel anytime.`

#### FAQ
- **Q:** `What happens after the free trial?`
  **A:** `After 30 days, you move to the Free plan automatically. No charge. Upgrade anytime to keep Pro features.`
- **Q:** `Can I switch plans?`
  **A:** `Yes. Upgrade or downgrade at any time.`
- **Q:** `Do you offer refunds?`
  **A:** `Yes. Contact us within 30 days of your first charge and we will sort it.`
- **Q:** `What payment methods do you accept?`
  **A:** `Stripe handles all payments — Visa, Mastercard, Amex. Secure and encrypted.`
- **Q:** `Does my subscription work across devices?`
  **A:** `Yes. Your Pro subscription syncs across all devices where you are signed into Chrome.`

#### Closing CTA
- **Title:** `Questions?`
- **Message:** `We are here to help.`
- **Button:** `Contact Support` (links to `mailto:support@focustube.co.uk`)

---

### PAGE 3: Signup
**File:** `frontend/src/pages/Signup.tsx`

#### Header
- **Title:** `Start your free trial`
- **Subtitle:** `30 days of Pro. No card required.`

#### Form
- **Email label:** `Email address`
- **Email placeholder:** `you@example.com`
- **Password label:** `Password`
- **Password placeholder:** `Choose a password`
- **Button:** `Create Account`
- **Button loading:** `Creating account...`
- **OAuth button:** `Continue with Google`
- **Divider:** `or`
- **Helper:** `Already have an account? Sign in`

#### Errors
- `Please enter your email address`
- `Please enter a valid email address`
- `Password must be at least 8 characters`
- `An account with this email already exists`
- `Something went wrong. Please try again.`

---

### PAGE 4: Login
**File:** `frontend/src/pages/Login.tsx`

#### Header
- **Title:** `Welcome back`
- **Subtitle:** `Sign in to your account`

#### Form
- **Email label:** `Email address`
- **Email placeholder:** `you@example.com`
- **Password label:** `Password`
- **Password placeholder:** `Your password`
- **Button:** `Sign In`
- **Button loading:** `Signing in...`
- **OAuth button:** `Continue with Google`
- **Divider:** `or`
- **Helper:** `Don't have an account? Start your free trial`

#### Errors
- `Please enter your email address`
- `Please enter your password`
- `Incorrect email or password`
- `Something went wrong. Please try again.`

---

### PAGE 5: Goals (Onboarding)
**File:** `frontend/src/pages/Goals.tsx`

#### Header
- **Title:** `Set your focus goals`
- **Subtitle:** `This takes 60 seconds. It helps FocusTube work better for you.`

#### Form Fields
- **Goals label:** `What do you want to use YouTube for?`
- **Goals placeholder:** `e.g. Learn coding, watch business content, study for exams`
- **Goals helper:** `What should YouTube help you with?`
- **Pitfalls label:** `What usually pulls you off track?`
- **Pitfalls placeholder:** `e.g. Gaming videos, reaction content, vlogs`
- **Pitfalls helper:** `Be honest — this is just for you.`
- **Channels label:** `Any channels you want to block? (optional)`
- **Channels placeholder:** `e.g. MrBeast, KSI, Sidemen`
- **Channels helper:** `We will parse these and block them. You can add more later.`

#### Buttons
- **Submit:** `Save and Install FocusTube`
- **Submit loading:** `Saving...`
- **Skip:** `Skip for now`

---

### PAGE 6: Download
**File:** `frontend/src/pages/Download.tsx`

#### Header
- **Badge:** `Free. Takes 30 seconds.`
- **Title:** `Install FocusTube`
- **Subtitle:** `Start using YouTube with intention in under a minute.`

#### Install Card
- **Title:** `Chrome Extension`
- **Description:** `Works on Chrome, Edge, Brave, and other Chromium browsers.`
- **Button:** `Add to Chrome`

#### Setup Steps
- **Title:** `Quick setup (3 steps)`
- **Step 1:**
  - Title: `Install the extension`
  - Description: `Click "Add to Chrome" above, then confirm in the browser popup.`
- **Step 2:**
  - Title: `Set your goals`
  - Description: `Tell FocusTube what you want from YouTube and what usually distracts you. Takes 60 seconds.`
- **Step 3:**
  - Title: `Start browsing YouTube`
  - Description: `FocusTube runs automatically. Visit YouTube and it will start working.`

#### Post-Install Tips
- **Title:** `After installing`
- **Tip 1:** `Pin the extension: Click the puzzle icon in Chrome, find FocusTube, and click the pin icon.`
- **Tip 2:** `Create an account to sync your settings and access the dashboard.`
- **Tip 3:** `Adjust settings anytime by clicking the extension icon.`

#### Next Steps
- **Text:** `Already installed?`
- **Buttons:**
  - `Create Account`
  - `Open Dashboard`

#### Support
- **Text:** `Need help?`
- **Link:** `Contact Support` (links to `mailto:support@focustube.co.uk`)

---

### PAGE 7: Dashboard
**File:** `frontend/src/pages/Dashboard.tsx`

#### Header
- **Title:** `Your Focus Dashboard`
- **Subtitle:** `Here is how your YouTube usage looks.`

#### Time Range Controls
- `Last 7 days`
- `Last 30 days`
- `All time`

#### Metrics
- **Focus Score label:** `Focus Score`
- **Focus Score tooltip:** `Productive time minus distracting time, divided by total time.`
- **Watch time label:** `Watch time by type`
- **Channels label:** `Most watched channels`
- **Themes label:** `Common distraction themes`
- **Peak label:** `Peak distraction times`

#### Free User Placeholder
- **Title:** `Upgrade to see your dashboard`
- **Message:** `Your usage data is being tracked. Upgrade to Pro to see your focus score, watch patterns, and distraction insights.`
- **Button:** `Upgrade to Pro`

#### Empty State
- **Message:** `No data yet. Start watching YouTube and your stats will appear here.`

---

### PAGE 8: Settings
**File:** `frontend/src/pages/Settings.tsx`

#### Header
- **Title:** `Settings`
- **Subtitle:** `Control how FocusTube works for you.`

#### Goals Section
- **Title:** `Your goals`
- **Goals label:** `What do you use YouTube for?`
- **Pitfalls label:** `What usually pulls you off track?`
- **Save button:** `Save Goals`
- **Save loading:** `Saving...`

#### Blocked Channels Section
- **Title:** `Blocked channels`
- **Empty state:** `No channels blocked yet.`
- **Add label:** `Block a channel`
- **Add placeholder:** `Channel name`
- **Add button:** `Block`
- **Remove button:** `Unblock`

#### Toggles Section
- **Title:** `Behaviour settings`
- **Block Shorts label:** `Block Shorts`
- **Block Shorts description:** `Redirect all Shorts to YouTube home.`
- **Hide recommendations label:** `Hide recommendations`
- **Hide recommendations description:** `Remove the recommended video sidebar.`

#### Time Settings Section
- **Title:** `Time limits`
- **Daily limit label:** `Daily watch limit`
- **Daily limit description:** `Hard block YouTube when you hit this limit. 0 = disabled.`
- **Daily limit unit:** `minutes (max 120)`
- **Focus Window label:** `Focus Window`
- **Focus Window description:** `YouTube is blocked outside this window.`
- **Focus Window start label:** `From`
- **Focus Window end label:** `To`
- **Focus Window note:** `Max 6-hour window. Between 08:00 and 22:00 only.`
- **Save button:** `Save Settings`
- **Save loading:** `Saving...`

#### Plan Section
- **Title:** `Your plan`
- **Free label:** `Free plan`
- **Trial label:** `Pro trial — ${daysLeft} day(s) remaining`
- **Pro label:** `Pro`
- **Upgrade button:** `Upgrade to Pro`
- **Upgrade note:** `£4.99 per month. Cancel anytime.`

#### Pro-locked setting message
- **Message:** `This setting is available on Pro.`
- **Button:** `Upgrade to Pro`

---

### PAGE 9: Privacy Policy
**File:** `frontend/src/pages/Privacy.tsx`

- **Title:** `Privacy Policy`
- **Data collection:** `FocusTube collects only what is necessary to help you stay intentional on YouTube. Most data is processed locally. Data is only sent to our servers for features like AI classification.`
- **What we collect:**
  - `Video titles and channel names (for AI classification)`
  - `Time spent watching videos`
  - `Your goals, pitfalls, and settings`
  - `Email address for login and account management`
- **How we use it:** `Your data powers nudges, spiral detection, and distraction tracking. It is never sold or used for ads.`
- **Data security:** `All communication is encrypted over HTTPS. We follow industry-standard security practices.`
- **Your rights:** `You can access, edit, or delete your data at any time. Contact us at support@focustube.co.uk.`
- **Footer:** `Last updated: ${new Date().toLocaleDateString()}`

---

### PAGE 10: Terms of Service
**File:** `frontend/src/pages/Terms.tsx`

- **Title:** `Terms of Service`
- **Acceptance:** `By using FocusTube, you agree to these terms.`
- **Service description:** `FocusTube is a browser extension that helps you use YouTube more intentionally. Some features use AI classification.`
- **User responsibilities:**
  - `You must be at least 13 years old to use FocusTube`
  - `Keep your account credentials secure`
  - `Do not tamper with or reverse engineer the extension`
  - `Use the product ethically`
- **Payments:** `Pro plans are billed monthly through Stripe. Cancel anytime. Refunds available within 30 days of your first charge.`
- **Liability:** `FocusTube is provided as-is. We are not liable for indirect losses or side effects of content blocking.`
- **Changes:** `We may update these terms. Continued use means you accept any updates.`
- **Contact:** `Questions? Email support@focustube.co.uk`
- **Footer:** `Last updated: ${new Date().toLocaleDateString()}`

---

### PAGE 11: 404 Not Found
**File:** `frontend/src/pages/NotFound.tsx`

- **Title:** `404`
- **Message:** `Page not found.`
- **Link:** `Back to Home`

---

## PART 4: SHARED COMPONENTS

### Header
**File:** `frontend/src/components/Header.tsx`

- **Logo:** `FocusTube`
- **Nav links:** `Home`, `Pricing`, `Download`, `Dashboard` (authenticated), `Settings` (authenticated)
- **Auth links:** `Sign In` (unauthenticated), `Sign Out` (authenticated)
- **CTA button (unauthenticated):** `Start Free Trial`
- **Sign out success:** `Signed out successfully.`
- **Sign out error:** `Failed to sign out. Please try again.`

### Footer
**File:** `frontend/src/components/Footer.tsx`

- **Logo:** `FocusTube`
- **Tagline:** `Stop getting lost on YouTube. Focus on what matters.`
- **Product links:** `Download`, `Pricing`
- **Legal links:** `Privacy Policy`, `Terms of Service`
- **Support:** `Questions? Email support@focustube.co.uk`
- **Copyright:** `© ${new Date().getFullYear()} FocusTube. All rights reserved.`

---

## CURSOR INSTRUCTIONS

When applying copy changes from this file:
- Match the exact string shown — do not paraphrase
- Preserve all `${variable}` syntax exactly as written
- Update both default and loading states for buttons
- Do not add emojis to any copy
- Do not add fake stats, ratings, or user counts
- Trial is always 30 days — never 14
- If a section is marked as removed, delete it from the code entirely
