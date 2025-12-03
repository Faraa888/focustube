# FocusTube Manual Test Plan

**Purpose:** Comprehensive manual testing checklist for all FocusTube behaviors  
**Date:** 2025-11-30  
**Status:** Ready for execution

---

## How to Use This Document

1. **Before Testing:**
   - Reload extension: `chrome://extensions` → FocusTube → Reload
   - Open background console: `chrome://extensions` → Inspect views → `background/background.html`
   - Open YouTube page console: F12 on any YouTube page
   - Have Supabase dashboard open to verify data writes

2. **During Testing:**
   - Mark each test as ✅ PASS or ❌ FAIL
   - Add notes for any unexpected behavior
   - Note console errors or warnings
   - Verify Supabase data changes where applicable

3. **Test Accounts Needed:**
   - Free plan account
   - Pro/Trial plan account
   - Test with both accounts separately

---

## A. Auth & Identity

### A1. Web Login Flow
**Goal:** Verify user can log in via website and session persists

**Preconditions:**
- User is logged out
- Browser is open

**Steps:**
1. Navigate to `https://focustube-beta.vercel.app/app/login`
2. Enter email and password
3. Click "Sign In"
4. Wait for redirect to dashboard
5. Close browser tab
6. Reopen browser and navigate to dashboard URL

**Expected:**
- Login succeeds and redirects to dashboard
- User remains logged in after closing/reopening browser
- Dashboard shows user's data

**Observe:**
- Network tab: Check for successful auth requests
- Console: No auth errors
- Supabase: User session exists

---

### A2. Extension Popup Login Flow
**Goal:** Verify user can log in via extension popup

**Preconditions:**
- Extension installed
- User is logged out
- Click extension icon to open popup

**Steps:**
1. Click FocusTube extension icon
2. Click "Log In" or "Sign In" button in popup
3. Enter email and password in popup
4. Submit login form
5. Wait for popup to update

**Expected:**
- Popup shows login form
- After login, popup shows user info and "Manage Account" button
- Extension storage contains user email: `chrome.storage.local.get(["ft_user_email"])`

**Observe:**
- Popup UI updates correctly
- Extension storage: `ft_user_email` is set
- Console: No auth errors

---

### A3. Web Logged In + Extension Logged Out
**Goal:** Verify extension can detect web login state

**Preconditions:**
- User is logged in on website
- Extension popup shows logged out state

**Steps:**
1. Log in on website (`/app/login`)
2. Open extension popup
3. Check if popup shows logged in state
4. If not, click "Sync" or refresh button in popup
5. Check popup again

**Expected:**
- Extension popup eventually shows logged in state
- Extension storage contains user email
- Extension can access user's plan and settings

**Observe:**
- Popup UI state
- Extension storage: `ft_user_email`, `ft_plan`
- Console: Check for sync messages

---

### A4. Extension Logged In + Web Logged Out
**Goal:** Verify website can detect extension login state

**Preconditions:**
- User is logged in via extension popup
- Website shows logged out state

**Steps:**
1. Log in via extension popup
2. Navigate to website dashboard
3. Check if website shows logged in state
4. If not, refresh page
5. Check website again

**Expected:**
- Website eventually shows logged in state
- Dashboard loads user data
- Settings page shows user's settings

**Observe:**
- Website UI state
- Network: Check for auth requests
- Console: Check for session errors

---

### A5. Session Expiry During YouTube Watch
**Goal:** Verify extension handles expired sessions gracefully

**Preconditions:**
- User is logged in
- YouTube video is playing
- Timer is tracking

**Steps:**
1. Start watching a video (timer should be incrementing)
2. Manually expire session in Supabase (or wait for natural expiry)
3. Continue watching for 1-2 minutes
4. Check if timer still increments
5. Check if AI classification still works
6. Try to block a channel

**Expected:**
- Timer continues tracking (uses cached plan)
- AI classification may fail gracefully (returns neutral)
- Block channel may fail but doesn't crash extension
- Extension should attempt to refresh session on next action

**Observe:**
- Console: Check for session expiry errors
- Timer: Still increments
- Network: Check for failed auth requests

---

### A6. Identity Check Before Data Writes
**Goal:** Verify correct user identity is used for all write operations

**Preconditions:**
- Two test accounts available (Account A and Account B)
- Account A is logged in

**Steps:**
1. Log in as Account A
2. Watch a video (should write to Account A's data)
3. Block a channel (should save to Account A's blocked list)
4. Log out
5. Log in as Account B
6. Watch a video (should write to Account B's data)
7. Block a channel (should save to Account B's blocked list)
8. Check Supabase: Verify Account A's data is separate from Account B's

**Expected:**
- All writes go to correct user account
- No data mixing between accounts
- Supabase shows correct user_id for all records

**Observe:**
- Supabase: Check `user_id` field in all tables
- Console: Check for user_id in API requests
- Extension storage: `ft_user_email` matches logged-in account

---

## B. Blocked Channels

### B1. First-Time Block Channel Setup
**Goal:** Verify blocking a channel for the first time works correctly

**Preconditions:**
- User is logged in (Pro/Trial)
- On a YouTube video page
- No channels blocked yet

**Steps:**
1. Navigate to any YouTube video
2. Wait for "Block Channel" button to appear (Pro/Trial only)
3. Click "Block Channel" button
4. Confirm in popup dialog
5. Wait 2-3 seconds
6. Check extension storage: `chrome.storage.local.get(["ft_blocked_channels"])`
7. Check Supabase: Query `extension_data` table for user's blocked_channels

**Expected:**
- Block Channel button appears (Pro/Trial only, not Free)
- Confirmation dialog appears
- After confirm, channel is added to local storage
- Channel is saved to Supabase within 5 seconds
- Video is paused/blocked immediately

**Observe:**
- UI: Button appears, dialog shows, video pauses
- Extension storage: `ft_blocked_channels` array contains channel name
- Supabase: `extension_data.blocked_channels` JSON array contains channel
- Console: Check for save success/failure messages

---

### B2. Block Channel Persists After Refresh
**Goal:** Verify blocked channels survive page refresh

**Preconditions:**
- At least one channel is blocked (from B1)

**Steps:**
1. Block a channel (if not already done)
2. Refresh YouTube page (F5)
3. Check if channel is still blocked
4. Try to navigate to a video from that blocked channel
5. Check if overlay appears

**Expected:**
- Blocked channel list persists after refresh
- Navigating to blocked channel shows overlay
- Channel remains in extension storage
- Channel remains in Supabase

**Observe:**
- Extension storage: `ft_blocked_channels` still contains channel
- Supabase: Channel still in database
- UI: Overlay appears when accessing blocked channel

---

### B3. Block Channel Persists After Browser Restart
**Goal:** Verify blocked channels survive browser close/reopen

**Preconditions:**
- At least one channel is blocked

**Steps:**
1. Block a channel
2. Verify it's in Supabase
3. Close browser completely
4. Reopen browser
5. Navigate to YouTube
6. Check extension storage: `chrome.storage.local.get(["ft_blocked_channels"])`
7. Try to access blocked channel video

**Expected:**
- Extension loads blocked channels from Supabase on startup
- Blocked channel list is restored
- Accessing blocked channel shows overlay

**Observe:**
- Extension storage: Channels loaded from server
- Console: Check for "Loading extension data from server" message
- UI: Overlay appears for blocked channel

---

### B4. Add Channel from Website Settings
**Goal:** Verify blocking from website works and syncs to extension

**Preconditions:**
- User is logged in on website
- Extension is installed and logged in

**Steps:**
1. Navigate to `/app/settings`
2. Scroll to "Blocked Channels" section
3. Enter a channel name in input field
4. Click "Add" or press Enter
5. Wait 2-3 seconds
6. Check Supabase: Verify channel is saved
7. Refresh YouTube page (or wait for sync)
8. Check extension storage: `chrome.storage.local.get(["ft_blocked_channels"])`
9. Try to access a video from that channel

**Expected:**
- Channel is added to website list
- Channel is saved to Supabase
- Extension syncs channel within 30 seconds (or on next navigation)
- Accessing channel shows overlay

**Observe:**
- Website UI: Channel appears in list
- Supabase: Channel in database
- Extension storage: Channel appears after sync
- Console: Check for `FT_RELOAD_SETTINGS` message

---

### B5. Remove Channel from Extension
**Goal:** Verify unblocking a channel works

**Preconditions:**
- At least one channel is blocked

**Steps:**
1. Navigate to a video from a blocked channel (overlay should appear)
2. If overlay has "Unblock" option, click it
3. OR: Use extension popup/settings to remove channel
4. Wait 2-3 seconds
5. Check extension storage
6. Check Supabase
7. Try to access channel video again

**Expected:**
- Channel is removed from blocked list
- Channel is removed from Supabase
- User can now access channel videos normally

**Observe:**
- Extension storage: Channel removed from array
- Supabase: Channel removed from database
- UI: No overlay when accessing channel

---

### B6. Backend Fails During Load
**Goal:** Verify extension handles server failure gracefully when loading blocked channels

**Preconditions:**
- User has blocked channels in Supabase
- Simulate server failure (disable network or block API endpoint)

**Steps:**
1. Block a channel (should be in Supabase)
2. Disable network or block API endpoint
3. Reload extension (or restart browser)
4. Check extension storage: `chrome.storage.local.get(["ft_blocked_channels"])`
5. Try to access blocked channel video

**Expected:**
- Extension uses cached/local blocked channels if server fails
- Blocked channels still work (from local storage)
- Extension retries server sync when network is restored
- No data loss

**Observe:**
- Extension storage: Channels still present
- Console: Check for server error messages
- UI: Blocking still works from local data

---

### B7. Backend Fails During Save
**Goal:** Verify extension handles save failure gracefully

**Preconditions:**
- User is logged in
- Network is working

**Steps:**
1. Block a channel
2. Immediately disable network (or block API endpoint)
3. Check extension storage: Is channel saved locally?
4. Wait 30 seconds
5. Re-enable network
6. Check if channel syncs to server
7. Check Supabase: Is channel in database?

**Expected:**
- Channel is saved to local storage immediately
- Extension retries saving to server when network is restored
- Channel eventually appears in Supabase
- No data loss

**Observe:**
- Extension storage: Channel saved locally
- Console: Check for retry messages
- Supabase: Channel appears after network restore

---

### B8. Save When List Didn't Load Properly
**Goal:** Verify extension doesn't wipe existing channels when server returns empty/null

**Preconditions:**
- User has blocked channels locally
- Simulate server returning empty array

**Steps:**
1. Block 2-3 channels (verify they're in local storage)
2. Manually set server to return empty array for blocked_channels (or modify server code temporarily)
3. Trigger extension data sync (navigate to new video or wait for auto-sync)
4. Check extension storage: `chrome.storage.local.get(["ft_blocked_channels"])`
5. Check Supabase: Are channels still there?

**Expected:**
- Extension merges local and server data (doesn't overwrite with empty)
- Existing blocked channels are preserved
- No data loss

**Observe:**
- Extension storage: Channels still present
- Supabase: Channels still in database
- Console: Check for merge logic messages

---

### B9. Block Channel from Extension + Website Simultaneously
**Goal:** Verify no conflicts when blocking from both places at once

**Preconditions:**
- User is logged in on both extension and website
- Two different channels to block

**Steps:**
1. On website: Block Channel A
2. Immediately (within 2 seconds) on extension: Block Channel B
3. Wait 5 seconds
4. Check extension storage: Both channels present?
5. Check Supabase: Both channels present?
6. Refresh website: Both channels in list?

**Expected:**
- Both channels are saved
- No conflicts or overwrites
- Both appear in extension and website
- Supabase contains both channels

**Observe:**
- Extension storage: Both channels in array
- Supabase: Both channels in database
- Website: Both channels in list
- Console: Check for any conflict errors

---

### B10. Playing Blocked vs Non-Blocked Channels
**Goal:** Verify blocking actually prevents access

**Preconditions:**
- At least one channel is blocked
- At least one channel is not blocked

**Steps:**
1. Navigate to a video from a blocked channel
2. Observe overlay/blocking behavior
3. Navigate to a video from a non-blocked channel
4. Observe normal playback

**Expected:**
- Blocked channel: Overlay appears, video doesn't play (or plays briefly then pauses)
- Non-blocked channel: Video plays normally, no overlay

**Observe:**
- UI: Overlay appears for blocked, normal playback for non-blocked
- Console: Check for blocking logic messages

---

## C. Watch Time Tracking

### C1. Normal Playback Increments Correctly
**Goal:** Verify timer counts seconds accurately during normal video playback

**Preconditions:**
- User is logged in
- On a YouTube video page
- Video is ready to play

**Steps:**
1. Note current watch time: `chrome.storage.local.get(["ft_watch_seconds_today"])`
2. Start playing video
3. Let video play for exactly 60 seconds (use stopwatch)
4. Pause video
5. Check watch time: `chrome.storage.local.get(["ft_watch_seconds_today"])`
6. Calculate difference

**Expected:**
- Watch time increases by approximately 60 seconds (allow ±2 seconds for timing)
- Timer increments every second while video is playing
- Console shows `[FT TIMER INCREMENT]` logs every 5 seconds

**Observe:**
- Extension storage: `ft_watch_seconds_today` increases
- Console: Timer increment logs
- Math: Difference ≈ 60 seconds

---

### C2. Pause Stops Timer
**Goal:** Verify timer stops when video is paused

**Preconditions:**
- Video is playing
- Timer is incrementing

**Steps:**
1. Start video playback
2. Let play for 10 seconds
3. Pause video
4. Wait 30 seconds (video paused)
5. Check watch time
6. Resume video
7. Let play for 10 more seconds
8. Check watch time again

**Expected:**
- Timer stops when video is paused (no increment during pause)
- Timer resumes when video resumes
- Total time = 20 seconds (not 40 seconds)

**Observe:**
- Extension storage: Time only increases during playback
- Console: Check for pause detection logs

---

### C3. Seek Doesn't Add Extra Time
**Goal:** Verify seeking doesn't double-count time

**Preconditions:**
- Video is playing

**Steps:**
1. Start video at beginning
2. Let play for 30 seconds
3. Seek back to beginning
4. Let play for 30 more seconds
5. Check total watch time

**Expected:**
- Total watch time ≈ 60 seconds (not 90+ seconds)
- Seeking doesn't reset or double-count time

**Observe:**
- Extension storage: Time is accurate
- Console: No weird time jumps

---

### C4. Autoplay Next Video Continues Tracking
**Goal:** Verify timer continues across autoplay transitions

**Preconditions:**
- Video is playing
- Autoplay is enabled

**Steps:**
1. Start video playback
2. Let play for 30 seconds
3. Let video autoplay to next video
4. Let next video play for 30 seconds
5. Check total watch time

**Expected:**
- Timer continues counting across video transitions
- Total time ≈ 60 seconds
- No reset or gap in tracking

**Observe:**
- Extension storage: Time accumulates correctly
- Console: Check for navigation handling

---

### C5. Tab Hidden / Switched / Minimized
**Goal:** Verify timer behavior when tab is not visible

**Preconditions:**
- Video is playing
- Timer is incrementing

**Steps:**
1. Start video playback
2. Let play for 10 seconds
3. Switch to different tab (YouTube tab hidden)
4. Wait 30 seconds (tab hidden, but audio may still play)
5. Switch back to YouTube tab
6. Check watch time

**Expected:**
- If audio is playing: Timer may continue (background playback)
- If audio is paused: Timer stops
- Time should reflect actual playback, not just tab visibility

**Observe:**
- Extension storage: Time reflects actual playback
- Console: Check for tab visibility detection

---

### C6. Multiple YouTube Tabs Open
**Goal:** Verify timer tracks correctly with multiple tabs

**Preconditions:**
- Two YouTube tabs open
- Both have videos ready

**Steps:**
1. Open YouTube tab 1, start video
2. Let play for 20 seconds
3. Open YouTube tab 2, start video
4. Let play for 20 seconds (tab 2)
5. Switch back to tab 1, let play for 20 seconds
6. Check total watch time

**Expected:**
- Timer tracks time from active/playing tab
- Total time ≈ 60 seconds (sum of all playback)
- No double-counting

**Observe:**
- Extension storage: Time is sum of all playback
- Console: Check for tab switching logic

---

### C7. Laptop Sleep/Wake (Same Day)
**Goal:** Verify no "ghost time" added during sleep

**Preconditions:**
- Video is playing
- Timer is incrementing
- Current time: 2:00 PM (example)

**Steps:**
1. Start video playback
2. Let play for 30 seconds
3. Note watch time
4. Close laptop lid (sleep)
5. Wait 5 minutes (laptop asleep)
6. Open laptop lid (wake)
7. Check watch time immediately
8. Let video play for 30 more seconds
9. Check watch time again

**Expected:**
- Watch time doesn't increase during sleep
- After wake, time is same as before sleep
- Timer resumes correctly when video plays again
- Total time ≈ 60 seconds (not 5+ minutes)

**Observe:**
- Extension storage: No time jump during sleep
- Console: Check for sleep detection logs

---

### C8. Overnight with YouTube Tab Open
**Goal:** Verify day rollover resets timer correctly

**Preconditions:**
- Video is playing
- Current time: 11:55 PM (or simulate day change)
- Watch time: 30 minutes accumulated

**Steps:**
1. Start video playback at 11:55 PM
2. Let play until 12:05 AM (next day)
3. Check `ft_last_reset_key` in storage
4. Check `ft_watch_seconds_today` in storage
5. Let video play for 60 more seconds
6. Check watch time again

**Expected:**
- At midnight (or day change), `ft_last_reset_key` updates to new date
- `ft_watch_seconds_today` resets to 0 (or very low)
- Timer starts counting from 0 for new day
- Previous day's time is preserved in history (not lost)

**Observe:**
- Extension storage: Reset key changes, timer resets
- Console: Check for daily reset logs
- Supabase: Previous day's data is saved

---

### C9. Rapid Video Switching
**Goal:** Verify timer handles quick navigation correctly

**Preconditions:**
- Multiple videos ready to watch

**Steps:**
1. Start video 1, play for 5 seconds
2. Navigate to video 2, play for 5 seconds
3. Navigate to video 3, play for 5 seconds
4. Navigate to video 4, play for 5 seconds
5. Check total watch time

**Expected:**
- Timer continues counting across rapid switches
- Total time ≈ 20 seconds
- No gaps or resets

**Observe:**
- Extension storage: Time accumulates correctly
- Console: Check for navigation handling

---

### C10. Network Temporarily Drops
**Goal:** Verify timer continues during network outage

**Preconditions:**
- Video is playing
- Timer is incrementing

**Steps:**
1. Start video playback
2. Let play for 10 seconds
3. Disable network (WiFi off or airplane mode)
4. Let play for 30 seconds (offline)
5. Re-enable network
6. Check watch time
7. Check if time syncs to server

**Expected:**
- Timer continues counting offline (local storage)
- Watch time is preserved
- When network returns, time syncs to server
- No data loss

**Observe:**
- Extension storage: Time continues incrementing
- Console: Check for sync retry messages
- Supabase: Time appears after network restore

---

## D. Daily Limit Enforcement

### D1. Approaching Limit (UI Warnings)
**Goal:** Verify user sees warnings as they approach daily limit

**Preconditions:**
- Daily limit set to 30 minutes (for faster testing)
- Current watch time: 0 minutes

**Steps:**
1. Set daily limit to 30 minutes in settings
2. Start watching videos
3. Watch until 25 minutes accumulated
4. Check for warning overlay/nudge
5. Continue watching until 29 minutes
6. Check for stronger warning

**Expected:**
- Warning appears at 80-90% of limit (e.g., 24-27 minutes)
- Warning is clear and visible
- User can still watch but is aware of limit

**Observe:**
- UI: Warning overlay/nudge appears
- Console: Check for limit warning logs

---

### D2. Hitting Exact Limit Mid-Video
**Goal:** Verify limit enforcement when reached during video playback

**Preconditions:**
- Daily limit set to 5 minutes (for faster testing)
- Current watch time: 4 minutes 50 seconds

**Steps:**
1. Set daily limit to 5 minutes
2. Watch until 4:50 accumulated
3. Continue playing video
4. Wait for timer to reach exactly 5:00
5. Observe what happens

**Expected:**
- At 5:00, overlay appears blocking further playback
- Video pauses
- Overlay shows "Daily limit reached" message
- Timer stops incrementing

**Observe:**
- UI: Overlay appears, video pauses
- Extension storage: Time is capped at limit
- Console: Check for limit reached logs

---

### D3. Hitting Limit Between Videos
**Goal:** Verify limit enforcement when reached between video navigation

**Preconditions:**
- Daily limit set to 5 minutes
- Current watch time: 4 minutes 55 seconds

**Steps:**
1. Set daily limit to 5 minutes
2. Watch until 4:55 accumulated
3. Navigate to new video
4. Try to play new video
5. Observe what happens

**Expected:**
- Overlay appears preventing new video playback
- User cannot start new videos
- Overlay shows limit message

**Observe:**
- UI: Overlay appears on navigation
- Console: Check for limit check logs

---

### D4. Try to Bypass Limit (New Tab)
**Goal:** Verify limit applies across all YouTube tabs

**Preconditions:**
- Daily limit reached in current tab

**Steps:**
1. Reach daily limit in Tab 1
2. Open new tab
3. Navigate to YouTube in new tab
4. Try to play a video
5. Observe what happens

**Expected:**
- Limit applies to new tab as well
- Overlay appears in new tab
- Cannot bypass by opening new tab

**Observe:**
- UI: Overlay appears in new tab
- Extension storage: Limit is shared across tabs
- Console: Check for limit check in new tab

---

### D5. Try to Bypass Limit (Incognito)
**Goal:** Verify limit doesn't apply in incognito (expected behavior)

**Preconditions:**
- Daily limit reached in normal window

**Steps:**
1. Reach daily limit in normal window
2. Open incognito window
3. Navigate to YouTube
4. Try to play a video
5. Observe what happens

**Expected:**
- Extension may not work in incognito (Chrome default)
- OR: If extension works, limit may be separate (incognito has separate storage)
- This is expected behavior (incognito isolation)

**Observe:**
- UI: Extension behavior in incognito
- Console: Check for extension availability

---

### D6. New Day Reset Logic
**Goal:** Verify limit resets correctly at midnight

**Preconditions:**
- Daily limit reached today
- Current time: 11:55 PM (or simulate day change)

**Steps:**
1. Reach daily limit (e.g., 30 minutes)
2. Wait until midnight (or simulate day change)
3. Check `ft_last_reset_key` in storage
4. Check `ft_watch_seconds_today` in storage
5. Try to play a video
6. Watch for 1 minute
7. Check watch time

**Expected:**
- At midnight, `ft_last_reset_key` updates to new date
- `ft_watch_seconds_today` resets to 0
- User can watch videos again
- Timer starts from 0

**Observe:**
- Extension storage: Reset key changes, timer resets
- Console: Check for daily reset logs
- UI: No limit overlay, videos play

---

### D7. No Carryover from Previous Day
**Goal:** Verify previous day's usage doesn't affect new day

**Preconditions:**
- Yesterday: Watched 29 minutes (under 30 min limit)
- Today: New day started

**Steps:**
1. Simulate day change (or wait for actual midnight)
2. Check `ft_watch_seconds_today` (should be 0)
3. Watch for 1 minute
4. Check watch time (should be ~60 seconds, not 30 minutes + 60 seconds)

**Expected:**
- New day starts at 0 seconds
- Previous day's time doesn't carry over
- Limit applies fresh for new day

**Observe:**
- Extension storage: Timer resets to 0
- Math: No carryover in calculations

---

## E. Distraction Loop Behaviour

### E1. Watching Shorts / Highly Distracting Videos
**Goal:** Verify system detects distraction pattern from Shorts

**Preconditions:**
- User is Pro/Trial (distraction loop is Pro feature)
- No distracting content watched today

**Steps:**
1. Navigate to YouTube Shorts
2. Watch 3-4 Shorts videos (each >30 seconds)
3. Check console for classification logs
4. Check extension storage: `chrome.storage.local.get(["ft_distracting_count_global", "ft_distracting_time_global"])`
5. Continue watching until 20 minutes of distracting content
6. Observe for nudge

**Expected:**
- Shorts are classified as "distracting" (or "neutral" that counts toward distracting)
- Distracting counters increment
- After 3 videos OR 20 minutes: First nudge appears (nudge1)
- Nudge is full-screen overlay (not corner banner)

**Observe:**
- Console: Classification logs show "distracting"
- Extension storage: `ft_distracting_count_global` and `ft_distracting_time_global` increment
- UI: Nudge appears at threshold

---

### E2. Rapid Video Hopping on Home Feed
**Goal:** Verify distraction detection works with rapid navigation

**Preconditions:**
- User is Pro/Trial
- On YouTube home feed

**Steps:**
1. Click on video 1, watch for 10 seconds
2. Navigate back, click video 2, watch for 10 seconds
3. Navigate back, click video 3, watch for 10 seconds
4. Repeat until 3+ videos watched
5. Check distracting counters
6. Observe for nudge

**Expected:**
- Each video is classified
- Distracting videos increment counters
- After 3 distracting videos OR 20 minutes: Nudge appears
- Rapid hopping doesn't break detection

**Observe:**
- Console: Classification for each video
- Extension storage: Counters increment
- UI: Nudge appears

---

### E3. Distraction Pattern Detection Accuracy
**Goal:** Verify system correctly identifies distraction pattern

**Preconditions:**
- User is Pro/Trial
- Mix of productive and distracting content available

**Steps:**
1. Watch 2 productive videos (educational, work-related)
2. Watch 3 distracting videos (entertainment, viral)
3. Check counters: `ft_distracting_count_global` vs `ft_productive_count_global`
4. Observe which nudge appears (if any)

**Expected:**
- Productive videos increment productive counters
- Distracting videos increment distracting counters
- Nudge appears based on distracting threshold (3 videos OR 20 minutes)
- Productive content doesn't trigger distracting nudge

**Observe:**
- Extension storage: Correct counters increment
- Console: Classification logs
- UI: Correct nudge type appears

---

### E4. Distraction Nudge Triggers at Right Time
**Goal:** Verify nudge appears at correct thresholds

**Preconditions:**
- User is Pro/Trial
- No distracting content today

**Steps:**
1. Watch distracting videos until 3 videos OR 20 minutes
2. Check if nudge1 appears
3. Continue watching until 4 videos OR 40 minutes
4. Check if nudge2 appears
5. Continue watching until 5 videos OR 60 minutes
6. Check if break nudge appears

**Expected:**
- Nudge1: At 3 videos OR 20 minutes
- Nudge2: At 4 videos OR 40 minutes
- Break: At 5 videos OR 60 minutes
- Each nudge appears only once per threshold

**Observe:**
- UI: Correct nudge at each threshold
- Console: Threshold logs
- Extension storage: Counters match thresholds

---

### E5. Ignore/Dismiss Nudges Repeatedly
**Goal:** Verify system handles repeated dismissals

**Preconditions:**
- User is Pro/Trial
- Distraction nudge has appeared

**Steps:**
1. Trigger distraction nudge1
2. Click "Continue" or dismiss nudge
3. Continue watching distracting content
4. Trigger nudge1 again (if it can retrigger)
5. Dismiss again
6. Continue until nudge2 threshold
7. Observe behavior

**Expected:**
- Nudges can be dismissed
- System continues tracking
- Next threshold (nudge2) still triggers
- Repeated dismissals don't break system

**Observe:**
- UI: Nudges can be dismissed and retrigger
- Console: Dismissal logs
- Extension storage: Counters continue incrementing

---

## F. Productive Loop Behaviour

### F1. Watching Only Productive Channels
**Goal:** Verify productive content tracking works

**Preconditions:**
- User is Pro/Trial
- Access to productive/educational content

**Steps:**
1. Watch 3 productive videos (educational, work-related, tutorials)
2. Check extension storage: `chrome.storage.local.get(["ft_productive_count_global", "ft_productive_time_global"])`
3. Continue watching until 30 minutes of productive content
4. Finish a video (navigate away)
5. Observe for nudge

**Expected:**
- Productive counters increment
- After 3 videos OR 30 minutes: Productive nudge1 appears at video end
- No distracting nudge appears
- Less friction than distracting content

**Observe:**
- Extension storage: Productive counters increment
- Console: Classification logs show "productive"
- UI: Productive nudge appears at video end (not during video)

---

### F2. Quickly Switching Between Productive Videos
**Goal:** Verify productive tracking works with rapid navigation

**Preconditions:**
- User is Pro/Trial
- Multiple productive videos ready

**Steps:**
1. Watch productive video 1 for 5 minutes
2. Navigate to productive video 2, watch for 5 minutes
3. Navigate to productive video 3, watch for 5 minutes
4. Finish video 3 (navigate away)
5. Check counters
6. Observe for nudge

**Expected:**
- Productive time accumulates correctly
- Count increments for each video
- Nudge appears at video end if threshold met
- Rapid switching doesn't break tracking

**Observe:**
- Extension storage: Counters increment correctly
- Console: Tracking logs
- UI: Nudge appears at video end

---

### F3. Mixing Productive + Distracting Content
**Goal:** Verify system doesn't overreact to mixed content

**Preconditions:**
- User is Pro/Trial
- Mix of content available

**Steps:**
1. Watch 2 productive videos
2. Watch 1 distracting video
3. Watch 2 more productive videos
4. Check counters
5. Observe which nudge appears (if any)

**Expected:**
- Productive and distracting counters track separately
- Distracting nudge appears if distracting threshold met (3 videos OR 20 min)
- Productive nudge appears if productive threshold met (3 videos OR 30 min)
- System doesn't block productive content when distracting threshold is met

**Observe:**
- Extension storage: Both counters track correctly
- Console: Classification logs
- UI: Correct nudge type appears

---

### F4. Productive Time Counts Toward Daily Limit
**Goal:** Verify productive time still counts toward watch limit

**Preconditions:**
- Daily limit set to 30 minutes
- User is Pro/Trial

**Steps:**
1. Set daily limit to 30 minutes
2. Watch 25 minutes of productive content
3. Check `ft_watch_seconds_today`
4. Try to watch more (productive or distracting)
5. Observe limit behavior

**Expected:**
- Productive time counts toward daily limit
- At 30 minutes, limit overlay appears (regardless of content type)
- Daily limit applies to all watch time

**Observe:**
- Extension storage: `ft_watch_seconds_today` includes productive time
- UI: Limit overlay appears at limit

---

## G. Spiral Loop Behaviour

### G1. Long Continuous Viewing Session
**Goal:** Verify spiral detection triggers for extended viewing

**Preconditions:**
- User is Pro/Trial
- Same channel has multiple videos

**Steps:**
1. Watch 6 videos from the same channel (each >30 seconds)
2. OR: Watch 90+ minutes from same channel
3. Check extension storage: `chrome.storage.local.get(["ft_channel_spiral_count"])`
4. Navigate to 7th video from same channel
5. Observe for spiral nudge

**Expected:**
- Spiral detection triggers at 6 videos OR 90 minutes from same channel (this week)
- Spiral nudge appears when accessing channel again
- Nudge is full-screen overlay with countdown timer

**Observe:**
- Extension storage: Spiral count increments per channel
- Console: Spiral detection logs
- UI: Spiral nudge appears with channel name and count

---

### G2. Spiral Detection Escalation
**Goal:** Verify spiral nudge appears with correct severity

**Preconditions:**
- User is Pro/Trial
- Spiral threshold approaching

**Steps:**
1. Watch 5 videos from same channel
2. Check if any warning appears (should not yet)
3. Watch 6th video from same channel
4. Observe spiral nudge appearance
5. Check nudge content (channel, count, message)

**Expected:**
- No warning before threshold (6 videos OR 90 minutes)
- Spiral nudge appears exactly at threshold
- Nudge shows channel name, video count, and time period (this week)
- Nudge has countdown timer (10 seconds)

**Observe:**
- UI: Spiral nudge appears at threshold
- Console: Spiral detection logs
- Extension storage: Spiral flag set

---

### G3. User Pauses Frequently But Never Stops
**Goal:** Verify spiral detection works with frequent pauses

**Preconditions:**
- User is Pro/Trial
- Same channel available

**Steps:**
1. Watch video 1 from channel, pause frequently (watch 2 min, pause 1 min, repeat)
2. Complete video 1 (>30 seconds total watch)
3. Repeat for videos 2-6 (frequent pauses but complete each video)
4. Check spiral count
5. Navigate to video 7
6. Observe for spiral nudge

**Expected:**
- Spiral detection counts completed videos (>30 seconds)
- Frequent pauses don't prevent spiral detection
- Spiral nudge appears at threshold

**Observe:**
- Extension storage: Spiral count increments per completed video
- Console: Video completion logs
- UI: Spiral nudge appears

---

### G4. User Jumps Between Similar Content Types
**Goal:** Verify spiral detection is channel-specific, not content-type specific

**Preconditions:**
- User is Pro/Trial
- Multiple channels with similar content (e.g., multiple gaming channels)

**Steps:**
1. Watch 3 videos from Gaming Channel A
2. Watch 3 videos from Gaming Channel B (similar content type)
3. Check spiral counts for each channel
4. Observe for spiral nudge

**Expected:**
- Spiral detection is per-channel, not per-content-type
- Channel A count: 3, Channel B count: 3
- No spiral nudge (neither channel reached 6 videos)
- System doesn't aggregate similar content types

**Observe:**
- Extension storage: Separate counts per channel
- Console: Channel-specific logs
- UI: No spiral nudge (threshold not met)

---

### G5. Spiral Logic Doesn't Trigger Too Aggressively
**Goal:** Verify normal use doesn't trigger false spirals

**Preconditions:**
- User is Pro/Trial
- Normal viewing patterns

**Steps:**
1. Watch 2-3 videos from Channel A
2. Watch 2-3 videos from Channel B
3. Watch 2-3 videos from Channel C
4. Check spiral counts
5. Observe for any spiral nudges

**Expected:**
- Spiral detection only triggers for 6+ videos OR 90+ minutes from same channel
- Normal channel switching doesn't trigger spiral
- No false positives

**Observe:**
- Extension storage: Counts are below threshold
- Console: No spiral detection logs
- UI: No spiral nudge appears

---

### G6. Spiral Nudge Actions (Continue, Journal, Block)
**Goal:** Verify all spiral nudge buttons work correctly

**Preconditions:**
- Spiral nudge is showing

**Steps:**
1. Trigger spiral nudge
2. Wait for countdown timer (10 seconds)
3. Click "Continue" button
4. Verify nudge dismisses
5. Trigger spiral nudge again
6. Click "Journal" button
7. Verify journal opens/dismisses nudge
8. Trigger spiral nudge again
9. Click "Block YouTube for Today"
10. Verify YouTube is blocked
11. Trigger spiral nudge again (different channel)
12. Click "Block Channel Permanently"
13. Verify channel is blocked

**Expected:**
- "Continue": Dismisses nudge, allows viewing
- "Journal": Opens journal or dismisses nudge
- "Block YouTube for Today": Blocks all YouTube access for today
- "Block Channel Permanently": Blocks specific channel forever
- All actions work without errors

**Observe:**
- UI: Buttons work, nudge dismisses
- Extension storage: Block flags set correctly
- Console: Action logs

---

## H. Nudging & Overlays

### H1. Soft Nudges (Banners, Toasts)
**Goal:** Verify soft nudges appear and behave correctly

**Preconditions:**
- User is Pro/Trial
- Conditions met for soft nudge (e.g., approaching limit)

**Steps:**
1. Trigger condition for soft nudge (e.g., 80% of daily limit)
2. Observe nudge appearance
3. Check nudge location (corner, top, bottom)
4. Try to interact with nudge
5. Wait for auto-dismiss (if applicable)
6. Check if nudge can be manually dismissed

**Expected:**
- Soft nudge appears in non-intrusive location
- Nudge is visible but doesn't block content
- Nudge can be dismissed or auto-dismisses
- Nudge doesn't interfere with video playback

**Observe:**
- UI: Nudge appearance and location
- Console: Nudge trigger logs
- User experience: Non-intrusive

---

### H2. Strong Nudges (Modals, Friction Clicks)
**Goal:** Verify strong nudges require user action

**Preconditions:**
- User is Pro/Trial
- Conditions met for strong nudge (e.g., distraction threshold)

**Steps:**
1. Trigger condition for strong nudge (e.g., 3 distracting videos)
2. Observe nudge appearance
3. Try to interact with YouTube (click video, navigate)
4. Check if nudge blocks interactions
5. Click nudge action button (Continue, Dismiss, etc.)
6. Verify nudge dismisses and YouTube works again

**Expected:**
- Strong nudge appears as modal/overlay
- Nudge blocks or dims YouTube content
- User must take action to dismiss
- YouTube interactions are limited until nudge is dismissed

**Observe:**
- UI: Modal/overlay appearance
- Interaction: YouTube is blocked/dimmed
- Console: Nudge trigger and dismiss logs

---

### H3. Full-Screen Overlays That Block YouTube
**Goal:** Verify full-screen overlays completely block access

**Preconditions:**
- Conditions met for full-screen overlay (e.g., daily limit, spiral, focus window)

**Steps:**
1. Trigger full-screen overlay (e.g., reach daily limit)
2. Observe overlay appearance
3. Try to scroll page
4. Try to click behind overlay
5. Try to use keyboard shortcuts
6. Check if overlay can be dismissed (if applicable)
7. Verify overlay blocks all YouTube access

**Expected:**
- Overlay covers entire screen
- Page scrolling is disabled
- Clicks behind overlay don't work
- Keyboard shortcuts are blocked (or limited)
- Overlay must be dismissed to continue (or wait for condition to change)

**Observe:**
- UI: Full-screen overlay
- Interaction: All YouTube access blocked
- Console: Overlay trigger logs

---

### H4. Nudge Appears at Correct Trigger
**Goal:** Verify each nudge type appears at right condition

**Preconditions:**
- User is Pro/Trial
- Track all nudge types

**Steps:**
1. Test distraction nudge1 (3 videos OR 20 min)
2. Test distraction nudge2 (4 videos OR 40 min)
3. Test distraction break (5 videos OR 60 min)
4. Test productive nudge1 (3 videos OR 30 min, at video end)
5. Test productive nudge2 (5 videos OR 60 min, at video end)
6. Test productive break (7 videos OR 90 min, at video end)
7. Test spiral nudge (6 videos OR 90 min from same channel)
8. Test journal nudge (1 minute of distracting video)
9. Test daily limit overlay (at limit)
10. Test focus window overlay (outside time window)

**Expected:**
- Each nudge appears at correct threshold
- Nudge type matches condition
- No false triggers

**Observe:**
- UI: Correct nudge at each threshold
- Console: Trigger logs
- Extension storage: Counters match thresholds

---

### H5. Nudge Disappears Correctly
**Goal:** Verify nudges dismiss properly

**Preconditions:**
- Nudge is showing

**Steps:**
1. Trigger a nudge
2. Click dismiss/continue button
3. Verify nudge disappears
4. Verify YouTube works normally
5. Trigger nudge again (if applicable)
6. Wait for auto-dismiss (if applicable)
7. Verify nudge disappears automatically

**Expected:**
- Manual dismiss: Nudge disappears immediately
- Auto-dismiss: Nudge disappears after timeout
- After dismiss: YouTube works normally
- Nudge can retrigger if condition still met

**Observe:**
- UI: Nudge disappears
- Interaction: YouTube works after dismiss
- Console: Dismiss logs

---

### H6. Reloading Page with Nudge
**Goal:** Verify nudge behavior on page reload

**Preconditions:**
- Nudge is showing (or condition is met)

**Steps:**
1. Trigger a nudge (e.g., daily limit reached)
2. Reload page (F5)
3. Observe if nudge reappears
4. Check if condition still met
5. Verify nudge behavior is consistent

**Expected:**
- If condition still met: Nudge reappears after reload
- If condition changed: Nudge doesn't reappear
- Nudge state is preserved across reload

**Observe:**
- UI: Nudge reappears if condition met
- Console: Nudge trigger on reload
- Extension storage: Condition state preserved

---

### H7. Opening New Tab with Nudge
**Goal:** Verify nudge applies to new tabs

**Preconditions:**
- Condition met for nudge (e.g., daily limit)

**Steps:**
1. Trigger nudge in Tab 1 (e.g., reach daily limit)
2. Open new tab
3. Navigate to YouTube in new tab
4. Observe if nudge appears in new tab
5. Check if condition is shared across tabs

**Expected:**
- Nudge appears in new tab if condition is shared (e.g., daily limit)
- Condition state is shared across tabs (via extension storage)
- Cannot bypass nudge by opening new tab

**Observe:**
- UI: Nudge appears in new tab
- Extension storage: Condition shared
- Console: Nudge trigger in new tab

---

### H8. Overlays Block Core Actions Correctly
**Goal:** Verify overlays prevent unintended actions

**Preconditions:**
- Full-screen overlay is showing (e.g., daily limit)

**Steps:**
1. Trigger full-screen overlay
2. Try to play video (should be blocked)
3. Try to navigate to new video (should be blocked or show overlay)
4. Try to search (should be blocked or show overlay)
5. Try to access settings (should be blocked or show overlay)
6. Verify only overlay actions are available

**Expected:**
- Video playback is blocked
- Navigation is blocked or shows overlay
- Search is blocked or shows overlay
- Only overlay buttons work (if any)

**Observe:**
- Interaction: All YouTube actions blocked
- UI: Overlay is modal
- Console: Block logs

---

### H9. Overlays Don't Get Stuck
**Goal:** Verify overlays can always be dismissed

**Preconditions:**
- Overlay is showing

**Steps:**
1. Trigger overlay
2. Try all dismiss methods (buttons, ESC key, etc.)
3. If overlay has countdown, wait for auto-dismiss
4. If condition changes (e.g., new day), verify overlay disappears
5. Check console for errors

**Expected:**
- Overlay can always be dismissed (manually or automatically)
- Overlay disappears when condition changes
- No stuck overlays that block all access
- Console shows no errors

**Observe:**
- UI: Overlay can be dismissed
- Console: No stuck overlay errors
- User experience: Never completely blocked

---

### H10. Journal Nudge Format (Full-Screen Overlay)
**Goal:** Verify journal nudge appears as full-screen overlay, not corner nudge

**Preconditions:**
- User is Pro/Trial
- Watching a distracting video

**Steps:**
1. Start watching a distracting video
2. Wait 1 minute (journal nudge trigger)
3. Observe nudge appearance
4. Check if nudge is full-screen overlay or corner banner
5. Verify nudge format matches design

**Expected:**
- Journal nudge appears as full-screen overlay (not corner banner)
- Overlay covers entire screen
- Overlay has "What pulled you off track?" message
- Overlay can be dismissed

**Observe:**
- UI: Full-screen overlay format
- Console: Journal nudge trigger logs
- Design: Matches specification

---

## I. Extension Injection / YouTube Behaviour

### I1. First Load After Browser Start
**Goal:** Verify extension loads correctly on first YouTube visit

**Preconditions:**
- Browser just started
- Extension is installed and enabled
- User is logged in

**Steps:**
1. Close all browser windows
2. Open browser
3. Navigate to `youtube.com` (first page load)
4. Wait 3-5 seconds
5. Check console for extension messages
6. Check if extension features work (timer, blocking, etc.)
7. Verify no manual reload needed

**Expected:**
- Extension loads automatically
- Console shows extension initialization messages
- Extension features work immediately
- No errors or warnings
- No manual reload required

**Observe:**
- Console: Extension load messages
- Functionality: Features work on first load
- Errors: No initialization errors

---

### I2. SPA Navigation (Home → Watch → Channel → Playlist)
**Goal:** Verify extension handles YouTube SPA navigation correctly

**Preconditions:**
- On YouTube homepage

**Steps:**
1. Start on YouTube homepage
2. Navigate to a video (watch page)
3. Navigate to channel page
4. Navigate to playlist page
5. Navigate to search results
6. Use browser back/forward buttons
7. Check console for navigation messages
8. Verify extension features work on each page type

**Expected:**
- Extension detects all navigation events
- Console shows `[FT] Navigation detected` for each page change
- Extension features work on each page type
- No errors during navigation
- State is preserved across navigation

**Observe:**
- Console: Navigation detection logs
- Functionality: Features work on all page types
- Errors: No navigation errors

---

### I3. Multiple YouTube Tabs Simultaneously
**Goal:** Verify extension works correctly with multiple tabs

**Preconditions:**
- Extension installed
- Two YouTube tabs can be opened

**Steps:**
1. Open YouTube tab 1
2. Open YouTube tab 2 (new tab)
3. Start video in tab 1
4. Start video in tab 2
5. Switch between tabs
6. Check timer behavior (which tab is tracked?)
7. Check if blocking works in both tabs
8. Check console in both tabs

**Expected:**
- Extension works in both tabs
- Timer tracks active/playing tab
- Blocking works in both tabs
- No conflicts between tabs
- Console shows messages in both tabs

**Observe:**
- Functionality: Works in both tabs
- Timer: Tracks correctly
- Console: Messages in both tabs
- Errors: No tab conflicts

---

### I4. Unsupported Pages / Other Domains
**Goal:** Verify extension fails safely on non-YouTube pages

**Preconditions:**
- Extension is installed

**Steps:**
1. Navigate to non-YouTube domain (e.g., `google.com`)
2. Check console for extension messages
3. Navigate to YouTube subdomain that might not be supported
4. Check if extension errors or fails gracefully
5. Navigate back to YouTube
6. Verify extension still works

**Expected:**
- Extension doesn't run on non-YouTube domains
- No errors on non-YouTube pages
- Extension works normally when returning to YouTube
- No crashes or broken state

**Observe:**
- Console: No extension messages on non-YouTube
- Errors: No errors on other domains
- Functionality: Works when returning to YouTube

---

### I5. Performance Impact (Long-Running Tab)
**Goal:** Verify extension doesn't degrade performance over time

**Preconditions:**
- YouTube tab open
- Extension active

**Steps:**
1. Open YouTube tab
2. Leave tab open for 2+ hours (or simulate long session)
3. Periodically check:
   - Page responsiveness
   - Memory usage (Chrome Task Manager)
   - Console for errors
   - Timer accuracy
4. Navigate between videos during long session
5. Check if performance degrades

**Expected:**
- Page remains responsive
- Memory usage doesn't grow excessively
- No memory leaks
- Timer remains accurate
- No performance degradation

**Observe:**
- Performance: Page remains fast
- Memory: Stable usage
- Console: No memory warnings
- Timer: Remains accurate

---

### I6. Extension Popup Functionality
**Goal:** Verify extension popup works correctly

**Preconditions:**
- Extension installed
- User is logged in

**Steps:**
1. Click extension icon (opens popup)
2. Check popup content (user info, plan, buttons)
3. Click "Manage Account" button
4. Verify new tab opens to settings
5. Close popup, reopen
6. Check if popup state is correct
7. Try logging out from popup
8. Verify logout works

**Expected:**
- Popup opens correctly
- Popup shows correct user info
- "Manage Account" opens settings in new tab
- Popup state is accurate
- Logout works from popup

**Observe:**
- UI: Popup displays correctly
- Functionality: Buttons work
- State: Accurate information

---

## J. Backend & Supabase Safety

### J1. Watch Time Write to Supabase
**Goal:** Verify watch time is saved to Supabase correctly

**Preconditions:**
- User is logged in
- Video is playing
- Timer is incrementing

**Steps:**
1. Start watching video
2. Let play for 5 minutes
3. Check extension storage: `ft_watch_seconds_today`
4. Wait 10 seconds (for sync interval)
5. Check Supabase: Query `extension_data` table for user
6. Check `watch_seconds_today` field
7. Verify value matches extension storage

**Expected:**
- Watch time is saved to Supabase
- Value matches extension storage (within sync delay)
- No data loss
- Write happens automatically (no manual trigger needed)

**Observe:**
- Supabase: Value in database
- Extension storage: Value matches
- Console: Sync success messages
- Network: API call to save endpoint

---

### J2. Blocked Channels Write to Supabase
**Goal:** Verify blocked channels are saved correctly

**Preconditions:**
- User is logged in
- No channels blocked yet

**Steps:**
1. Block a channel from extension
2. Wait 3-5 seconds
3. Check Supabase: Query `extension_data` table
4. Check `blocked_channels` JSON field
5. Verify channel name is in array
6. Block another channel
7. Verify both channels are in array
8. Remove a channel
9. Verify channel is removed from array

**Expected:**
- Blocked channels are saved to Supabase
- Array contains all blocked channels
- Removing channel updates array correctly
- No duplicate entries
- No data corruption

**Observe:**
- Supabase: `blocked_channels` array is correct
- Extension storage: Matches Supabase
- Console: Save success messages
- Network: API calls to save endpoint

---

### J3. Empty or Partial Payload Handling
**Goal:** Verify backend handles malformed requests gracefully

**Preconditions:**
- Backend is running
- Can simulate API calls

**Steps:**
1. Send API request with empty payload `{}`
2. Send API request with partial payload (missing required fields)
3. Send API request with invalid data types
4. Check backend logs for errors
5. Check Supabase for any bad writes
6. Verify no data corruption

**Expected:**
- Backend rejects invalid requests (400 error)
- No data is written to Supabase for invalid requests
- Backend logs errors appropriately
- No silent failures or data corruption

**Observe:**
- Network: 400 error responses
- Backend logs: Error messages
- Supabase: No bad data written
- Console: Error messages in extension

---

### J4. Failed Network Calls
**Goal:** Verify extension handles network failures gracefully

**Preconditions:**
- Extension is working
- Network is available

**Steps:**
1. Perform action that triggers API call (e.g., block channel)
2. Immediately disable network (or block API endpoint)
3. Check extension storage: Is data saved locally?
4. Check console: Are there retry messages?
5. Re-enable network
6. Check if data syncs to server
7. Check Supabase: Is data eventually saved?

**Expected:**
- Data is saved locally immediately
- Extension retries when network is restored
- Data eventually syncs to Supabase
- No data loss
- User experience is not blocked

**Observe:**
- Extension storage: Data saved locally
- Console: Retry messages
- Supabase: Data appears after network restore
- Network: Retry API calls

---

### J5. Retried Requests
**Goal:** Verify retry logic works correctly

**Preconditions:**
- Network can be controlled
- Action triggers API call

**Steps:**
1. Perform action (e.g., block channel)
2. Let network fail for first attempt
3. Check console: Is retry attempted?
4. Let network succeed on retry
5. Check Supabase: Is data saved?
6. Verify no duplicate writes

**Expected:**
- Extension retries failed requests
- Retry succeeds when network is available
- Data is saved exactly once (no duplicates)
- Retry logic has reasonable backoff

**Observe:**
- Console: Retry attempt logs
- Network: Retry API calls
- Supabase: Single write (no duplicates)

---

### J6. No Accidental Overwriting with Empty Lists
**Goal:** Verify server sync doesn't wipe local data

**Preconditions:**
- User has blocked channels locally
- Server has different (or empty) blocked channels

**Steps:**
1. Block 2 channels locally (verify in extension storage)
2. Manually set server to return empty array for `blocked_channels`
3. Trigger extension data sync
4. Check extension storage: Are channels still there?
5. Check Supabase: Are channels preserved?

**Expected:**
- Extension merges local and server data
- Empty server response doesn't wipe local data
- Existing channels are preserved
- No data loss

**Observe:**
- Extension storage: Channels preserved
- Supabase: Channels preserved
- Console: Merge logic messages

---

### J7. No Duplicate Rows in Supabase
**Goal:** Verify database doesn't create duplicate user records

**Preconditions:**
- User is logged in
- User has data in Supabase

**Steps:**
1. Check Supabase: Query `extension_data` table for user
2. Count rows for this user (should be 1)
3. Trigger multiple data syncs rapidly
4. Check Supabase again: Row count should still be 1
5. Check if data is updated (not duplicated)

**Expected:**
- Only 1 row per user in `extension_data` table
- Multiple syncs update same row (don't create duplicates)
- Database constraints prevent duplicates
- No orphaned or duplicate data

**Observe:**
- Supabase: Single row per user
- Data: Updated in place
- Console: Update logs (not insert logs)

---

### J8. No Silent Data Corruption
**Goal:** Verify data integrity is maintained

**Preconditions:**
- User has data in Supabase
- Can monitor data changes

**Steps:**
1. Note current state: Blocked channels, watch time, etc.
2. Perform various actions (watch videos, block channels, etc.)
3. After each action, verify Supabase data matches expected state
4. Check for:
   - Data type mismatches
   - Truncated strings
   - Corrupted JSON
   - Missing fields
   - Invalid values

**Expected:**
- All data writes are valid
- Data types are correct
- JSON is well-formed
- No corruption or data loss
- Data matches extension storage

**Observe:**
- Supabase: Data is valid
- Extension storage: Matches Supabase
- Console: No corruption errors
- Data types: All correct

---

### J9. User ID Verification in All Writes
**Goal:** Verify all writes use correct user_id

**Preconditions:**
- Two test accounts (Account A and Account B)
- Can check Supabase writes

**Steps:**
1. Log in as Account A
2. Perform actions (watch video, block channel)
3. Check Supabase: Verify all writes have Account A's user_id
4. Log out, log in as Account B
5. Perform actions
6. Check Supabase: Verify all writes have Account B's user_id
7. Verify no cross-contamination

**Expected:**
- All writes use correct user_id
- Account A's data is separate from Account B's
- No data mixing
- user_id is verified before every write

**Observe:**
- Supabase: Correct user_id in all records
- Console: user_id in API requests
- Data: No cross-contamination

---

### J10. Extension Data Sync Endpoint
**Goal:** Verify `/extension/get-data` and `/extension/save-data` work correctly

**Preconditions:**
- Backend is running
- User is logged in

**Steps:**
1. Check current extension data in Supabase
2. Modify data locally (e.g., block channel)
3. Wait for sync (or trigger manually)
4. Check network tab: Verify `/extension/save-data` is called
5. Check request payload: Verify correct data
6. Check response: Verify success
7. Query `/extension/get-data` endpoint directly
8. Verify response matches Supabase data

**Expected:**
- Save endpoint receives correct data
- Save endpoint returns success
- Get endpoint returns correct data
- Data matches between extension, API, and Supabase

**Observe:**
- Network: API calls are made
- Payload: Correct data sent
- Response: Success responses
- Supabase: Data matches API

---

## Test Execution Log

**Tester Name:** _________________  
**Date:** _________________  
**Extension Version:** _________________  
**Browser Version:** _________________  

### Summary
- **Total Tests:** 100+
- **Passed:** ___ / ___
- **Failed:** ___ / ___
- **Blocked:** ___ / ___

### Notes
_Add any general observations, issues, or patterns noticed during testing_

---

## Quick Reference: Console Commands

**Check Extension Storage:**
```javascript
chrome.storage.local.get(null, console.log);
```

**Check Specific Keys:**
```javascript
chrome.storage.local.get(["ft_plan", "ft_watch_seconds_today", "ft_blocked_channels"], console.log);
```

**Clear Extension Storage (for testing):**
```javascript
chrome.storage.local.clear(() => console.log("Cleared"));
```

**Check Plan:**
```javascript
chrome.storage.local.get(["ft_plan", "ft_can_record"], console.log);
```

**Check Counters:**
```javascript
chrome.storage.local.get(["ft_distracting_count_global", "ft_distracting_time_global", "ft_productive_count_global", "ft_productive_time_global"], console.log);
```

**Check Spiral Data:**
```javascript
chrome.storage.local.get(["ft_channel_spiral_count", "ft_spiral_detected"], console.log);
```

---

## End of Test Plan

---

## Plan Logic Refactoring Tests

**Purpose:** Verify that plan logic refactoring works correctly - `getEffectivePlan()` simplification, `isProExperience()` removal, and trial expiry handling

**Date:** 2025-12-01  
**Status:** Post-refactoring verification

---

### PL1. Trial User with Active Trial (14 days left)

**Goal:** Verify trial user with active trial gets Pro features

**Preconditions:**
- User has trial plan with `ft_days_left > 0`
- Extension is loaded

**Steps:**
1. Set up trial user in Supabase (or use existing trial account)
2. Reload extension
3. Open YouTube
4. Navigate to a video page
5. Check console for plan logs
6. Try to block a channel
7. Search YouTube (test search limit)
8. Check if AI classification happens

**Expected:**
- Console shows: `plan: "pro"` or `effectivePlan: "pro"`
- Block channel button appears on video pages
- Search limit is 15 (not 5)
- AI classification runs (check background console for classification logs)
- Focus window works if enabled
- Behavior loop tracking active

**Check Plan:**script
chrome.storage.local.get(["ft_plan", "ft_days_left", "ft_can_record"], console.log);
// Should show: ft_plan: "trial", ft_days_left: 14 (or similar), ft_can_record: true**Result:** ✅ PASS / ❌ FAIL  
**Notes:** 

---

### PL2. Trial User with Expired Trial (0 or negative days)

**Goal:** Verify expired trial user loses Pro features and reverts to Free

**Preconditions:**
- User has trial plan with `ft_days_left <= 0`
- Extension is loaded

**Steps:**
1. Set `ft_days_left` to 0 or negative in storage
   chrome.storage.local.set({ft_days_left: 0});
   2. Reload extension
3. Navigate to YouTube
4. Check console for plan logs
5. Try to block a channel
6. Search YouTube (test search limit)
7. Check if AI classification happens

**Expected:**
- Console shows: `plan: "free"` or `effectivePlan: "free"`
- Block channel button does NOT appear
- Search limit is 5 (not 15)
- AI classification does NOT run (check background console - should see "skipped (plan inactive)")
- Focus window does NOT apply
- Behavior loop tracking inactive

**Check Plan:**script
chrome.storage.local.get(["ft_plan", "ft_days_left", "ft_can_record"], console.log);
// Should show: ft_plan: "trial", ft_days_left: 0, ft_can_record: false**Result:** ✅ PASS / ❌ FAIL  
**Notes:** 

---

### PL3. Pro User Features

**Goal:** Verify Pro user gets all Pro features

**Preconditions:**
- User has Pro plan
- Extension is loaded

**Steps:**
1. Set plan to "pro" in storageavascript
   chrome.storage.local.set({ft_plan: "pro", ft_can_record: true});
   2. Reload extension
3. Navigate to YouTube
4. Check all Pro features work

**Expected:**
- Block channel button appears
- Search limit is 15
- AI classification runs
- Focus window works
- Behavior loop tracking active
- All Pro features enabled

**Result:** ✅ PASS / ❌ FAIL  
**Notes:** 

---

### PL4. Free User Limitations

**Goal:** Verify Free user has correct limitations

**Preconditions:**
- User has Free plan
- Extension is loaded

**Steps:**
1. Set plan to "free" in storage
  t
   chrome.storage.local.set({ft_plan: "free", ft_can_record: false});
   2. Reload extension
3. Navigate to YouTube
4. Check Free limitations apply

**Expected:**
- Block channel button does NOT appear
- Search limit is 5
- AI classification does NOT run
- Focus window does NOT apply
- Behavior loop tracking inactive
- Shorts are hard blocked

**Result:** ✅ PASS / ❌ FAIL  
**Notes:** 

---

### PL5. Pro Manual Block Shorts Overlay

**Goal:** Verify Pro/Trial users see Pro manual block overlay when redirecting from Shorts

**Preconditions:**
- User has Pro or active Trial plan
- User manually blocked Shorts for today

**Steps:**
1. Set up Pro or Trial user
2. Navigate to YouTube Shorts
3. Manually block Shorts (if option available)
4. Get redirected to home page
5. Check overlay message

**Expected:**
- Pro manual block overlay appears (encouraging message)
- Overlay shows Pro-specific messaging
- Free users see different overlay

**Check Storage:**ascript
chrome.storage.local.get(["ft_pro_manual_block_shorts", "ft_plan", "ft_days_left"], console.log);**Result:** ✅ PASS / ❌ FAIL  
**Notes:** 

---

### PL6. Plan Sync After Trial Expiry

**Goal:** Verify plan sync correctly updates expired trial

**Preconditions:**
- User has trial plan with expired trial in Supabase
- Extension has cached trial plan

**Steps:**
1. Set trial as expired in Supabase (or use existing expired trial)
2. Reload extension
3. Wait for plan sync (5 minutes or force sync)
4. Check storage after sync
5. Verify features match Free plan

**Expected:**
- Plan syncs from server
- `ft_plan` stays "trial" but `ft_can_record` becomes false
- `getEffectivePlan()` returns "free"
- Features revert to Free limitations

**Force Sync:**ript
// In background console
syncPlanFromServer(true);**Result:** ✅ PASS / ❌ FAIL  
**Notes:** 

---

### PL7. Error Handling

**Goal:** Verify error handling works when storage read fails

**Preconditions:**
- Extension is loaded

**Steps:**
1. Simulate storage error (optional - hard to test)
2. Check console for error logs
3. Verify extension doesn't crash

**Expected:**
- If storage read fails, `getEffectivePlan()` returns "free" (safe default)
- Console shows warning: `[FT] Error getting effective plan:`
- Extension continues to work (defaults to Free)

**Result:** ✅ PASS / ❌ FAIL  
**Notes:** 

---

### PL8. Console Error Check

**Goal:** Verify no console errors after refactoring

**Preconditions:**
- Extension is loaded
- All previous tests completed

**Steps:**
1. Open background console
2. Open content console (YouTube page)
3. Navigate through YouTube
4. Check for any errors

**Expected:**
- No errors about `isProExperience is not defined`
- No errors about `getEffectivePlan` not found
- No errors about plan logic
- Only expected warnings (if any)

**Result:** ✅ PASS / ❌ FAIL  
**Notes:** 

---

### PL9. Search Limits Verification

**Goal:** Verify search limits are correct for each plan

**Preconditions:**
- Extension is loaded

**Steps:**
1. Test as Free user (search 6 times)
2. Test as Pro/Trial user (search 16 times)
3. Verify blocking behavior

**Expected:**
- Free: Blocked after 5 searches
- Pro/Trial: Blocked after 15 searches

**Check Search Count:**
chrome.storage.local.get(["ft_searches_today"], console.log);**Result:** ✅ PASS / ❌ FAIL  
**Notes:** 

---

### PL10. AI Classification Verification

**Goal:** Verify AI classification works for Pro/Trial, not Free

**Preconditions:**
- Extension is loaded
- User has goals set (for Pro/Trial)

**Steps:**
1. Test as Free user - watch video
2. Test as Pro/Trial user - watch video
3. Check background console for classification logs

**Expected:**
- Free: Background console shows "AI classification skipped (plan inactive)"
- Pro/Trial: Background console shows classification results
- Pro/Trial: Video gets classified (productive/distracting/neutral)

**Check Classification:**
chrome.storage.local.get(["ft_current_video_classification"], console.log);**Result:** ✅ PASS / ❌ FAIL  
**Notes:** 

---