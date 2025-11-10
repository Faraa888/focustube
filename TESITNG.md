Test plan: full data sync (including goals)
Pre-test checklist
[ ] Logged in (extension shows your email)
[ ] Backend is running/deployed
[ ] Migrations 004, 006, 007 ran in Supabase
Test 1: Backend includes goals (3 minutes)
Step 1: Test GET endpoint includes goals
Open terminal
Run (replace YOUR_EMAIL):
   curl "https://focustube-backend-4xah.onrender.com/extension/get-data?email=YOUR_EMAIL@example.com"
Expected response:
   {     "ok": true,   "data": {     "blocked_channels": [],     "watch_history": [],     "channel_spiral_count": {},     "settings": {},     "goals": [],     "anti_goals": []   }   }
Pass if: response includes goals and anti_goals fields
Step 2: Test POST endpoint saves goals
Set goals in Supabase (SQL Editor):
   UPDATE users    SET goals = '["Learn coding", "Fitness"]'::jsonb   WHERE email = 'YOUR_EMAIL@example.com';
Test GET again:
   curl "https://focustube-backend-4xah.onrender.com/extension/get-data?email=YOUR_EMAIL@example.com"
Expected: "goals": ["Learn coding", "Fitness"]
Pass if: goals are returned
Step 3: Test POST saves goals
Run (replace YOUR_EMAIL):
   curl -X POST "https://focustube-backend-4xah.onrender.com/extension/save-data" \     -H "Content-Type: application/json" \     -d '{       "email": "YOUR_EMAIL@example.com",       "data": {         "goals": ["Test Goal 1", "Test Goal 2"],         "anti_goals": ["Distraction 1"]       }     }'
Expected: {"ok": true, "message": "Extension data saved successfully"}
Verify in Supabase:
Table Editor → users table
Find your email row
Check goals column → should show ["Test Goal 1", "Test Goal 2"]
Check anti_goals column → should show ["Distraction 1"]
Pass if: goals saved to database
Test 2: Extension loads goals on login (5 minutes)
Step 1: Set goals in database
In Supabase SQL Editor:
   UPDATE users    SET goals = '["Learn coding", "Fitness", "Productivity"]'::jsonb   WHERE email = 'YOUR_EMAIL@example.com';
Step 2: Logout and login
Extension popup → Click "Disconnect"
Log back in (website or popup)
Step 3: Check goals loaded
Open extension popup console:
Click extension icon
Right-click popup → "Inspect"
Check storage:
   chrome.storage.local.get(['ft_user_goals', 'ft_user_anti_goals'], console.log);
Expected:
   {     ft_user_goals: ["Learn coding", "Fitness", "Productivity"],     ft_user_anti_goals: []   }
Check background console:
Go to chrome://extensions
Find FocusTube → Click "service worker" (or "background page")
Look for: [FT] Extension data loaded from server: {goals: 3, antiGoals: 0}
Pass if: goals are in storage after login
Test 3: Extension saves goals when set (3 minutes)
Step 1: Set goals via extension
Extension popup console:
   chrome.runtime.sendMessage({     type: "FT_SET_GOALS",     goals: ["New Goal 1", "New Goal 2"]   }, (response) => {     console.log("Set goals result:", response);   });
Expected: Set goals result: {ok: true, goals: ["New Goal 1", "New Goal 2"]}
Check storage:
   chrome.storage.local.get(['ft_user_goals'], console.log);
Should show: {ft_user_goals: ["New Goal 1", "New Goal 2"]}
Step 2: Verify saved to server
Wait 2 seconds (save is async)
Check Supabase:
Table Editor → users table
Find your email row
Check goals column
Should show: ["New Goal 1", "New Goal 2"]
Pass if: goals saved to database
Test 4: Goals cleared on logout (2 minutes)
Step 1: Verify goals exist
Extension popup console:
   chrome.storage.local.get(['ft_user_goals'], console.log);
Should show goals
Step 2: Logout
Extension popup → Click "Disconnect"
Step 3: Verify cleared
Extension popup console:
   chrome.storage.local.get(['ft_user_goals', 'ft_user_anti_goals'], console.log);
Expected: {ft_user_goals: undefined, ft_user_anti_goals: undefined}
Pass if: goals cleared on logout
Test 5: All data syncs together (5 minutes)
Step 1: Set multiple data types
Extension popup console:
   chrome.storage.local.set({     ft_blocked_channels: ["Channel A", "Channel B"],     ft_user_goals: ["Goal 1", "Goal 2"],     ft_watch_history: [{channel: "Test", timestamp: Date.now()}]   });
Save all:
   chrome.runtime.sendMessage({ type: "FT_SAVE_EXTENSION_DATA" }, (response) => {     console.log("Save result:", response);   });
Step 2: Clear local storage
Extension popup console:
   chrome.storage.local.remove(['ft_blocked_channels', 'ft_user_goals', 'ft_watch_history']);
Step 3: Reload and verify
Reload extension (chrome://extensions → refresh)
Extension popup console:
   chrome.runtime.sendMessage({ type: "FT_LOAD_EXTENSION_DATA" }, (response) => {     console.log("Load result:", response);   });
Check storage:
   chrome.storage.local.get(['ft_blocked_channels', 'ft_user_goals', 'ft_watch_history'], console.log);
Expected: all data restored from server
Pass if: all data types sync together
Test summary
[ ] Test 1: Backend includes goals
[ ] Test 2: Extension loads goals on login
[ ] Test 3: Extension saves goals when set
[ ] Test 4: Goals cleared on logout
[ ] Test 5: All data syncs together
Implementation plan: spiral tracking
Phase 1: Populate watch history (30 min)
What to implement:
In finalizeVideoWatch():
Add watch event to ft_watch_history
Keep last 7 days only
Include: channel, video_id, watched_at, seconds, category
Auto-save to server:
Call saveExtensionDataToServer() when watch_history updates
Debounce saves (max once per 30 seconds)
Files to modify:
extension/background/background.js - finalizeVideoWatch() function
Phase 2: Channel counting (20 min)
What to implement:
In finalizeVideoWatch():
Count channels watched today
Count channels watched this week
Update ft_channel_spiral_count:
     {       "Channel Name": {         today: 2,         this_week: 4,         last_watched: "2025-01-15T10:00:00Z"       }     }
Files to modify:
extension/background/background.js - finalizeVideoWatch() function
Phase 3: Spiral detection (30 min)
What to implement:
In handleNavigated() (before AI classification):
Check if current channel has 3+ videos today
Check if current channel has 3+ videos this week
If spiral detected:
Set flag: ft_spiral_detected: {channel, type: "today"|"week", count}
Return special response to content script
Content script reaction:
If spiral detected → show spiral nudge overlay
Options: "Keep watching", "Block channel", "Take a break"
Files to modify:
extension/background/background.js - handleNavigated() function
extension/content/content.js - handle spiral response, show nudge
Phase 4: Spiral nudge UI (40 min)
What to implement:
Create spiral nudge overlay (similar to journal nudge)
Show channel name and count
Three buttons:
"Keep watching" → dismiss, continue
"Block channel" → add to blocked_channels, redirect
"Take a break" → pause video, show break message
Files to create/modify:
extension/content/content.js - showSpiralNudge() function
extension/content/overlay.css - spiral nudge styles
Phase 5: Auto-block suggestion (20 min)
What to implement:
If channel has 3+ spirals in a week:
Show suggestion: "You've watched [Channel] 3+ times this week. Block it?"
One-time suggestion (don't spam)
Files to modify:
extension/background/background.js - check on navigation
extension/content/content.js - show suggestion overlay
Implementation order
Phase 1: Populate watch_history (foundation)
Phase 2: Channel counting (data structure)
Phase 3: Spiral detection (logic)
Phase 4: Spiral nudge UI (user experience)
Phase 5: Auto-block suggestion (nice-to-have)
Estimated total: ~2.5 hours
Ready to test?
Start with Test 1 (Backend includes goals). Share results and we'll proceed step by step.