# FocusTube Copy Overview

Complete copy reference for all frontend pages and extension popups. Edit this document first, then we'll apply changes to the codebase.

---

## PART 1: EXTENSION POPUP
**File:** `extension/popup.html` + `extension/popup.js`

### Header
- **Title:** `FocusTube`
- **Subtitle (dynamic):**
  - Default: `Connect your account`
  - Onboarding view: `Get started`
  - Login view: `Sign in`
  - Status view: `Account`

### Onboarding View (shown when no email)
- **Welcome text:** `Welcome to FocusTube. Start with full access — no card required. Try the Pro features for 14 days. No pressure. Just focus.`
- **Feature grid items:**
  - `Smart AI Filtering`
  - `Targetted Channel Blocking`
  - `14-Day Free Trial`
  - `Insight Dashboard`
  - `Custom Focus Goals`
  - `Flexible Time Limits`
  - `Stronger Shorts & Feed Control`
  - `More Searches`
  - `Private Journal System`
- **Buttons:**
  - `Start 14- Day Trial`
  - `Sign in`
  - `Continue with Free`

### Login Form
- **Label:** `Email address`
- **Input placeholder:** `you@example.com`
- **Button:** `Connect Account`
- **Helper text:** `Don't have an account? Sign up` (links to signup page)
- **Back button:** `Back`

### Status View (logged in)
- **Status icon:** `✓` (checkmark)
- **Email display:** Shows user's email
- **Plan display:** `Plan: ${PLAN}` (e.g., "Plan: FREE", "Plan: PRO", "Plan: TRIAL")
- **Trial banner (if on trial):**
  - Title: `Pro trial: X day(s) left`
  - Subtitle: `Keep AI filtering, channel blocking and insights by upgrading.`
  - Button: `Upgrade`
- **Button:** `Manage Account`

### Messages
- **Validation errors:**
  - `Please enter your email address`
  - `Please enter a valid email address`
- **Loading state:** `Connecting...`
- **Success:** `Connected! Welcome, ${email}`
- **Error messages:**
  - `Cannot connect to server. Please check your internet connection.`
  - `Email not found in database. Please sign up first.`
  - `Error opening website. Please visit the website to manage your account.`

---

## PART 2: EXTENSION OVERLAYS & POPUPS
**File:** `extension/content/content.js`

### 1. Free Plan Shorts Block Overlay
- **Title:** `FocusTube Active`
- **Message:** `Shorts are blocked on the Free plan to reduce distraction. Upgrade to Pro to unlock Shorts with smart filters and focus tracking.`
- **Buttons:**
  - `Back to Home Screen`
  - `Upgrade to Pro`

### 2. Onboarding Overlay (first-time users)
- **Title:** `🎯 Welcome to FocusTube!`
- **Intro:** `Start strong. Sign in to your account to unlock Pro features and take control of your YouTube habits.`
- **Instructions box:**
  - Header: `Click the FocusTube extension icon` (top right of your browser) to:
  - Bullet points:
    - `Start your 14-day free Pro trial)`
    - `Sign in to an existing account`
    - `Continue with Free plan`
- **Buttons:**
  - `Got it, I'll click the icon`
  - `Skip for now` (Can delete)

### 3. Pro Manual Shorts Block Overlay
- **Title:** `🎯 Shorts Blocked!`
- **Message:** ` You've blocked Shorts for today. One less spiral to fall into — one more step toward focus.`
- **Button:** `Continue`

### 4. Global Daily Limit Overlay
- **Title:** `FocusTube Limit Reached`
- **Icon:** `🔒` (lock emoji)
- **Intro:** `You've hit your YouTube limit for the day. Time to reset your focus.`
- **Stats displayed:**
  - `Time watched today: ${timeText}`
  - `Shorts viewed: ${shortsViewed}`
  - `Long form videos watched: ${longFormVideos}`
  - `Searches made: ${searchesMade}`
- **Nudge message:** `💬 "${styleMessage}"` (varies by nudge style - see below)
- **Buttons:**
  - `Check Your Usage! 📊`
  - `Reset`

### 5. Focus Window Overlay
- **Title:** `🕐 You're Outside Your Focus Window`
- **Message line 1:** `Your YouTube window is ${startDisplay} - ${endDisplay}.`
- **Message line 2:** `${styleMessage}` (varies by nudge style)
- **Note:** Hard block - no dismiss buttons

### 6. Shorts Milestone Popup (Pro plan - every 5 Shorts)
- **Title:** `${emoji} You've watched ${engaged} Shorts (scrolled past ${scrolled}, for ${timeText})`
  - Emoji varies: 🎬 (default), 🎞️ (50+), 🎥 (40+), 📹 (30+), 📺 (20+)
- **Intro:** `Instead, you could have:`
- **Examples list:** Dynamic productivity examples based on time spent
- **Buttons:**
  - `Continue`
  - `Block Shorts for Today`

### 7. Spiral Detection Nudge
- **Title:** `⚠️ ${styleMessage}` (varies by nudge style)
- **Message:** `You've watched ${count} ${count === 1 ? 'video' : 'videos'} from ${channel} ${timePeriod}.`
  - timePeriod = "today" or "this week"
- **Countdown timer:** Shows `10` seconds, auto-dismisses
- **Buttons:**
  - `Continue`
  - `Block YouTube for Today`
  - `Block Channel Permanently`

### 8. Channel Block Confirmation Dialog
- **Title:** `Block Channel?`
- **Message:** `Removing distractions is real progress.`
- **Confirmation:** `Block "${channelName}"?`
- **Buttons:**
  - `Cancel`
  - `Block Channel`

### 9. AI Distracting Content Popup (Commented out but exists)
- **Title:** `⚠️ This content may not align with your goals`
- **Message:** `${classification.reason || "This content may pull you off track"}`
- **Cost text (if applicable):** `This will use ${amount} of your daily video allowance` OR `This will use ${amount} minutes of your daily time allowance`
- **Allowance text (if applicable):** `Remaining allowance: ${allowanceText}`
- **Buttons:**
  - `Go Back`
  - `Continue`

### 10. Journal Nudge Popup
- **Title:** `What pulled you off track?`
- **Subtitle:** `You've been watching ${videoTitle}${videoChannel ? ` from ${videoChannel}` : ''} for a while.`
- **Textarea placeholder:** `${styleMessage}` (varies by nudge style - see below)
- **Buttons:**
  - `Save`
  - `Dismiss`
- **Close button:** `×`

### Nudge Style Messages
**Function:** `getNudgeMessage(style, type)`

**Gentle style:**
- Spiral: `Still learning?`
- Time limit: `Take a break?`
- Focus window: `Maybe step away?`
- Journal: `What made you click on this? What were you hoping to feel?`

**Direct style:**
- Spiral: `Check your goals`
- Time limit: `You're over your limit`
- Focus window: `Time to focus`
- Journal: `What were you trying to avoid?`

**Firm style:**
- Spiral: `Time's up`
- Time limit: `Blocked for today`
- Focus window: `Focus now`
- Journal: `Write down what triggered you`

---

## PART 3: FRONTEND PAGES

### PAGE 1: Home / Landing Page
**File:** `frontend/src/pages/Home.tsx`

#### Hero Section
- **Badge:** `Free for 14 days • No card needed`
- **Headline:** `YouTube without the spiral.`
- **Subheadline:** `FocusTube filters out distractions, sets smart limits, and nudges you back to your goals — so you stop spiraling and start doing.`
- **Buttons:**
  - `Start Free Trial`
  - `Install Extension`
- **Hero image alt:** `FocusTube dashboard showing daily usage, focus score, and distractions blocked`

#### Social Proof Section (LETS REMOVE THIS SECTION AS ITS ALL FAKE FOR NOW)
- **Stat 1:** `10,000+` / `Active users`
- **Stat 2:** `45%` / `Avg. distraction reduction`
- **Stat 3:** `4.8/5` / `Chrome Store rating`

#### Problem Statement
- **Headline:** `You don't need more willpower.`
- **Subheadline:** `You’ve deleted the app. You’ve blocked Shorts. You’ve unsubscribed from channels.`
`And yet, you still fall down the rabbit hole.` 
`FocusTube helps you break the cycle — with smarter limits and actual accountability.`

#### How It Works
- **Section title:** `How it works`
- **Step 1:**
  - Number: `1`
  - Title: `Install`
  - Description: `Add the extension to Chrome in one click. Setup takes 3 seconds.`
- **Step 2:**
  - Number: `2`
  - Title: `Set goals`
  - Description: `Tell FocusTube what you're working on and what tends to derail you.`
- **Step 3:**
  - Number: `3`
  - Title: `Browse with guardrails`
  - Description: `As you use YouTube, FocusTube filters content, tracks habits, and nudges you back on track when you slip.`

#### Features Grid
- **Section title:** `What it does`
- **Subtitle:** `Built for people who know better — but still spiral.`
- **Feature cards:**
	1. **Distraction Detection**
	•	Description: `Analyzes video titles, channels, and tags to flag likely distractions. Helps you spot the trap — before you're in it.`
	2. **Spiral Detection**
	•	Description: `Watches for binge patterns or repeat views. Nudges you gently when you're drifting into a loop.`
	3.**Blocks Shorts**
	•	Description: `Wipe out the infinite scroll by default, keep full control if you want it.`
	4.**Time Boundaries**
	•	Description: `Set daily limits and focus windows. Use YouTube with intention — not on impulse.`
	5.**Smart Nudges**
	•	Description: `Contextual popups that ask the right questions at the right time. Never shaming — always helpful.`
	6.	**Personal Dashboard**
	•	Description: `Track how you're using YouTube. Spot your weak moments. Celebrate when you stay focused.`
	7.	**Channel Blocking**
	•	Description: `Pick channels that derail you and block them permanently. One click. No second guessing.`
	8.	**Focus Goals**
	•	Description: `Tell FocusTube what matters to you. Used to train the AI, personalize nudges, and give more relevant insights.`

#### (NEW SECTION) Who's It For
- **Section title:** `Made for people who know better - but still spiral`
- **Paragraph** `FocusTube isn't for dopamine detox monks or zero-inbox purists. It's for people trying to get things done- who want to learn, build improve but get derailed by YouTube just a little too easily. If you've ever gone in to watch one video... and resurfaced 2 hours later, this is for you.`

#### Free vs Pro Section
- **Section title:** `Free vs Pro`
- **Free Plan:**
  - Title: `Free`
  - Features:
    - `Block YouTube Shorts`
    - `Daily time limit`
    - `Daily search limit`
  - Button: `Use for free`
- **Pro Plan:**
  - Badge: `Most Popular`
  - Title: `Pro`
  - Features:
    - `Distraction nudges & spiral detection`
    - `AI-powered video filtering`
    - `Targetted channel blocking`
    - `Full dahsboard & insights`
    - `Custom goals & focus-time settings`
    - `Focus journal prompts`
    - `Priority support and access to new features`
  - Button: `Start 14-Day Free Trial (No card needed)`

#### FAQ Section
- **Section title:** `Frequently Asked Questions`
- **Q1:** `How long is the free trial?`
  - **A1:** `14 days. No card needed. You get full access to Pro features during the trial period.`
- **Q2:** `Is my data private?`
  - **A2:** `We don’t sell your data. Ever. Some features process locally, some use secure APIs. Nothing is sold or tracked externally.`
- **Q3:** `How much does Pro cost?`
  - **A3:** `$4.99/month or $49.99/year. Cancel Anytime`
- **Q4:** `Does it only work on Chrome?`
  - **A4:** `Currently yes, Chrome and Edge (Chromium-based). Safari and Firefox support coming soon.`
- **Q5:** `What does the AI actually do?`
  - **A5:** `FocusTube looks at video titles, tags, and channels to detect likely distractions. It's simple, effective, and fast. Over time, it learns from your habits to filter based on *your* goals.`

#### Final CTA Section
- **Headline:** `Ready to reclaim your focus?`
- **Subheadline:** `YouTube’s not the problem. Losing control is. FocusTube helps you stay intentional, without blocking everything.`
- **Button:** `Start 14-Day Free Trial`
- **Footnote:** `No credit card required • Cancel anytime`

---

### PAGE 2: Login Page
**File:** `frontend/src/pages/Login.tsx`

#### Header
- **Brand link:** `FocusTube`
- **Title:** `Welcome back`
- **Subtitle:** `Sign in to access your dashboard`

#### Form
- **Email field:**
  - Label: `Email`
  - Placeholder: `you@example.com`
- **Password field:**
  - Label: `Password`
  - Link: `Forgot?`
- **Button:** `Sign in` (loading: `Signing in...`)
- **Error message:** `Something went wrong. Please try again.` (or specific error)

#### Footer
- **Text:** `Don't have an account? Sign up` (link to signup)

---

### PAGE 3: Signup Page
**File:** `frontend/src/pages/Signup.tsx`

#### Header
- **Brand link:** `FocusTube`
- **Title:** `Create your account`
- **Subtitle:** `Start your 14-day free trial`

#### Form
- **Name field:**
  - Label: `Full name`
  - Placeholder: `John Doe`
- **Email field:**
  - Label: `Email`
  - Placeholder: `you@example.com`
- **Password field:**
  - Label: `Password`
  - Placeholder: `At least 8 characters`
- **Button:** `Start free trial` (loading: `Creating account...`)
- **Error message:** Shows specific error or `Something went wrong. Please try again.`

#### Email Confirmation Alert (if shown)
- **Title:** `Check your email`
- **Message:** `We've sent a confirmation link to ${email}. Click it to verify your account, then come back to sign in.`
- **Button:** `Already verified? Sign in`

#### Footer
- **Legal text:** `By signing up, you agree to our Terms and Privacy Policy.`
- **Text:** `Already have an account? Sign in`

---

### PAGE 4: Dashboard Page
**File:** `frontend/src/pages/Dashboard.tsx`

#### Header
- **Title:** `Your Stats`
- **Subtitle:** `Track your YouTube habits and stay focused`

#### Error State
- **Title:** `Error loading dashboard`
- **Message:** Shows error message
- **Button:** `Retry`

#### Extension Not Connected Warning
- **Title:** `Extension not connected`
- **Message:** `Install and connect the FocusTube extension to see your data`
- **Button:** `Install Extension`

#### Loading State
- **Text:** `Loading dashboard data...`

#### Data Window Note
- **Text:** `Data covers the last ${windowDays} days${dataSource === "extension" ? " (syncing from extension storage)" : ""}.`

#### Content Categories Section
- **Title:** `Content Categories`
- **Description:** `What types of content you've been watching over the last ${windowDays} days`
- **Item format:** `${index + 1}. ${category}` / `${videos} ${videos === 1 ? "video" : "videos"} · ${minutes} min`

#### Biggest Distractions Section
- **Title:** `Biggest Distractions This Week`
- **Description:** `Top channels pulling you off-track`
- **Item format:** `${index + 1}. ${channel}` / `${videos} ${videos === 1 ? "video" : "videos"} · ${minutes} min`
- **Button:** `Block`

#### Cleanup Suggestion
- **Title:** `Consider Cleaning Up?`
- **Message:** `You watched ${minutes} minutes of content from channels you've marked as distracting this week.`
- **Button:** `Block All Distractions`

---

### PAGE 5: Settings Page
**File:** `frontend/src/pages/Settings.tsx`

#### Header
- **Title:** `Your FocusTube`
- **Subtitle:** `Customize FocusTube to match your goals`

#### Tabs
- `Goals`
- `Blocked Channels`
- `Controls`
- `Account`

#### Goals Tab

**Your Goals Card:**
- **Title:** `Your Goals`
- **Description:** `What do you want to learn or accomplish? FocusTube will help you stay on track.`
- **Input placeholder:** `e.g., Learn React`
- **Add button:** `Add`
- **Empty state:** `No goals added yet. Add your first goal above.`
- **Max limit message:** `You can add up to 5 goals. Remove one to add another.`
- **Duplicate message:** `This goal is already in your list.`

**Common Distractions Card:**
- **Title:** `Common Distractions`
- **Description:** `Topics that tend to pull you off-track`
- **Input placeholder:** `e.g., Gaming streams`
- **Add button:** `Add`
- **Empty state:** `No distractions added yet. Add your first distraction above.`
- **Max limit message:** `You can add up to 5 distractions. Remove one to add another.`
- **Duplicate message:** `This distraction is already in your list.`

**Save button:** `Save Goals` (loading: `Saving...`)

**Success toast:** `Your goals have been updated.`
**Error toast:** `Failed to save goals. Please try again.`

#### Blocked Channels Tab

**Blocked Channels Card:**
- **Title:** `Blocked Channels`
- **Description:** `Channels you've blocked to stay focused. All names will be normalized when you save.`
- **Input placeholder:** `Enter channel name (e.g., Eddie Hall)`
- **Add button:** `Add`
- **Loading state:** `Loading blocked channels...`
- **Empty state:** `No channels blocked yet`
- **Save button:** `Save & Normalize Channels` (loading: `Normalizing & Saving...`)
- **Helper text:** `Channel names will be normalized to match YouTube metadata. The page will refresh after saving.`

**Success toast:** `Channels Saved` / `${changedCount} channel name(s) normalized and saved` OR `Channels saved (no normalization needed)`
**Error toasts:**
- `You must be logged in to block channels`
- `Add at least one channel to block.`
- `Please enter a channel name`
- `This channel is already in your blocklist`
- `Failed to save blocked channels. Please try again.`
- `Normalization Warning: ${warning}`

#### Controls Tab

**Content Filters Card:**
- **Title:** `Content Filters`
- **Description:** `Block distracting features on YouTube`
- **Toggle 1 (Pro only):** `Hard Block Shorts / Track Shorts with Reminders`
  - Description: `${blockShorts ? "Hard block Shorts (Free behavior)" : "Track Shorts with reminders (Pro behavior)"}`
- **Toggle 2:** `Hide Recommendations`
  - Description: `Remove suggested videos from sidebar and homepage`

**Time Limits Card:**
- **Title:** `Time Limits`
- **Description:** `Set daily usage goals and boundaries`
- **Label:** `Daily limit`
- **Badge:** `${dailyLimit[0]} minutes`
- **Helper text:** `You'll receive gentle nudges when approaching this limit`

**Focus Window Card:**
- **Title:** `Focus Window`
- **Description:** `Set specific hours when YouTube is accessible`
- **Toggle:** `Enable Focus Window`
  - Description: `Restrict YouTube access to specific hours`
- **Time inputs (if enabled):**
  - Label: `From`
  - Placeholder: `1:00 PM`
  - Label: `Until`
  - Placeholder: `6:00 PM`

**Nudge Style Card:**
- **Title:** `Nudge Style`
- **Description:** `How should FocusTube remind you?`
- **Options:**
  - `Gentle — "Still learning?"`
  - `Direct — "Check your goals"`
  - `Firm — "Time's up"`

**Save button:** `Save All Controls` (loading: `Saving...`)

**Success toast:** `Settings saved` / `Your preferences have been updated.`
**Error toast:** `Failed to save settings. Please try again.` / `You must be logged in to save settings`

#### Account Tab

**Subscription Card:**
- **Title:** `Subscription`
- **Description:** `Manage your FocusTube plan`
- **Plan display:** `${userPlan === "free" ? "Free Plan" : userPlan === "trial" ? "Trial Plan" : "Pro Plan"}`
- **Description:** `${userPlan === "free" ? "Basic features included" : "Full features included"}`
- **Button (if free):** `Upgrade to Pro`

**Sign Out Card:**
- **Title:** `Sign Out`
- **Description:** `Sign out of your FocusTube account`
- **Button:** `Sign Out`

**Success toast:** `Logged out` / `You have been successfully logged out.`
**Error toast:** `Something went wrong. Please try again.`

---

### PAGE 6: Goals Page (Onboarding)
**File:** `frontend/src/pages/Goals.tsx`

#### Header
- **Title:** `Set Your Focus Goals`
- **Subtitle:** `Help FocusTube understand what you want to achieve`

#### Helper Info Box
- **Title:** `How to add items:`
- **Message:** `Type an item in the input field, then press the "Add" button or press Enter to confirm your entry. Each item will appear as a badge below. You can remove items by clicking the X on any badge.`

#### Focus Goals Section
- **Label:** `What are you hoping to get out of YouTube and stay focused to?`
- **Helper text:** `Enter one item, click Add. Each goal saved separately. (Max 5)`
- **Input placeholder:** `e.g., Learn Python programming`
- **Button:** `Add Goal`
- **Empty state:** `No goals added yet. Add at least one to continue.`
- **Error messages:**
  - `Maximum 5 items allowed. Remove one to add another.`
  - `This item is already added.`

#### Distraction Themes Section
- **Label:** `What are your common pitfalls for distraction spirals on YouTube?`
- **Helper text:** `Enter one item, click Add. Each distraction saved separately. (Max 5)`
- **Input placeholder:** `e.g., Gaming videos`
- **Button:** `Add`

#### Distraction Channels Section
- **Label:** `Channels that usually derail you (optional)`
- **Helper text:** `Enter channel names you waste time on. We'll monitor these closely. (Max 5)`
- **Input placeholder:** `e.g., Ali Abdaal`
- **Button:** `Add Channel`
- **Auto-block toggle (if channels added):**
  - Label: `Block these channels immediately`
  - Description: `If enabled, these channels will be blocked right away. You can unblock them later in Settings.`

#### Submit Button
- **Text:** `Continue to Download` (loading: `Saving...` OR `Normalizing channel names...`)
- **Disabled helper:** `Please add at least one focus goal to continue.`

#### Error Messages
- `You must be logged in to set goals`
- `Failed to check authentication. Please try logging in again.`
- `You must be logged in to set goals. Redirecting to login...`
- `Something went wrong. Please try again.`

#### Loading State
- **Text:** `Checking authentication...`

---

### PAGE 7: Pricing Page
**File:** `frontend/src/pages/Pricing.tsx`

#### Header
- **Badge:** `14-day free trial • No credit card required`
- **Title:** `Simple, transparent pricing`
- **Subtitle:** `Start free, upgrade when you're ready. Cancel anytime.`

#### Billing Toggle
- **Monthly:** `Monthly`
- **Yearly:** `Yearly` + `Save 30%` badge

#### Free Plan Card
- **Title:** `Free`
- **Description:** `Essential tools to get started`
- **Price:** `$0` / `forever`
- **Features:**
  - `Block YouTube Shorts`
  - `Basic search filtering`
  - `Daily time limit (up to 60min)`
  - `Basic usage statistics`
- **Button:** `Get Started Free`

#### Pro Plan Card
- **Badge:** `Most Popular`
- **Title:** `Pro`
- **Description:** `Advanced features for serious learners`
- **Price:** `${pricing[billingPeriod].price}/month`
  - Monthly: `$7`
  - Yearly: `$5` + `Billed $60/year`
- **Features:**
  - `Everything in Free, plus:`
  - `AI-powered content filtering`
  - `Unlimited daily time limits`
  - `Advanced dashboard & insights`
  - `Custom focus goals & tracking`
  - `Distraction heatmaps`
  - `Priority email support`
- **Button:** `Start 14-Day Free Trial`
- **Footnote:** `No credit card required`

#### Trust Badges
- `Privacy-first`
- `Cancel anytime`
- `30-day money back`

#### FAQ Section
- **Title:** `Pricing FAQ`
- **Q1:** `What happens after the free trial?`
  - **A1:** `After 14 days, you'll automatically move to the Free plan. You can upgrade to Pro anytime. We never charge without your explicit consent.`
- **Q2:** `Can I switch between plans?`
  - **A2:** `Yes! Upgrade or downgrade anytime. If you downgrade, you'll keep Pro features until the end of your billing period.`
- **Q3:** `Do you offer refunds?`
  - **A3:** `Yes, we offer a 30-day money-back guarantee. If you're not satisfied, email us for a full refund.`
- **Q4:** `Is there a student discount?`
  - **A4:** `Yes! Students get 50% off Pro. Email us from your .edu address to verify and get your discount code.`
- **Q5:** `What payment methods do you accept?`
  - **A5:** `We accept all major credit cards (Visa, Mastercard, Amex) via Stripe. All payments are secure and encrypted.`
- **Q6:** `Can I use one subscription on multiple devices?`
  - **A6:** `Yes! Your Pro subscription works across all your devices where you're signed in to Chrome.`

#### Closing CTA
- **Title:** `Still have questions?`
- **Message:** `We're here to help. Reach out anytime.`
- **Button:** `Contact Support` (links to `mailto:support@focustube.com`)

---

### PAGE 8: Download Page
**File:** `frontend/src/pages/Download.tsx`

#### Header
- **Badge:** `Free • Takes 30 seconds`
- **Title:** `Install FocusTube`
- **Subtitle:** `Start using YouTube with intention in under a minute`

#### Install Card
- **Icon:** Chrome icon
- **Title:** `Chrome Extension`
- **Description:** `Works on Chrome, Edge, Brave, and other Chromium browsers`
- **Button:** `Add to Chrome — It's Free`
- **Rating:** `⭐️ Rated 4.8/5 by 10,000+ users`

#### Setup Steps
- **Title:** `Quick Setup (3 steps)`
- **Step 1:**
  - Number: `1`
  - Title: `Install the extension`
  - Description: `Click "Add to Chrome" above, then click "Add extension" in the popup`
- **Step 2:**
  - Number: `2`
  - Title: `Set your goals`
  - Description: `The extension will ask what you want to learn and what distracts you (takes 30 seconds)`
- **Step 3:**
  - Number: `3`
  - Title: `Start browsing YouTube`
  - Description: `FocusTube works automatically. Visit YouTube and see the difference!`

#### Post-Install Tips
- **Title:** `After installing`
- **Tip 1:** `Pin the extension: Click the puzzle icon in Chrome, find FocusTube, and click the pin icon`
- **Tip 2:** `Create an account: Sign up to sync your settings and access the dashboard`
- **Tip 3:** `Customize: Adjust settings anytime by clicking the extension icon`

#### Next Steps
- **Text:** `Already installed the extension?`
- **Buttons:**
  - `Create Account`
  - `Open Dashboard`

#### Support
- **Text:** `Need help installing?`
- **Link:** `Contact Support` (links to `mailto:support@focustube.com`)

---

### PAGE 9: Privacy Policy Page
**File:** `frontend/src/pages/Privacy.tsx`

#### Header
- **Title:** `Privacy Policy`

#### Sections
- **Data Collection:**
  - Text: `FocusTube collects minimal data to provide you with the best experience. We track your YouTube usage patterns locally on your device and only send anonymized data to our servers for AI classification when you're on the Pro plan.`

- **What We Collect:**
  - Bullets:
    - `Video titles and search queries (for AI classification)`
    - `Time spent watching videos (stored locally)`
    - `User preferences and settings`
    - `Email address (for account management)`

- **How We Use Your Data:**
  - Text: `Your data is used solely to improve your focus and productivity. We never sell your data to third parties. AI classification results are cached to reduce API calls and improve performance.`

- **Data Security:**
  - Text: `We use industry-standard encryption and security practices to protect your data. All API communications are encrypted using HTTPS, and sensitive information is never stored in plain text.`

- **Your Rights:**
  - Text: `You have the right to access, modify, or delete your data at any time. Contact us at privacy@focustube.app for data requests.`

#### Footer
- **Text:** `Last updated: ${new Date().toLocaleDateString()}`

---

### PAGE 10: Terms of Service Page
**File:** `frontend/src/pages/Terms.tsx`

#### Header
- **Title:** `Terms of Service`

#### Sections
- **Acceptance of Terms:**
  - Text: `By using FocusTube, you agree to these terms of service. If you do not agree with any part of these terms, please do not use our service.`

- **Service Description:**
  - Text: `FocusTube is a Chrome extension designed to help users maintain focus while using YouTube. We provide tools to block distracting content, track usage, and classify videos using AI technology.`

- **User Responsibilities:**
  - Bullets:
    - `You must be at least 13 years old to use FocusTube`
    - `You are responsible for maintaining the security of your account`
    - `You agree not to misuse or abuse the service`
    - `You will not attempt to reverse engineer or hack the extension`

- **Subscription and Payments:**
  - Text: `Pro plan subscriptions are billed monthly or yearly. You can cancel at any time. Refunds are provided on a case-by-case basis within 14 days of purchase.`

- **Limitation of Liability:**
  - Text: `FocusTube is provided "as is" without warranties of any kind. We are not liable for any damages arising from the use or inability to use the service.`

- **Changes to Terms:**
  - Text: `We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.`

- **Contact:**
  - Text: `For questions about these terms, contact us at legal@focustube.app`

#### Footer
- **Text:** `Last updated: ${new Date().toLocaleDateString()}`

---

### PAGE 11: 404 Not Found Page
**File:** `frontend/src/pages/NotFound.tsx`

- **Title:** `404`
- **Message:** `Oops! Page not found`
- **Link:** `Return to Home`

---

## PART 4: SHARED COMPONENTS

### Header Component
**File:** `frontend/src/components/Header.tsx`

#### Brand
- **Logo text:** `FocusTube`

#### Navigation (Desktop)
- `Home`
- `Pricing`
- `Download`
- `Dashboard` (if authenticated)
- `Settings` (if authenticated)
- `Login` (if not authenticated)
- `Sign Out` (if authenticated)

#### CTA Button (if not authenticated)
- `Start Free Trial`

#### Mobile Menu
- Same navigation items as desktop
- `Start Free Trial` button (if not authenticated)

#### Toast Messages
- **Success:** `Logged out` / `You have been successfully logged out.`
- **Error:** `Failed to log out. Please try again.` / `Something went wrong. Please try again.`

---

### Footer Component
**File:** `frontend/src/components/Footer.tsx`

#### Brand Section
- **Title:** `FocusTube`
- **Description:** `Stop getting lost in "useful" YouTube. Focus on what matters.`

#### Product Links
- **Title:** `Product`
- Links:
  - `Download`
  - `Pricing`

#### Legal Links
- **Title:** `Legal`
- Links:
  - `Privacy Policy`
  - `Terms of Service`

#### Support Section
- **Title:** `Support`
- **Text:** `Questions? Email us at support@focustube.app`

#### Copyright
- **Text:** `© ${new Date().getFullYear()} FocusTube. All rights reserved.`

---

## NOTES FOR EDITING

1. **Dynamic Variables:** Text with `${variable}` syntax uses JavaScript template literals - keep the syntax when editing
2. **Conditional Text:** Some text changes based on user state (authenticated, plan type, etc.) - note these in your edits
3. **Emojis:** Some overlays use emojis (🎯, 🔒, ⚠️, 🕐) - decide if you want to keep or remove
4. **Button States:** Many buttons have loading states (e.g., "Sign in" → "Signing in...") - update both if changing
5. **Error Messages:** Error messages are user-facing - make them helpful and clear
6. **Placeholders:** Input placeholders should be clear examples
7. **Helper Text:** Small descriptive text helps users understand features

---

## NEXT STEPS

After editing this document:
1. Review all changes
2. Let me know when ready
3. I'll apply the changes to the actual codebase files

