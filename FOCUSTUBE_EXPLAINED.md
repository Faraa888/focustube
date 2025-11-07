# 🎯 FocusTube - Complete Beginner's Guide

## What is FocusTube?

**FocusTube is like a smart friend that helps you use YouTube better.** 

Imagine YouTube is a big library where you can learn anything, but there are also lots of distractions (like celebrity gossip videos or endless "Top 10" lists). FocusTube watches what you're doing and helps you stay focused on your goals.

---

## 🏗️ The Two Big Parts

FocusTube has **two main pieces** that talk to each other:

### 1. **The Extension** (Lives in Your Browser)
- **What it does:** Watches you on YouTube, counts things, shows popups, blocks stuff
- **Where it lives:** In Chrome browser (the extension folder)
- **Think of it as:** The "eyes and hands" - it sees what you're doing and acts on it

### 2. **The Server** (Lives on the Internet)
- **What it does:** Remembers your plan (Free or Pro), talks to AI, handles payments
- **Where it lives:** On a computer in the cloud (the server folder)
- **Think of it as:** The "brain" - it makes smart decisions and remembers things

---

## 👤 The Two User Types: Free vs Pro

### **Free Plan Users** (Like a Basic Guard)
**What they get:**
- ❌ **Shorts are blocked** - Can't watch Shorts at all (redirected to home)
- 🔍 **5 searches per day** - After 5 searches, you get blocked with a message
- ⏱️ **2 minutes total watch time** - After 2 minutes of ANY YouTube, you're blocked
- 🤖 **No AI** - Everything is treated as "neutral" (not smart filtering)

**What happens:**
1. User tries to watch Shorts → Redirected to home with message
2. User searches 5 times → Blocked with "That's enough searching" message
3. User watches 2 minutes → Blocked with "FocusTube Limit Reached" overlay

### **Pro Plan Users** (Like a Smart Assistant)
**What they get:**
- ✅ **Shorts are allowed** - But tracked with a counter badge
- 🔍 **15 searches per day** - More searches allowed
- ⏱️ **3 minutes total watch time** (testing) - Can customize 15-120 minutes later
- 🤖 **AI filtering** - Smart system checks if content matches your goals
- 📊 **Daily allowance** - 1 distracting video OR 10 minutes of distracting content per day

**What happens:**
1. User watches Shorts → Counter badge shows "You've watched 5 Shorts (2 skipped)"
2. User searches → AI checks if search matches goals
3. User watches distracting video → Uses up allowance (1 video or 10 minutes)
4. After allowance used → Distracting content blocked for rest of day

---

## 🎬 The Complete User Journey

### **Journey 1: First-Time User (Onboarding)**

```
1. User installs extension
   ↓
2. User visits YouTube
   ↓
3. Onboarding overlay appears (full screen)
   ↓
4. User enters goals: "learn python, build SaaS"
   ↓
5. User clicks "Get Started"
   ↓
6. Goals saved → Extension starts working
```

**What the system does:**
- Checks if `ft_onboarding_completed` is false
- Shows welcome overlay
- Saves goals as array: `["learn python", "build SaaS"]`
- Sets `ft_onboarding_completed = true`
- Normal YouTube browsing begins

---

### **Journey 2: Free User on YouTube**

```
1. User visits YouTube
   ↓
2. Extension checks: "What page are they on?"
   ↓
3. Background script decides: "Should I block this?"
   ↓
4. If blocked → Show overlay
   If allowed → Show counter badges
```

**Step-by-step:**

**Scenario A: User tries to watch Shorts**
```
User clicks Shorts link
   ↓
content.js detects: "This is a SHORTS page"
   ↓
Sends message to background.js: "User navigated to Shorts"
   ↓
background.js checks rules.js: "Is this Free plan? Yes → Block Shorts"
   ↓
Returns: { blocked: true, scope: "shorts" }
   ↓
content.js redirects to home
   ↓
Shows overlay: "Shorts blocked on Free plan"
```

**Scenario B: User searches 6 times (Free plan limit is 5)**
```
User searches for "python tutorial"
   ↓
content.js detects: "This is a SEARCH page"
   ↓
Sends message to background.js
   ↓
background.js checks: "searchesToday = 6, threshold = 5"
   ↓
Returns: { blocked: true, scope: "search" }
   ↓
content.js pauses video, shows overlay
   ↓
Overlay: "That's enough searching for today - go and get your dreams"
```

**Scenario C: User watches for 2 minutes total**
```
User watches multiple videos
   ↓
Global time tracker running in background (every 1 second)
   ↓
Counts: 120 seconds = 2 minutes
   ↓
On next navigation, checks: "watchSecondsToday >= 120"
   ↓
Returns: { blocked: true, scope: "global" }
   ↓
Shows full-page overlay: "FocusTube Limit Reached"
   ↓
Shows stats: "Time watched: 2m, Shorts: 0, Searches: 3"
```

---

### **Journey 3: Pro User with AI (The Smart Path)**

```
1. User visits YouTube (Pro plan, goals set)
   ↓
2. User searches "python tutorial"
   ↓
3. Extension sends to server: "Classify this search"
   ↓
4. Server asks OpenAI: "Is 'python tutorial' productive for goals ['learn python']?"
   ↓
5. OpenAI responds: "Yes, productive (confidence: 0.9)"
   ↓
6. User clicks video → AI checks video title
   ↓
7. If distracting → Uses allowance OR shows popup
```

**Detailed AI Flow:**

**Step 1: User searches "python tutorial"**
```
content.js → background.js: "User searched 'python tutorial'"
   ↓
background.js: "User is Pro, has goals → Call AI"
   ↓
background.js → Server: POST /ai/classify
   Body: {
     user_id: "user@example.com",
     text: "python tutorial",
     context: "search",
     user_goals: ["learn python", "build SaaS"]
   }
   ↓
Server loads prompt from classifier.json
   ↓
Server → OpenAI: "Classify this with goals in mind"
   ↓
OpenAI responds: {
     category: "productive",
     confidence: 0.9,
     reason: "Directly teaches steps to learn python",
     tags: ["python", "tutorial", "learning"],
     action_hint: "allow",
     allowance_cost: { type: "none", amount: 0 }
   }
   ↓
Server caches result (24 hours)
   ↓
Server → background.js: Returns classification
   ↓
background.js stores in: ft_last_search_classification
   ↓
background.js → content.js: "Classification: productive, allow"
   ↓
content.js: Shows search counter, allows search
```

**Step 2: User watches distracting video**
```
User clicks "Top 10 celebrity moments"
   ↓
content.js extracts video title: "Top 10 celebrity moments this week"
   ↓
background.js → Server: "Classify this video title"
   ↓
Server → OpenAI: "Is this distracting for goals ['learn python']?"
   ↓
OpenAI responds: {
     category: "distracting",
     confidence: 0.92,
     action_hint: "soft-warn",  // or "block" if no allowance
     allowance_cost: { type: "video", amount: 1 }
   }
   ↓
background.js checks: "Does user have allowance? Yes (1 video left)"
   ↓
Returns: { blocked: false, action_hint: "soft-warn" }
   ↓
content.js shows popup: "This content is not aligned with your goals"
   ↓
User clicks "Continue" → Video plays, allowance decrements
   ↓
background.js: ft_allowance_videos_left = 0
   ↓
Next distracting video → Blocked (no allowance left)
```

---

## 🔧 How the Pieces Talk to Each Other

### **Communication Flow:**

```
YouTube Page (content.js)
    ↕ (chrome.runtime.sendMessage)
Background Script (background.js)
    ↕ (fetch API)
Server (Express + TypeScript)
    ↕ (API calls)
External Services:
  - Supabase (database)
  - OpenAI (AI classification)
  - Stripe (payments)
```

### **Example: Checking User Plan**

```
1. User visits YouTube
   ↓
2. content.js: "Hey background, what should I do?"
   ↓
3. background.js: "Let me check the plan..."
   ↓
4. background.js → Server: GET /license/verify?email=user@example.com
   ↓
5. Server → Supabase: "SELECT plan FROM users WHERE email = ..."
   ↓
6. Supabase → Server: { plan: "pro" }
   ↓
7. Server → background.js: { plan: "pro" }
   ↓
8. background.js stores in: chrome.storage.local.ft_plan = "pro"
   ↓
9. background.js → content.js: { plan: "pro", blocked: false }
   ↓
10. content.js: Shows Pro features (Shorts counter, AI popups)
```

---

## 📁 The File Structure (What Each File Does)

### **Extension Folder (`/extension`)**

#### **`content/content.js`** - The "Eyes and Hands"
**What it does:**
- Watches YouTube pages (HOME, SEARCH, WATCH, SHORTS)
- Shows overlays, badges, popups
- Detects page changes (YouTube is a single-page app)
- Communicates with background script

**Key functions:**
- `handleNavigation()` - Runs every time page changes
- `showOnboardingOverlay()` - First-time user setup
- `showShortsBadge()` - Pro plan Shorts counter
- `showSearchCounter()` - Search limit badge
- `showGlobalTimeCounter()` - Total watch time badge
- `showAIDistractingPopup()` - AI warning popup

#### **`background/background.js`** - The "Brain"
**What it does:**
- Makes decisions (block or allow?)
- Counts things (searches, videos, time)
- Talks to server (get plan, classify content)
- Manages storage (saves counters, plan, goals)

**Key functions:**
- `handleNavigated()` - Main decision maker
- `classifyContent()` - Calls AI classification
- `trackDistractingVideoTime()` - Tracks time on distracting videos
- Message handlers: `FT_SET_EMAIL`, `FT_SET_PLAN`, `FT_SET_GOALS`, `FT_RESET_COUNTERS`

#### **`lib/state.js`** - The "Memory"
**What it does:**
- Manages Chrome storage (local storage)
- Resets counters daily/weekly/monthly
- Syncs plan from server
- Default values for everything

**Key storage keys:**
- `ft_plan` - "free" or "pro"
- `ft_user_email` - User's email
- `ft_user_goals` - Array of goals
- `ft_searches_today` - Search count
- `ft_shorts_engaged_today` - Shorts watched
- `ft_watch_seconds_today` - Total watch time
- `ft_allowance_videos_left` - AI allowance (Pro only)
- `ft_allowance_seconds_left` - Time allowance (Pro only)

#### **`lib/rules.js`** - The "Rule Book"
**What it does:**
- Pure logic (no storage, no DOM)
- Takes context → Returns block/allow decision
- Defines limits per plan (Free: 5 searches, Pro: 15)

**Key function:**
- `evaluateBlock(ctx)` - Decides if content should be blocked

#### **`lib/constants.js`** - The "Settings"
**What it does:**
- Defines plan types: FREE, PRO, TEST
- Defines page types: HOME, SEARCH, WATCH, SHORTS
- Central place for all constants

#### **`lib/config.js`** - The "Server URL"
**What it does:**
- Returns server URL (localhost for dev, Lovable Cloud for prod)
- Used by background script (can use imports)

#### **`content/overlay.css`** - The "Styling"
**What it does:**
- Styles all overlays, badges, popups
- Makes everything look nice

---

### **Server Folder (`/server`)**

#### **`src/index.ts`** - The "Main Server"
**What it does:**
- Runs Express server (listens on port 3000)
- Handles all API endpoints
- Talks to Supabase, OpenAI, Stripe

**Key endpoints:**
- `GET /health` - Server health check
- `GET /license/verify?email=...` - Get user plan from Supabase
- `POST /ai/classify` - Classify content with OpenAI
- `POST /stripe/create-checkout` - Create Stripe payment link
- `POST /webhook/stripe` - Handle Stripe payment events
- `POST /user/update-plan` - Update plan in Supabase (dev panel)

#### **`src/supabase.ts`** - The "Database Helper"
**What it does:**
- Connects to Supabase database
- Gets/updates user plans
- Creates users if they don't exist

**Key functions:**
- `getUserPlan(email)` - Returns "free" or "pro"
- `updateUserPlan(email, plan)` - Updates plan in database

#### **`src/prompts/classifier.json`** - The "AI Instructions"
**What it does:**
- Contains the system prompt for OpenAI
- Defines input/output schema
- Has examples and decision rules
- Has failsafe (what to return if AI fails)

---

## 🎯 The Decision-Making Process

### **Every Time User Navigates:**

```
1. User clicks link or URL changes
   ↓
2. content.js detects change (MutationObserver)
   ↓
3. handleNavigation() runs
   ↓
4. Check onboarding? → Show onboarding if needed
   ↓
5. Detect page type (HOME, SEARCH, WATCH, SHORTS)
   ↓
6. Send message to background.js: "User navigated"
   ↓
7. background.js: handleNavigated()
   ↓
8. Read storage: plan, counters, goals, allowance
   ↓
9. If Pro plan → Call AI classification (for search/watch)
   ↓
10. Evaluate rules: evaluateBlock() in rules.js
   ↓
11. Check AI classification (if Pro)
   ↓
12. Return decision: { blocked: true/false, scope, reason }
   ↓
13. content.js receives decision
   ↓
14. If blocked → Show overlay
   If allowed → Show counters/badges
```

---

## 🔄 The Counter System

### **How Counters Work:**

**Daily Reset:**
- Every day at midnight (or when date changes)
- All counters reset to 0
- `ft_last_reset_key` stores date (e.g., "2025-01-15")
- `maybeRotateCounters()` checks if date changed

**What Gets Counted:**
- `ft_searches_today` - Increments on SEARCH pages
- `ft_short_visits_today` - Increments on SHORTS pages (total scrolled)
- `ft_shorts_engaged_today` - Increments if user stays >5 seconds (actually watched)
- `ft_watch_visits_today` - Increments on WATCH pages
- `ft_watch_seconds_today` - Tracks time on ALL pages (global timer)

**How Time Tracking Works:**
- `startGlobalTimeTracking()` runs when script loads
- Every 1 second, adds 1 to accumulated time
- Every 5 seconds, saves to storage
- Tracks across all tabs (reads from storage to sync)

---

## 🤖 The AI Classification System

### **How AI Works:**

**Step 1: Content Detection**
- User searches → Extract search query
- User watches video → Extract video title
- Send to background script

**Step 2: Classification Request**
```
background.js → Server: POST /ai/classify
{
  user_id: "user@example.com",
  text: "python tutorial",
  context: "search",
  user_goals: ["learn python", "build SaaS"]
}
```

**Step 3: Server Processing**
- Server loads prompt from `classifier.json`
- Builds system prompt: "You are a classifier..."
- Builds user prompt with goals and examples
- Calls OpenAI API with JSON mode

**Step 4: OpenAI Response**
```
{
  category: "productive",
  confidence: 0.9,
  reason: "Directly teaches steps to learn python",
  tags: ["python", "tutorial"],
  action_hint: "allow",
  allowance_cost: { type: "none", amount: 0 }
}
```

**Step 5: Caching**
- Server caches result for 24 hours
- Cache key: `user@example.com:python tutorial`
- Same query = instant response (no API call)

**Step 6: Allowance Logic**
- If `category === "distracting"`:
  - Check `ft_allowance_videos_left` or `ft_allowance_seconds_left`
  - If allowance > 0 → Allow but decrement
  - If allowance = 0 → Block
- If `category === "productive"` → Always allow
- If `category === "neutral"` → Always allow

---

## 💳 The Payment System

### **How Stripe Works:**

**Step 1: User Clicks "Upgrade to Pro"**
```
content.js → openStripeCheckout("monthly")
   ↓
Gets user email from storage
   ↓
Sends to server: POST /stripe/create-checkout
   Body: { email: "user@example.com", planType: "monthly" }
   ↓
Server → Stripe: Create checkout session
   ↓
Server → content.js: { checkoutUrl: "https://checkout.stripe.com/..." }
   ↓
content.js opens checkout URL in new tab
```

**Step 2: User Pays**
- User completes payment on Stripe
- Stripe redirects to success/cancel page

**Step 3: Webhook (Automatic)**
```
Stripe → Server: POST /webhook/stripe
   Event: checkout.session.completed
   ↓
Server extracts email from Stripe event
   ↓
Server → Supabase: Update user plan to "pro"
   ↓
Server clears plan cache
   ↓
Next time extension checks → Gets "pro" plan
```

---

## 🎨 The UI Elements

### **Overlays (Full-Screen Blocking)**
- **Shorts Blocked (Free)** - "Shorts are blocked on Free plan"
- **Search Blocked** - "That's enough searching for today"
- **Global Limit Reached** - "FocusTube Limit Reached" with stats
- **Pro Manual Block** - "You have chosen discipline"
- **Onboarding** - "Welcome to FocusTube!" with goals input

### **Badges (Small Counters)**
- **Shorts Counter (Pro)** - Top right: "Total Shorts Watched X (Y Skipped)"
- **Search Counter** - Left side: "3/5 searches today" (Free) or "8/15" (Pro)
- **Global Time Counter** - Top right: "Total: 5m 20s"

### **Popups (Non-Blocking Warnings)**
- **AI Distracting Popup** - "This content is not aligned with your goals"
- **Shorts Milestone Popup** - "You've watched 5 Shorts, 2 minutes" (time-based)
- **Search Warning** - "You have 2 searches remaining"

### **Dev Panel (Bottom Right)**
- Email input
- Plan selector (Free/Pro)
- Goals textarea
- Reset counters button
- Status display (email, plan, goals)
- AI classification display

---

## 🔐 The Storage System

### **Chrome Storage (Local)**
Everything is stored in `chrome.storage.local`:

**User Settings:**
- `ft_user_email` - User's email
- `ft_plan` - "free" or "pro"
- `ft_user_goals` - Array of goals
- `ft_onboarding_completed` - Boolean

**Counters (Reset Daily):**
- `ft_searches_today` - Number
- `ft_short_visits_today` - Number
- `ft_shorts_engaged_today` - Number
- `ft_watch_visits_today` - Number
- `ft_watch_seconds_today` - Number
- `ft_shorts_seconds_today` - Number

**AI Allowance (Pro, Reset Daily):**
- `ft_allowance_videos_left` - Number (default: 1)
- `ft_allowance_seconds_left` - Number (default: 600 = 10 minutes)

**Flags:**
- `ft_blocked_today` - Boolean (global block)
- `ft_block_shorts_today` - Boolean (Shorts block)
- `ft_pro_manual_block_shorts` - Boolean (Pro manual block)
- `ft_unlock_until_epoch` - Number (temporary unlock timestamp)

**Tracking:**
- `ft_current_video_classification` - Object (current video being tracked)
- `ft_last_search_classification` - Object (last search AI result)
- `ft_last_watch_classification` - Object (last video AI result)
- `ft_last_reset_key` - String (date key for reset)

---

## 🔄 The Sync System

### **Plan Sync:**
- Every 30 seconds (debounced)
- Extension → Server: GET /license/verify?email=...
- Server → Supabase: Get plan
- Server → Extension: { plan: "pro" }
- Extension saves to storage

### **Multi-Tab Sync:**
- Uses `chrome.storage.onChanged` listener
- When one tab updates counter, all tabs see it
- Global time tracker syncs across tabs every 5 seconds

---

## 🐛 Error Handling

### **What Happens When Things Break:**

**Server Down:**
- Extension uses cached plan (last known)
- AI classification returns null → Treated as neutral
- Shows warning in console, continues working

**OpenAI API Fails:**
- Server returns failsafe from `classifier.json`
- Category: "neutral", confidence: 0.5
- Extension continues normally

**Extension Context Invalidated:**
- Happens when extension reloads during development
- All chrome API calls check `isChromeContextValid()`
- Silently fails (no error spam)

**Storage Fails:**
- Uses last known values (prevents "0,0" display)
- Logs warning, continues with defaults

---

## 📊 The Complete Flow Diagrams

### **Free User Watching YouTube:**
```
Visit YouTube
   ↓
Onboarding? No (already done)
   ↓
Navigate to Shorts
   ↓
Check: Free plan → Block Shorts
   ↓
Redirect to home
   ↓
Show overlay: "Shorts blocked"
   ↓
User clicks "Upgrade to Pro"
   ↓
Stripe checkout opens
```

### **Pro User with Goals:**
```
Visit YouTube
   ↓
Onboarding? No
   ↓
Navigate to search: "python tutorial"
   ↓
Check: Pro plan → Call AI
   ↓
AI: "productive" → Allow
   ↓
Show search counter: "1/15"
   ↓
User clicks video
   ↓
AI checks video title
   ↓
If distracting → Check allowance
   ↓
If allowance > 0 → Show popup, allow, decrement
   ↓
If allowance = 0 → Block
```

---

## 🎯 What Can Be Trimmed/Changed/Added

### **Things That Could Be Simplified:**
1. **Counter System** - Currently tracks many things, could consolidate
2. **AI Prompt** - Very detailed, could be simplified for faster responses
3. **Overlays** - Multiple overlay types, could unify design
4. **Dev Panel** - Lots of features, could be simplified for production

### **Things That Could Be Added:**
1. **Goal Progress Tracking** - Show progress toward goals
2. **Analytics Dashboard** - Web page showing usage stats
3. **Goal-Based Recommendations** - Suggest videos based on goals
4. **Social Features** - Share progress, compete with friends
5. **Custom Limits** - Let users set their own search/time limits

### **Things That Could Be Changed:**
1. **Allowance System** - Currently 1 video OR 10 minutes, could be unified
2. **Reset Period** - Currently daily, could be weekly/monthly option
3. **AI Confidence** - Currently uses all classifications, could require >0.8 confidence
4. **Onboarding** - Currently one-time, could allow editing goals later

---

## 🎓 Summary: The Big Picture

**FocusTube is like a smart YouTube assistant that:**
1. **Watches** what you do (extension monitors YouTube)
2. **Remembers** your goals (stored in Chrome storage)
3. **Thinks** about content (AI classification)
4. **Decides** what to allow/block (rules engine)
5. **Shows** you what's happening (overlays, badges, popups)
6. **Blocks** distractions (redirects, overlays)
7. **Learns** from your goals (AI uses goals to classify)

**The flow is:**
```
User → Extension → Background → Server → AI/Database
         ↓
      Decision
         ↓
      Action (Block/Allow/Show)
```

**Everything is connected:**
- Extension talks to Background (messages)
- Background talks to Server (API calls)
- Server talks to Supabase/OpenAI/Stripe (external services)
- All data flows back to Extension (to show UI)

This is how FocusTube helps you stay focused on YouTube! 🎯

---

## 🚨 What Doesn't Work Right Now

### **AI Classification (Partially Broken)**
**Status:** ❌ Not fully functional  
**Reason:** Missing `OPENAI_API_KEY` in server `.env` file  
**What happens:** 
- Extension sends classification requests to server
- Server receives request but OpenAI client is not initialized
- Server returns neutral/fallback classification instead of real AI results
- All content is classified as "neutral" (confidence: 0.5)
- AI filtering doesn't actually work - everything is allowed

**How to fix:** Add `OPENAI_API_KEY=sk-...` to `server/.env` file

---

### **Stripe Payment System (Not Working)**
**Status:** ❌ Payment flow broken  
**Reasons:**
1. Missing `STRIPE_SECRET_KEY` in server `.env` file
2. Missing Stripe Price IDs (`STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `STRIPE_PRICE_LIFETIME`)
3. Webhook endpoint not publicly accessible (needs ngrok or deployment)

**What happens:**
- "Upgrade to Pro" button doesn't work
- Server returns error: "Stripe not configured"
- Users cannot upgrade to Pro plan
- Stripe webhook cannot update plans in Supabase

**How to fix:**
1. Add `STRIPE_SECRET_KEY=sk_test_...` to `server/.env`
2. Add Price IDs: `STRIPE_PRICE_MONTHLY=price_...`, etc.
3. Deploy server or use ngrok for webhook testing

---

### **Supabase Plan Sync (May Not Work)**
**Status:** ⚠️ May not work if credentials missing  
**Reason:** Missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` in server `.env`  
**What happens:**
- Extension tries to sync plan from server
- Server tries to query Supabase database
- If credentials missing, returns default "free" plan
- Plan changes don't persist in database
- Dev panel can set plan but it doesn't save to Supabase

**How to fix:** Add Supabase credentials to `server/.env`:
- `SUPABASE_URL=https://...`
- `SUPABASE_SERVICE_ROLE_KEY=eyJ...`

---

### **Production Server URL (Not Configured)**
**Status:** ⚠️ Only works locally  
**Reason:** Server URL hardcoded to `localhost:3000` in content script  
**What happens:**
- Extension works locally (server running on localhost)
- Won't work when deployed to Lovable Cloud or production
- Extension cannot connect to production server
- All server features break (plan sync, AI, payments)

**How to fix:** Update `extension/lib/config.js` or use storage-based URL configuration

---

### **Stripe Webhook (Not Accessible)**
**Status:** ❌ Not working  
**Reason:** Webhook endpoint needs public URL (Stripe can't reach localhost)  
**What happens:**
- User pays on Stripe
- Stripe tries to send webhook to `localhost:3000/webhook/stripe`
- Stripe cannot reach localhost → Webhook fails
- Plan doesn't automatically update after payment
- Manual intervention needed to update plan in Supabase

**How to fix:** 
- Use ngrok for local testing: `ngrok http 3000`
- Or deploy server to public URL (Lovable Cloud, Railway, etc.)
- Update Stripe webhook URL in Stripe dashboard

---

### **Goal-Based AI Classification (Not Fully Working)**
**Status:** ⚠️ Goals are collected but AI may not use them properly  
**Reason:** 
- Goals are sent to server ✓
- Server includes goals in prompt ✓
- But if OpenAI API key missing, goals are ignored
- Even with API key, prompt may need refinement for goal matching

**What happens:**
- Onboarding collects goals ✓
- Goals saved to storage ✓
- Goals sent to AI endpoint ✓
- But AI returns neutral if API key missing
- Or AI may not be matching goals correctly

**How to fix:** 
1. Add OpenAI API key
2. Test with goals: "learn python" → search "python tutorial" should be productive
3. Refine prompt if goal matching is weak

---

### **30-Minute Reminders (Not Implemented)**
**Status:** ❌ Feature missing  
**Reason:** Not built yet (from roadmap)  
**What happens:**
- Global time tracking works ✓
- But no reminder popups at 30-minute intervals
- Users don't get gentle "take a break" messages

**How to fix:** Implement reminder system in `content.js` that checks time every interval

---

### **Customizable Time Limits (Pro Plan)**
**Status:** ⚠️ Hardcoded values  
**Reason:** Time limits are hardcoded in `rules.js` (Free: 2 mins, Pro: 3 mins for testing)  
**What happens:**
- Limits work but can't be customized
- Final values should be: Free: 60 mins, Pro: 15-120 mins (customizable)
- Currently uses test values (2-3 minutes)

**How to fix:** 
1. Add time limit configuration to dev panel
2. Allow Pro users to set custom limits (15-120 mins)
3. Store in storage and read in rules.js

---

### **Success/Cancel Pages (Basic)**
**Status:** ⚠️ Basic pages exist but not polished  
**Reason:** Pages created but may not handle all edge cases  
**What happens:**
- Stripe redirects to success/cancel pages
- Pages show basic message
- But may not sync plan immediately
- User may need to manually refresh extension

**How to fix:** 
- Add automatic plan sync on success page
- Add "Return to YouTube" button that reloads extension
- Improve error handling

---

### **Multi-Tab Sync (Partially Working)**
**Status:** ⚠️ Works but may have edge cases  
**Reason:** Uses `chrome.storage.onChanged` but may miss rapid updates  
**What happens:**
- Counters sync across tabs ✓
- Global time syncs across tabs ✓
- But rapid changes may cause race conditions
- Some tabs may show stale data briefly

**How to fix:** Improve sync logic with debouncing and conflict resolution

---

### **Server Deployment (Not Done)**
**Status:** ❌ Only runs locally  
**Reason:** Server not deployed to production (Lovable Cloud, Railway, etc.)  
**What happens:**
- Everything works locally ✓
- But extension cannot connect to production server
- Production users cannot use features that require server

**How to fix:** Deploy server to Lovable Cloud or similar platform

---

## Summary of Broken/Missing Features

| Feature | Status | Reason |
|---------|--------|--------|
| AI Classification | ❌ Broken | Missing OpenAI API key |
| Stripe Payments | ❌ Broken | Missing API key + Price IDs |
| Stripe Webhook | ❌ Broken | Not publicly accessible |
| Supabase Sync | ⚠️ May not work | Missing credentials |
| Production Server | ⚠️ Not configured | Hardcoded localhost |
| 30-Min Reminders | ❌ Not implemented | Feature not built |
| Custom Time Limits | ⚠️ Hardcoded | Not configurable |
| Goal-Based AI | ⚠️ Partial | Needs API key + testing |
| Success Pages | ⚠️ Basic | Needs polish |
| Multi-Tab Sync | ⚠️ Partial | May have edge cases |
| Server Deployment | ❌ Not done | Only local |

---

## Quick Fix Checklist

To get everything working:

1. **Add to `server/.env`:**
   ```
   OPENAI_API_KEY=sk-...
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PRICE_MONTHLY=price_...
   STRIPE_PRICE_ANNUAL=price_...
   STRIPE_PRICE_LIFETIME=price_...
   SUPABASE_URL=https://...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```

2. **Deploy server** to Lovable Cloud or Railway

3. **Update Stripe webhook** URL in Stripe dashboard

4. **Test AI classification** with goals set

5. **Test payment flow** end-to-end

6. **Implement missing features** (30-min reminders, custom limits)

