# Phase 2.5: Channel Blocking - Test Guide

**What we're testing:** Hard channel blocking feature - users can block specific channels, which are immediately redirected (no overlay). Blocking works from watch pages and Settings UI.

---

## 🚀 Quick Start (Do These First!)

1. **Test Block Button Appears** (YouTube) - 1 minute
   - Go to any YouTube video
   - Should see red "Block Channel" button near channel name

2. **Test Blocking Works** (YouTube) - 2 minutes
   - Click "Block Channel" → Confirm → Should redirect

3. **Test Settings UI** (Website) - 2 minutes
   - Go to Settings → Controls → Blocked Channels
   - Should see list of blocked channels

**If all 3 work → Core feature is working! ✅**

---

## Pre-Test Checklist

Before starting, make sure:
- ✅ You're logged in (extension shows your email)
- ✅ Backend is running (or deployed)
- ✅ Extension is loaded and active
- ✅ You're on a YouTube watch page

---

## Test 1: Block Channel Button Appears (2 minutes)

### Step 1: Navigate to a YouTube video

1. **Go to YouTube** (https://www.youtube.com)
2. **Search for any channel** (e.g., "Eddie Hall" or "Jeff Nippard")
3. **Click on a video** from that channel
4. **Wait 2-3 seconds** for page to fully load

### Step 2: Check for button

1. **Look near the channel name** (below video title, next to subscribe button)
2. **Should see:** Red "Block Channel" button
3. **If button doesn't appear:**
   - Open browser console (F12)
   - Check for errors
   - Try refreshing the page
   - Check console for: `[FT] Metadata extracted:` log (should show channel name)

### ✅ **Expected Result:**
- Red "Block Channel" button appears next to channel name
- Button is visible and clickable

---

## Test 2: Block Channel with Confirmation (3 minutes)

### Step 1: Click "Block Channel" button

1. **Click the red "Block Channel" button**
2. **Video should pause** (confirmation dialog appears)

### Step 2: Confirm in dialog

1. **Should see confirmation dialog:**
   - Title: "Block Channel?"
   - Message: "Well done! Eliminating distractions helps you stay focused."
   - Channel name displayed: "Block '[Channel Name]'?"
   - Two buttons: "Cancel" and "Block Channel"
2. **Click "Block Channel"** (confirm button)

### Step 3: Verify blocking

1. **Page should reload/redirect**
2. **Check browser console:**
   - Should see: `[FT] ✅ Channel blocked: [Channel Name]`
   - Should see: `[FT] Blocked channel saved to server: [Channel Name]`
3. **Check extension storage:**
   ```javascript
   chrome.storage.local.get(['ft_blocked_channels'], console.log);
   ```
   - Should show channel in array: `{ft_blocked_channels: ["Eddie Hall"]}`

### ✅ **Expected Result:**
- Confirmation dialog shows with positive message
- Channel added to blocklist
- Page reloads/redirects
- Channel saved to storage and server

---

## Test 3: Hard Redirect Works (2 minutes)

### Step 1: Try to access blocked channel

1. **Go to YouTube home** (https://www.youtube.com)
2. **Search for the blocked channel name**
3. **Click on any video** from that channel

### Step 2: Verify redirect

1. **Should immediately redirect** to YouTube home (`https://www.youtube.com/`)
2. **No overlay, no pause** - just instant redirect
3. **Check browser console:**
   - Should see: `[FT] Channel blocked:` log from background script

### ✅ **Expected Result:**
- Instant redirect to YouTube home
- No overlay shown
- No pause - just gone

---

## Test 4: Cancel Blocking (1 minute)

### Step 1: Try blocking again (different channel)

1. **Go to a different channel's video** (one you haven't blocked)
2. **Click "Block Channel"**
3. **In confirmation dialog, click "Cancel"**

### Step 2: Verify no blocking

1. **Dialog should close**
2. **Video should resume** (if it was playing)
3. **Channel should NOT be in blocklist**
4. **Check storage:**
   ```javascript
   chrome.storage.local.get(['ft_blocked_channels'], console.log);
   ```
   - Should NOT include this channel

### ✅ **Expected Result:**
- Cancel button works
- Dialog closes
- Channel not blocked
- Video continues normally

---

## Test 5: Settings Page - View Blocked Channels (2 minutes)

### Step 1: Open Settings

1. **Go to FocusTube website** (https://focustube-beta.vercel.app or localhost)
2. **Navigate to Settings** (top menu or /app/settings)
3. **Click "Controls" tab**
4. **Scroll down** to "Blocked Channels" card

### Step 2: Verify list loads

1. **Should see "Blocked Channels" card:**
   - Title: "Blocked Channels"
   - Description: "Well done! Eliminating distractions helps you stay focused. Blocked channels will be automatically redirected."
   - Input field with "Add" button
   - List of blocked channels (if any)
2. **Each channel should have:**
   - Channel name displayed
   - X button to remove
3. **If empty:** Should show "No channels blocked yet"

### ✅ **Expected Result:**
- Blocked channels list displays correctly
- Shows all previously blocked channels
- UI is clean and functional

---

## Test 6: Settings Page - Add Channel (2 minutes)

### Step 1: Add channel manually

1. **In Settings → Blocked Channels card**
2. **Type a channel name** in input field (e.g., "Test Channel")
3. **Click "Add" button** or press Enter

### Step 2: Verify addition

1. **Should see success toast:**
   - Title: "Channel blocked"
   - Description: "Well done! Eliminating distractions helps you stay focused."
2. **Channel should appear in list** below input
3. **Input field should clear**

### Step 3: Verify it works

1. **Go to YouTube**
2. **Try to watch a video** from that channel
3. **Should redirect immediately**

### ✅ **Expected Result:**
- Channel added via Settings
- Toast notification shows
- Channel appears in list
- Blocking works immediately

---

## Test 7: Settings Page - Remove Channel (2 minutes)

### Step 1: Remove channel

1. **In Settings → Blocked Channels**
2. **Find a channel** in the list
3. **Click the X button** next to it

### Step 2: Verify removal

1. **Should see toast:**
   - Title: "Channel unblocked"
   - Description: "Channel removed from blocklist"
2. **Channel should disappear** from list
3. **Check backend** (optional):
   - Query Supabase `extension_data` table
   - Channel should be removed from `blocked_channels` array

### Step 3: Verify unblocking works

1. **Go to YouTube**
2. **Try to watch a video** from that channel
3. **Should NOT redirect** (video should play normally)

### ✅ **Expected Result:**
- Channel removed from list
- Toast notification shows
- Can access channel again
- No redirect when visiting

---

## Test 8: Case Insensitivity (2 minutes)

### Step 1: Test different cases

1. **Block "Eddie Hall"** (exact case from video)
2. **Try to access "eddie hall"** (lowercase)
3. **Try to access "EDDIE HALL"** (uppercase)
4. **Try to access "Eddie hall"** (mixed case)

### Step 2: Verify all blocked

1. **All variations should redirect**
2. **Check console logs** to verify case-insensitive matching
3. **Settings should show** original case (as stored)

### ✅ **Expected Result:**
- All case variations are blocked
- Matching is case-insensitive
- Original case preserved in Settings

---

## Test 9: Persistence Across Reloads (2 minutes)

### Step 1: Block a channel

1. **Block a channel** (via button or Settings)
2. **Reload extension:**
   - Go to `chrome://extensions`
   - Find FocusTube extension
   - Click reload button
3. **Reload YouTube page** (F5)

### Step 2: Verify still blocked

1. **Try to access blocked channel**
2. **Should still redirect**
3. **Check storage:**
   ```javascript
   chrome.storage.local.get(['ft_blocked_channels'], console.log);
   ```
   - Should still have blocked channels
4. **Check Settings page:**
   - Should still show blocked channels in list

### ✅ **Expected Result:**
- Blocklist persists after extension reload
- Blocklist persists after page reload
- Data synced to Supabase

---

## Test 10: Multiple Channels (2 minutes)

### Step 1: Block multiple channels

1. **Block 3-4 different channels:**
   - Use "Block Channel" button on different videos
   - Or add via Settings
2. **Check Settings → Blocked Channels**
   - Should see all in list

### Step 2: Verify all work

1. **Try accessing each blocked channel**
2. **All should redirect immediately**
3. **Check storage:**
   ```javascript
   chrome.storage.local.get(['ft_blocked_channels'], console.log);
   ```
   - Should show array with all channels

### ✅ **Expected Result:**
- Multiple channels can be blocked
- All appear in Settings list
- All redirect correctly

---

## Test 11: Button Doesn't Appear for Blocked Channels (1 minute)

### Step 1: Check blocked channel page

1. **Go to a blocked channel's video**
2. **Should NOT see "Block Channel" button**
   - Channel already blocked, so button shouldn't appear
3. **Should redirect immediately** instead

### Step 2: Verify logic

1. **Check console:**
   - Should see redirect happening
   - Should NOT see button injection attempts

### ✅ **Expected Result:**
- No button on already-blocked channels
- Redirect happens immediately
- No duplicate blocking

---

## Test 12: Settings - Duplicate Prevention (1 minute)

### Step 1: Try to add duplicate

1. **In Settings → Blocked Channels**
2. **Try to add a channel** that's already blocked
3. **Click "Add"**

### Step 2: Verify prevention

1. **Should see toast:**
   - Title: "Already blocked"
   - Description: "This channel is already in your blocklist"
2. **Channel should NOT be added twice**
3. **List should remain unchanged**

### ✅ **Expected Result:**
- Duplicate channels prevented
- User-friendly error message
- No duplicate entries

---

## Quick Test Summary

**Must Pass (Core Features):**
- ✅ Test 1: Button appears
- ✅ Test 2: Blocking works with confirmation
- ✅ Test 3: Hard redirect works
- ✅ Test 5: Settings shows blocked channels
- ✅ Test 6: Settings can add channels
- ✅ Test 7: Settings can remove channels
- ✅ Test 9: Persistence works

**Nice to Have (Edge Cases):**
- ✅ Test 4: Cancel works
- ✅ Test 8: Case insensitivity
- ✅ Test 10: Multiple channels
- ✅ Test 11: Button logic
- ✅ Test 12: Duplicate prevention

---

## If Tests Fail

### Button doesn't appear:
- Check console for errors
- Verify channel name is extracted: Look for `[FT] Metadata extracted:` log
- Try refreshing page
- Check YouTube hasn't changed DOM structure
- Verify `injectBlockChannelButton()` is being called

### Redirect doesn't work:
- Check console: Should see `[FT] Channel blocked:` log from background
- Verify `resp.scope === "watch" && resp.reason === "channel_blocked"`
- Check background.js is returning correct response
- Verify channel is actually in `ft_blocked_channels` array

### Settings doesn't load/save:
- Check browser console for API errors
- Verify backend is running: `curl "https://focustube-backend-4xah.onrender.com/health"`
- Check Supabase table `extension_data` has your data
- Verify user email is correct: `supabase.auth.getUser()`
- Check network tab for failed requests

### Channel not blocked after adding:
- Check storage: `chrome.storage.local.get(['ft_blocked_channels'])`
- Check Supabase: Query `extension_data` table
- Verify case-insensitive matching is working
- Check background.js channel check logic

### Confirmation dialog doesn't show:
- Check console for errors
- Verify `showBlockChannelConfirmation()` is called
- Check overlay CSS is loaded
- Verify video pause/resume functions work

---

## Success Criteria

**Phase 2.5 is complete when:**
- ✅ Block Channel button appears on watch pages
- ✅ Confirmation dialog shows with positive message
- ✅ Blocked channels redirect instantly (no overlay)
- ✅ Settings can add/remove channels
- ✅ Blocklist persists across reloads
- ✅ All data syncs to Supabase
- ✅ Case-insensitive matching works
- ✅ Multiple channels can be blocked

---

## Next Steps After Testing

Once all tests pass:
1. Update `Plan.md` - mark Phase 2.5 as complete
2. Update `WHERE_WE_AT.md` - note channel blocking is done
3. Consider Phase 3: API Calls & Classifier (if ready)

---

*Last Updated: 2025-01-16*

