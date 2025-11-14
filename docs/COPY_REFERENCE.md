# FocusTube Copy Reference

Single source of truth for user-facing copy. Update this doc before editing UI text so product, engineering, and copy stay aligned.

---

## 1. Extension Popup (`extension/popup.html` + `extension/popup.js`)

- **Header title / subtitle**
  - `FocusTube`
  - Default subtitle: `Connect your account` (switches to `Get started`, `Sign in`, or `Account` based on view).
- **Onboarding welcome copy**
  - `Welcome to FocusTube! Get started with Pro features or continue with Free.`
  - Feature grid labels: `AI Content Filtering`, `14-Day Free Trial`, `Analytics Dashboard`, `Custom Goals`, `Extended Time Limits`, `Shorts Allowed`, `More Searches`, `Journal System`.
- **Buttons**
  - `Sign up for Pro/Trial`, `Sign in`, `Continue with Free`, `Connect Account`, `Back`, `Manage Account`, `Upgrade`.
- **Login form**
  - Label: `Email address`
  - Placeholder: `you@example.com`
  - Inline reminder: `Don't have an account? Sign up`
- **Status view**
  - Status labels: `Plan: ${PLAN}`, checkmark icon text `✓`.
  - Trial banner: `Pro trial active` / `Pro trial: X days left`, subtitle `Keep AI filtering and insights by upgrading.`
- **Messages surfaced via `showMessage`**
  - Validation: `Please enter your email address`, `Please enter a valid email address`.
  - CTAs: `Connecting...`, success `Connected! Welcome, you@example.com`.
  - Errors: `Cannot connect to server. Please check your internet connection.`, `Email not found in database. Please sign up first.`, `Error opening website. Please visit the website to manage your account.`

---

## 2. Extension Overlays & Nudges (`extension/content/content.js`)

- **Free Shorts block overlay**
  - Title: `FocusTube Active`
  - Body: `Shorts are blocked on the Free plan to help you stay focused. Upgrade to Pro to watch Shorts with smart tracking and controls.`
  - Buttons: `Back to Home Screen`, `Upgrade to Pro`.
- **Onboarding overlay**
  - Title: `🎯 Welcome to FocusTube!`
  - Body: `Get started by connecting your account to unlock Pro features.` plus checklist:
    - `Sign up for Pro/Trial (14-day free trial)`
    - `Sign in if you already have an account`
    - `Continue with Free plan`
  - Buttons: `Got it, I'll click the icon`, `Skip for now`.
- **Pro manual Shorts block**
  - Title: `🎯 Shorts Blocked!`
  - Body: `You have chosen to block Shorts for today and have chosen discipline. This decision will help you stay focused and productive.`
  - Button: `Continue`.
- **Global daily limit overlay**
  - Title: `FocusTube Limit Reached`
  - Body intro: `You've reached your daily limit for YouTube use.`
  - Stats: `Time watched today`, `Shorts viewed`, `Long form videos watched`, `Searches made`.
  - Message bubble: `💬 "<nudge style message>"`.
  - Buttons: `Check Your Usage! 📊`, `Reset`.
- **Focus window overlay**
  - Title: `🕐 You're Outside Your Focus Window`
  - Body: `Your YouTube window is <start–end>` plus style-dependent reminder (see nudge table below). Hard block—no dismiss buttons.
- **Spiral nudge**
  - Title: `⚠️ <nudge style message>`
  - Body: `You've watched N videos from <channel> today/this week.`
  - Buttons: `Continue`, `Block for Today`, `Block Permanently` + 10 second auto-dismiss countdown.
- **Nudge style messages (per `getNudgeMessage`)**
  - `gentle`: Spiral `Still learning?`, Time limit `Take a break?`, Focus window `Maybe step away?`
  - `direct`: Spiral `Check your goals`, Time limit `You're over your limit`, Focus window `Time to focus`
  - `firm`: Spiral `Time's up`, Time limit `Blocked for today`, Focus window `Focus now`
  - Journal prompt (all styles): `What made you click on this? What were you feeling?`

---

## 3. Website – Dashboard (`frontend/src/pages/Dashboard.tsx`)

- Hero: `Your Stats` / `Track your YouTube habits and stay focused`.
- Error card: `Error loading dashboard`, `Retry`.
- Extension warning: `Extension not connected`, `Install and connect the FocusTube extension to see your data`, button `Install Extension`.
- Section headings:
  - `Focus Score` (component), `Watch-Time Map`.
  - `Content Categories` with description `What types of content you've been watching over the last N days`.
  - `Biggest Distractions This Week` with description `Top channels pulling you off-track`, includes `Block` button per channel.
  - `Spiral Detector Feed`, `Most Viewed Channels`, plus badges `productivity`, `neutral`, `distracting` (via components).
- Empty states:
  - Loading copy: `Loading...`, `Loading dashboard data...`.
  - Data window note: `Data covers the last N days (syncing from extension storage).`

---

## 4. Website – Settings (`frontend/src/pages/Settings.tsx`)

- Page title / subtitle: `Your FocusTube` / `Customize FocusTube to match your goals`.
- Tabs: `Goals`, `Blocked Channels`, `Controls`, `Account`.
- Card titles & descriptions:
  - `Your Goals` – `What do you want to learn or accomplish? FocusTube will help you stay on track.`
  - `Common Distractions` – `Topics that tend to pull you off-track.`
  - `Blocked Channels` – `Add channels to your permanent blocklist (normalized automatically).`
  - `Content Filters` – describes toggles such as `Hide Recommendations`, `Block YouTube Shorts`, etc. (labels live in JSX switches).
  - `Time Limits` – slider label `Daily limit (minutes)` plus helper text `Free: 60 min · Pro/Trial: 90 min default`.
  - `Focus Window` – `Choose the window when YouTube is allowed (24h format).`
  - `Nudge Style` – options `Gentle`, `Direct`, `Firm` with helper text `Changes tone of overlays & nudges.`
  - `Subscription` – plan badge uses strings `Free`, `Trial`, `Pro`.
  - `Sign Out` – button `Sign out everywhere` (calls Supabase + extension logout).
- Toast / error snippets users see:
  - Success: `Your goals have been updated.`
  - Errors: `Failed to save goals. Please try again.`, `You must be logged in to block channels`, `Add at least one channel to block.`, `Please enter a channel name`, `This channel is already in your blocklist`, `Failed to save blocked channels. Please try again.`, `Normalization Warning`, `You must be logged in to save settings`.

---

## 5. Website – Goals Signup (`frontend/src/pages/Goals.tsx`)

- Auth guard errors: `You must be logged in to set goals`, `Failed to check authentication. Please try logging in again.`
- Form placeholders: `e.g., Learn React`, `e.g., Gaming streams`, `e.g., MrBeast`.
- Toggles: `Auto-block these channels after signup` (labels inside component).
- Buttons: `Add`, `Save & Continue`, `Save Goals`.
- Error copy: `Maximum 5 items allowed. Remove one to add another.`, `This item is already added.`, `You must be logged in to set goals. Redirecting to login...`.
- Success path: `Channels auto-blocked:` (console) plus toast `Goals saved!`.

---

## 6. Website – Home / Landing (`frontend/src/pages/Home.tsx`)

- Hero badge/title/subtitle: `14-day free trial • No credit card required`, `Use YouTube on purpose.`, `Stop research spirals. FocusTube filters noise, sets limits, and nudges you back to intent.`
- Hero CTAs: `Start 14-Day Free Trial`, `Install Extension` and hero image alt text `FocusTube dashboard showing focus metrics and analytics`.
- Social proof stats: `10,000+ Active users`, `45% Avg. distraction reduction`, `4.8/5 Chrome Store rating`.
- Problem statement: `You don't need more discipline.` / `You need better defaults...`.
- How it works steps: `Install`, `Set goals`, `Browse with guardrails` with corresponding descriptions.
- Feature grid card text: `Blocks Shorts`, `AI Filtering`, `Time Nudges`, `Personal Insights`, `Privacy First`, `Zero Friction` and their descriptions.
- Free vs Pro copy: headings `Free`, `Pro`, badge `Most Popular`, benefits bullets (`Block YouTube Shorts`, `Basic search filtering`, etc.), CTAs `Get Started`, `View Pricing`.
- FAQ questions/answers (How long is the free trial?, Is my data private?, How much does Pro cost?, Can I uninstall anytime?, Does it only work on Chrome?, How does AI filtering work?).
- Final CTA: `Ready to reclaim your focus?`, `FocusTube isn't about blocking everything...`, button `Start 14-Day Free Trial`, footnote `No credit card required • Cancel anytime`.

---

## 7. Website – Pricing (`frontend/src/pages/Pricing.tsx`)

- Page hero: `Simple, transparent pricing`, `Start free, upgrade when you're ready. Cancel anytime.`
- Billing toggle labels: `Monthly`, `Yearly` (`Save 30%` badge).
- Free plan card copy (`Essential tools to get started`, `$0 /forever`, bullets `Block YouTube Shorts`, `Basic search filtering`, `Daily time limit (up to 60min)`, `Basic usage statistics`, CTA `Get Started Free`).
- Pro plan card copy (`Advanced features for serious learners`, `$5`/`$7` per month text, `Billed $60/year`, bullets `Everything in Free, plus: AI-powered content filtering, Unlimited daily time limits, Advanced dashboard & insights, Custom focus goals & tracking, Distraction heatmaps, Priority email support`, CTA `Start 14-Day Free Trial`, badge `Most Popular`, footnote `No credit card required`).
- Trust badges: `Privacy-first`, `Cancel anytime`, `30-day money back`.
- Pricing FAQ questions (`What happens after the free trial?`, `Can I switch between plans?`, `Do you offer refunds?`, `Is there a student discount?`, `What payment methods do you accept?`, `Can I use one subscription on multiple devices?`) with their answers.
- Closing CTA: `Still have questions?`, `We're here to help. Reach out anytime.`, button `Contact Support`.

---

## 8. Website – Download (`frontend/src/pages/Download.tsx`)

- Hero copy: `Free • Takes 30 seconds`, `Install FocusTube`, `Start using YouTube with intention in under a minute`.
- Main install card: `Chrome Extension`, `Works on Chrome, Edge, Brave, and other Chromium browsers`, button `Add to Chrome — It's Free`, rating note `⭐️ Rated 4.8/5 by 10,000+ users`.
- Setup steps headings: `Quick Setup (3 steps)`, individual steps `Install the extension`, `Set your goals`, `Start browsing YouTube` with descriptive sentences.
- Post-install tips: `Pin the extension`, `Create an account`, `Customize`.
- Next steps CTA: `Already installed the extension?`, buttons `Create Account`, `Open Dashboard`.
- Support footer: `Need help installing? Contact Support`.

---

## 9. Website – Auth Pages (`frontend/src/pages/Login.tsx`, `frontend/src/pages/Signup.tsx`)

- Shared branding: link text `FocusTube`, headings `Welcome back`, `Create your account`, subtitles `Sign in to access your dashboard`, `Start your 14-day free trial`.
- Login form labels/buttons: `Email`, `Password`, `Forgot?`, `Sign in`, state text `Signing in...`, footer `Don't have an account? Sign up`.
- Login errors: `Failed to login with Google. Please try again.`, `Something went wrong. Please try again.`
- Signup form labels/buttons: `Full name`, `Email`, `Password`, placeholder `At least 8 characters`, button `Start free trial` / `Creating account...`.
- Signup alerts: `Check your email`, `We've sent a confirmation link to <email>. Click it to verify your account, then come back to sign in.`, button `Already verified? Sign in`.
- Signup legal note: `By signing up, you agree to our Terms and Privacy Policy.`
- Footers: `Already have an account? Sign in`.
- OAuth placeholders (currently commented) include button text `Continue with Google` and separator label `Or continue with email`.

---

## 10. Website – Legal & Utility Pages

- **Privacy Policy (`frontend/src/pages/Privacy.tsx`)**
  - Headings: `Privacy Policy`, `Data Collection`, `What We Collect`, `How We Use Your Data`, `Data Security`, `Your Rights`.
  - Body text includes sentences `FocusTube collects minimal data...`, bullet list items (`Video titles and search queries`, `Time spent watching videos`, etc.), contact email `privacy@focustube.app`, footer `Last updated: <date>`.
- **Terms of Service (`frontend/src/pages/Terms.tsx`)**
  - Headings: `Terms of Service`, `Acceptance of Terms`, `Service Description`, `User Responsibilities`, `Subscription and Payments`, `Limitation of Liability`, `Changes to Terms`, `Contact`.
  - Body copy includes sentences `By using FocusTube, you agree...`, `FocusTube is a Chrome extension...`, bullet list of responsibilities, contact email `legal@focustube.app`, footer `Last updated: <date>`.
- **NotFound (`frontend/src/pages/NotFound.tsx`)**
  - Text: `404`, `Oops! Page not found`, link `Return to Home`.
- **Index fallback (`frontend/src/pages/Index.tsx`)**
  - Text: `Welcome to Your Blank App`, `Start building your amazing project here!`

---

## 11. Shared Website Components

- **Header (`frontend/src/components/Header.tsx`)**
  - Nav items: `Home`, `Pricing`, `Download`, `Dashboard`, `Settings`, `Login`.
  - Buttons: `Start Free Trial`, `Sign Out`, `Start Free Trial` (mobile), sheet menu entries mirror nav text.
  - Toast text: `Logged out`, `You have been successfully logged out.`, error toasts `Failed to log out. Please try again.`, `Something went wrong. Please try again.`
- **Footer (`frontend/src/components/Footer.tsx`)**
  - Mission blurb: `Stop getting lost in "useful" YouTube. Focus on what matters.`
  - Section headers `Product`, `Legal`, `Support`, link labels `Download`, `Pricing`, `Privacy Policy`, `Terms of Service`, email `support@focustube.app`.
  - Footer line: `© <year> FocusTube. All rights reserved.`
- **FeatureCard (`frontend/src/components/FeatureCard.tsx`)**
  - Template uses dynamic `title` / `description`. Any new title/description combos should be mirrored in this doc under their originating page.

---

## 12. Additional Extension Surfaces

- Manual block confirmation dialog (`showManualBlockConfirmation`): includes text `Block this channel?`, buttons `Block permanently`, `Block for today`, `Cancel`, warning copy `You'll always be redirected away from this channel on YouTube.` (add/update if copy changes).
- Storage/onboarding notices triggered via console alerts should be mirrored here when promoted to user-facing UI.

---

### How to update
1. Edit the relevant string in code.
2. Update this file with the new copy and file reference.
3. Call out changes in PRs to keep design/product aligned.

