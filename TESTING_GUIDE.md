# FocusTube Testing Guide

## Quick Start

### 1. Start the Server
```bash
cd server
npm run dev
```

**Expected Output:**
```
🚀 FocusTube server running on port 3000
   Environment: development
   Health check: http://localhost:3000/health
   ✅ Loaded AI classifier prompt v1.0.0
```

**If you see warnings:**
- `⚠️  OPENAI_API_KEY not set` - AI will return neutral (OK for basic testing)
- `⚠️  SUPABASE_URL not set` - Plan sync won't work (need for full testing)
- `⚠️  STRIPE_SECRET_KEY not set` - Checkout won't work (need for payment testing)

### 2. Load the Extension
1. Open Chrome: `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension` folder
5. Extension should load without errors

### 3. Set Up Test Account
1. Open YouTube (any page)
2. Find dev panel (bottom right corner)
3. Enter email: `test_pro@example.com` (or any email)
4. Click "Save Email"
5. Select "Pro" plan
6. Click "Set Plan"
7. Wait for "Plan set and synced!" alert

---

## Testing Checklist

### ✅ Phase 1: Server URL Configuration
**What to test:** Server URL auto-detection

**Steps:**
1. Check server is running on `localhost:3000`
2. Extension should connect automatically
3. Check console for errors (should be none)

**Expected:** Extension connects to server without errors

---

### ✅ Phase 2: AI Classification (Pro Users Only)

#### Test 2.1: Search Classification
**Steps:**
1. Set plan to "Pro" in dev panel
2. Go to YouTube search: `https://www.youtube.com/results?search_query=celebrity+gossip`
3. Check dev panel (bottom right) - should show AI classification
4. Check server logs - should show AI classification request

**Expected:**
- Dev panel shows: `Category: distracting`, `Confidence: X%`, `Reason: ...`, `Tags: ...`
- Server logs show: `[AI Classify] celebrity gossip... → distracting`

#### Test 2.2: Video Classification
**Steps:**
1. Stay on Pro plan
2. Click any video (watch page)
3. Check dev panel - should show AI classification for video title
4. Check server logs - should show AI classification request

**Expected:**
- Dev panel shows AI classification for video
- Category, confidence, reason, tags all displayed

#### Test 2.3: AI Prompt System
**Steps:**
1. Check server logs on startup
2. Should see: `✅ Loaded AI classifier prompt v1.0.0`

**Expected:**
- Prompt loads from JSON file
- Uses structured JSON output from OpenAI

---

### ✅ Phase 3: Video Time Tracking & Allowance

#### Test 3.1: Distracting Video Tracking
**Steps:**
1. Set plan to "Pro"
2. Search for distracting content (e.g., "celebrity gossip")
3. Click a video that's classified as "distracting"
4. Watch for 30 seconds
5. Navigate away (click another video or go to home)
6. Check dev panel - allowance should be decremented

**Expected:**
- Video starts tracking when you enter WATCH page
- Time tracked correctly (30 seconds)
- `allowance_seconds_left` decrements by 30 seconds
- Check storage: `ft_allowance_seconds_left` should decrease

#### Test 3.2: Allowance Display
**Steps:**
1. Watch a distracting video
2. Check dev panel - should show remaining allowance
3. Watch another distracting video
4. Allowance should continue decreasing

**Expected:**
- Allowance decrements correctly
- Can see remaining allowance in dev panel

#### Test 3.3: Blocking When Allowance Used
**Steps:**
1. Reset counters (dev panel)
2. Watch distracting videos until allowance reaches 0
3. Try to watch another distracting video
4. Should be blocked

**Expected:**
- Blocked when `allowance_seconds_left <= 0`
- Shows block overlay
- Can't watch more distracting content

---

### ✅ Phase 4: Visual Feedback

#### Test 4.1: Distracting Content Popup
**Steps:**
1. Set plan to "Pro"
2. Search for distracting content
3. Click a distracting video
4. Popup should appear

**Expected:**
- Popup shows: "⚠️ This content is not aligned with your goals"
- Shows classification reason
- Shows allowance impact
- Shows remaining allowance
- Buttons: "Go Back" and "Continue"
- Video is paused and muted

#### Test 4.2: Popup Actions
**Steps:**
1. When popup appears, click "Go Back"
2. Should redirect to YouTube home
3. Try again, click "Continue"
4. Should dismiss popup and restore video

**Expected:**
- "Go Back" redirects to home
- "Continue" dismisses popup and restores video

#### Test 4.3: Dev Panel AI Classification Box
**Steps:**
1. Open dev panel (bottom right)
2. Search or watch a video
3. Check AI Classification box in dev panel

**Expected:**
- Shows category (with color: green/yellow/red)
- Shows confidence (percentage)
- Shows reason
- Shows tags (comma-separated)
- Shows action_hint and block_reason_code
- Shows allowance_cost
- Updates in real-time

---

### ✅ Phase 5: Server URL Configuration

#### Test 5.1: Auto-Detection
**Steps:**
1. Server running on `localhost:3000`
2. Extension should connect automatically
3. Check console for connection errors

**Expected:**
- No connection errors
- Extension connects to `http://localhost:3000`

---

## Troubleshooting

### Server Won't Start
**Error:** `EADDRINUSE: address already in use :::3000`
**Fix:**
```bash
lsof -i :3000
kill -9 <PID>
npm run dev
```

### Extension Not Connecting
**Error:** "Failed to get navigation decision"
**Fix:**
1. Check server is running
2. Check server URL in extension (should be `http://localhost:3000`)
3. Reload extension
4. Reload YouTube page

### AI Classification Not Working
**Error:** Dev panel shows "No classification yet"
**Check:**
1. Plan is set to "Pro" (not "Free")
2. Email is set in dev panel
3. Server has `OPENAI_API_KEY` set (optional - will return neutral if not set)
4. Check server logs for errors

### Popup Not Showing
**Error:** Distracting content but no popup
**Check:**
1. Content must be classified as "distracting"
2. Must have allowance available (`allowanceVideosLeft > 0` or `allowanceSecondsLeft > 0`)
3. `action_hint` must be "soft-warn" or not "block"
4. Content must not be blocked (if blocked, shows overlay instead)

---

## Quick Test Script

### Minimal Test (No OpenAI Key Needed)
1. Start server: `cd server && npm run dev`
2. Load extension
3. Set email and plan (Pro) in dev panel
4. Search for any query
5. Check dev panel - should show AI classification (category: neutral, confidence: 0.5)
6. Watch a video
7. Check dev panel - should show video classification

### Full Test (With OpenAI Key)
1. Add `OPENAI_API_KEY=sk-...` to `server/.env`
2. Start server
3. Load extension
4. Set Pro plan
5. Search: "celebrity gossip" → Should classify as distracting
6. Search: "python tutorial" → Should classify as productive
7. Watch distracting video → Popup should appear
8. Check allowance decrements

---

## What to Check in Console

### Extension Console (Chrome DevTools)
- `[FT content] background response:` - Should show full response with AI classification
- `[FT] AI Search Classification:` - Should show search classification
- `[FT] AI Watch Classification:` - Should show video classification
- `[FT] Started tracking distracting video:` - Should show when tracking starts

### Server Console
- `✅ Loaded AI classifier prompt v1.0.0` - Prompt loaded successfully
- `[AI Classify] ... → distracting` - Classification working
- `[Stripe Webhook] Event received:` - Webhook working (if testing payments)

---

## Next Steps After Testing

1. **If everything works:** Proceed to Stripe fixes
2. **If AI not working:** Check OpenAI API key
3. **If popup not showing:** Check allowance and action_hint
4. **If dev panel not updating:** Check storage keys

