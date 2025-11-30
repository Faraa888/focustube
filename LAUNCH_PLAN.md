# 🚀 FocusTube Sunday Launch Plan

**Target:** Launch by Sunday  
**Status:** Final sprint to production

---

## 📍 CURRENT STATUS

### ✅ COMPLETED
- Authentication & login flow (all tests passed)
- Extension ↔ Website sync working
- Database schema complete
- Backend API endpoints live
- Server URL: `https://focustube-backend-4xah.onrender.com`
- Core features: Channel blocking, Settings, Dashboard, Focus windows, AI classification, Journal nudge, Spiral detection, Data sync

### ⚠️ CRITICAL BUGS TO FIX

#### Bug 1: Journal Nudge Shows for Free Users
**File:** `extension/content/content.js` (line ~4944)  
**Fix:** Add plan check BEFORE starting timer

**Change this:**ascript
journalNudgeTimer = setTimeout(async () => {**To this:**ipt
// Only start timer if Pro/Trial plan
const { ft_plan } = await chrome.storage.local.get(["ft_plan"]);
if (isProExperience(ft_plan)) {
  journalNudgeTimer = setTimeout(async () => {**And close the if block after the setTimeout:**t
  }, 60000);
}#### Bug 2: Settings Require Extension Reload
**File:** `frontend/src/pages/Settings.tsx`  
**Fix:** After saving settings, send reload message to extension

**Add after successful save:**cript
// Notify extension to reload settings
try {
  chrome?.runtime?.sendMessage?.({ type: "FT_RELOAD_SETTINGS" }, () => {});
} catch (e) {}#### Bug 3: Blocked Channels May Not Persist
**File:** `extension/lib/state.js`  
**Fix:** Verify blocked channels are NOT cleared in daily reset

**Check reset function - should NOT reset `ft_blocked_channels`**

---

## 🧪 TESTING CHECKLIST

### Critical Tests (2 hours)

#### Test 1: Settings Sync (3 min)
- [ ] Settings → Toggle "Hide Recommendations" → Save
- [ ] Go to YouTube homepage
- [ ] **Expected:** Recommendations hidden immediately (no reload)

#### Test 2: Video Titles (5 min)
- [ ] Watch 3-4 videos (45+ sec each)
- [ ] Check Supabase `video_sessions` table
- [ ] **Expected:** All have proper titles

#### Test 3: Blocked Channels (5 min)
- [ ] Block channel from video
- [ ] Block channel from Settings
- [ ] Block channel from Dashboard
- [ ] **Expected:** All 3 persist after extension reload

#### Test 4: Timer Sync (10 min)
- [ ] Watch 30 min on Device A
- [ ] Log in on Device B
- [ ] **Expected:** Timer shows 30 min (merged)

#### Test 5: Daily Limit (5 min)
- [ ] Set limit to 1 min
- [ ] Watch for 1:01
- [ ] **Expected:** Overlay appears at exactly 60 seconds

#### Test 6: Focus Window (5 min)
- [ ] Enable focus window (outside current time)
- [ ] Watch video for 30 sec
- [ ] **Expected:** Overlay appears during playback

#### Test 7: Journal Nudge (5 min)
- [ ] Pro/Trial: Watch distracting video 60+ sec
- [ ] **Expected:** Nudge appears
- [ ] Free plan: Watch distracting video 60+ sec
- [ ] **Expected:** NO nudge

#### Test 8: Spiral Nudge (8 min)
- [ ] Watch 3 videos from same channel
- [ ] **Expected:** Spiral nudge appears
- [ ] Test all buttons work

#### Test 9: Sign-in Sync (3 min)
- [ ] Log out → Check plan (should be "free")
- [ ] Log in → Check plan (should sync from server)

#### Test 10: Dashboard Data (6 min)
- [ ] Watch videos → Wait 60 sec
- [ ] Refresh dashboard
- [ ] **Expected:** New data appears

---

## 🛠️ DEPLOYMENT STEPS

### Step 1: Fix Bugs (1 hour)
- [ ] Fix journal nudge bug
- [ ] Fix settings reload
- [ ] Verify blocked channels persistence

### Step 2: Run Tests (2 hours)
- [ ] Complete all 10 critical tests
- [ ] Document any failures
- [ ] Fix any blocking issues

### Step 3: Backend Deployment (30 min)
- [ ] Verify environment variables set:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
  - `STRIPE_SECRET_KEY` (PRODUCTION)
  - `STRIPE_WEBHOOK_SECRET`
- [ ] Test endpoints:sh
  curl https://focustube-backend-4xah.onrender.com/health
  curl "https://focustube-backend-4xah.onrender.com/license/verify?email=YOUR_EMAIL"
  ### Step 4: Frontend Deployment (30 min)
- [ ] Verify Vercel environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_STRIPE_PUBLISHABLE_KEY` (PRODUCTION)
- [ ] Test live site:
  - [ ] Signup works
  - [ ] Login works
  - [ ] Dashboard loads
  - [ ] Settings save

### Step 5: Extension Build (1 hour)
- [ ] Set `DEBUG = false` in:
  - `extension/content/content.js` (line 13)
  - `extension/background/background.js` (line 56)
- [ ] Test on clean Chrome profile
- [ ] Create zip file

### Step 6: Chrome Web Store (1-2 hours)
- [ ] Prepare listing:
  - Short description (132 chars)
  - Detailed description
  - Screenshots (5 recommended)
  - Icons (128x128, 48x48, 16x16)
- [ ] Submit for review
- [ ] **Note:** Review takes 1-3 days

### Step 7: Final Checks (1 hour)
- [ ] End-to-end test (new user signup → install → use)
- [ ] Test Stripe checkout (real card, small amount)
- [ ] Check error logs
- [ ] Verify no console errors

---

## ✅ LAUNCH DAY CHECKLIST

### Morning
- [ ] Run test suite one more time
- [ ] Fix any critical bugs
- [ ] Verify all deployments live
- [ ] Test Stripe checkout

### Launch
- [ ] Publish extension (if approved)
- [ ] Announce launch
- [ ] Monitor error logs
- [ ] Monitor signups/payments

### Post-Launch (24 hours)
- [ ] Monitor logs hourly
- [ ] Check user signups
- [ ] Verify payments processing
- [ ] Respond to issues

---

## 🎯 SUCCESS CRITERIA

Launch successful when:
- ✅ Users can sign up and log in
- ✅ Extension installs and works
- ✅ Watch events sync to dashboard
- ✅ Blocked channels persist
- ✅ Stripe checkout works
- ✅ No 500 errors
- ✅ Extension in Chrome Web Store

---

## ⏰ TIME ESTIMATE

**Critical Path: 6-9 hours**
1. Fix bugs: 1 hour
2. Testing: 2 hours
3. Deployment: 2-3 hours
4. Store submission: 1-2 hours
5. Final checks: 1 hour

**If time is tight: 4 hours minimum**
- Fix 3 bugs (1 hour)
- Run tests 1-5 (1 hour)
- Deploy (1 hour)
- Submit to store (1 hour)

---

## 📞 QUICK REFERENCE

**URLs:**
- Backend: `https://focustube-backend-4xah.onrender.com`
- Frontend: `https://focustube-beta.vercel.app` (verify)

**Test Commands:**
// Check timer
chrome.storage.local.get(['ft_watch_seconds_today'], console.log)

// Check plan
chrome.storage.local.get(['ft_plan'], console.log)

// Check blocked channels
chrome.storage.local.get(['ft_blocked_channels'], console.log)sh
# Test backend
curl https://focustube-backend-4xah.onrender.com/health---

## 🚨 PRIORITY ORDER

1. **Fix 3 critical bugs** (1 hour)
2. **Run test suite** (2 hours)
3. **Deploy everything** (2-3 hours)
4. **Submit to store** (1-2 hours)
5. **Final checks** (1 hour)

**Everything else can be fixed post-launch!**