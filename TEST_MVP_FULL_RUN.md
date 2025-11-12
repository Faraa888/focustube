## FocusTube MVP – Full Regression Test (Single Checklist)

> Run this after pulling the latest build. Keep the extension background console open (`chrome://extensions` → **Inspect views → background/background.html**) so you can watch `[FT]` logs. Where commands reference `YOUR_EMAIL`, substitute the account you’re testing with.

---

### 0. Prep

1. Reload the extension (toggle off/on in `chrome://extensions`).
2. Optionally clear storage for a fresh run:
   ```js
   chrome.storage.local.clear(() => console.log("Storage cleared"));
   ```
3. Confirm the backend is reachable:
   ```bash
   curl https://focustube-backend-4xah.onrender.com/health
   ```

---

### 1. Sign-In & Auth Flow

1. **Dashboard protection**  
   - Open `https://focustube-beta.vercel.app/app/dashboard` in incognito → should redirect to `/login`.

2. **New signup → extension detects**  
   - Sign up with a fresh email.  
   - Complete onboarding (goals, download).  
   - Open the popup console → expect logs:
     ```
     🔍 [POPUP] Checking for email...
     ✅ [POPUP] Email found...
     ✅ [POPUP] User verified...
     ```
   - Popup shows status with email + plan.

3. **Existing login → extension syncs**  
   - `chrome.storage.local.clear()`, then log in via `/login`.  
   - Dashboard loads, popup immediately shows status.

4. **Continue with Free button**  
   - Clear storage → open popup → click “Continue with Free”. Popup closes and reopens to onboarding.

5. **Website logout**  
   - While logged in, click “Sign Out” in the site header.  
   - Browser goes to `/login`; popup reverts to onboarding (email cleared).

6. **Extension logout button**  
   - Log back in, open popup, click “Disconnect”.  
   - Storage wiped, onboarding displayed, `[FT]` logs show data cleared.

7. **Session persistence**  
   - Log in, close browser completely, reopen.  
   - Dashboard still accessible, popup still connected.

8. **Backend verification**  
   ```bash
   curl "https://focustube-backend-4xah.onrender.com/license/verify?email=YOUR_EMAIL"
   ```
   Confirms `exists`, `plan`, `days_left`.

9. **Header navigation**  
   - Logged out: header shows Home/Pricing/Download/Login, “Start Free Trial” button.  
   - Logged in: header shows Dashboard/Settings/Sign Out, no “Start Free Trial”.  
   - Verify mobile menu mirrors the same behaviour.

---

### 2. Data Sync (Storage ↔ Supabase)

1. **GET /extension/get-data**  
   ```bash
   curl "https://focustube-backend-4xah.onrender.com/extension/get-data?email=YOUR_EMAIL"
   ```  
   Must include `blocked_channels`, `watch_history`, `channel_spiral_count`, `settings`, `goals`, `anti_goals`.

2. **POST /extension/save-data**  
   ```bash
   curl -X POST "https://focustube-backend-4xah.onrender.com/extension/save-data" \
     -H "Content-Type: application/json" \
     -d '{"email":"YOUR_EMAIL","data":{"blocked_channels":["Test 1","Test 2"],"watch_history":[],"channel_spiral_count":{},"settings":{},"goals":[],"anti_goals":[]}}'
   ```  
   Re-run GET to confirm the write.

3. **Extension auto-load**  
   - Reload extension.  
   - Popup console should show `[FT] Extension data loaded from server...`.  
   - `chrome.storage.local.get(['ft_blocked_channels'], console.log);` returns the channels above.

4. **Extension save path**  
   - `chrome.storage.local.set({ ft_blocked_channels: ["Channel A","Channel B"] });`  
   - `chrome.runtime.sendMessage({ type: "FT_SAVE_EXTENSION_DATA" }, console.log);` → `{ok: true}`  
   - Supabase `extension_data` table reflects the change.

5. **Persistence after reload**  
   - Remove local keys (`chrome.storage.local.remove([...])`), reload extension, confirm it pulls everything back.

6. **Goals sync**  
   - In Supabase, set `goals` manually.  
   - Logout via popup, log back in → `chrome.storage.local.get(['ft_user_goals'], ...)` shows the new values.  
   - `chrome.runtime.sendMessage({ type: "FT_SET_GOALS", goals: [...] })` updates Supabase.  
   - Logout clears `ft_user_goals`, `ft_user_anti_goals`.

7. **RLS security check**  
   - Supabase Table Editor: `journal_entries`, `video_classifications`, `video_sessions`, `extension_data` must show “Restricted”.

---

### 3. Channel Blocking (Phase 2.5)

1. **Button appears**  
   - On any watch page, look near channel name → red “Block Channel” button.

2. **Blocking flow**  
   - Click button → confirmation dialog (“Well done! Eliminating distractions helps you stay focused.”).  
   - Confirm → immediate redirect home.  
   - Storage shows channel in `ft_blocked_channels`.

3. **Revisit blocked channel**  
   - Opening any video from that channel redirects instantly.  
   - Console logs `[FT] Channel blocked...`.

4. **Cancel path**  
   - Start blocking another channel, click “Cancel” → channel not added.

5. **Settings controls**  
   - Web app → Settings → Controls → Blocked Channels list shows entries.  
   - Add channel → toast “Channel blocked”, list updates, redirect works.  
   - Remove channel → toast “Channel unblocked”, list updates, channel accessible again.  
   - Duplicate add → toast “Already blocked”.

6. **Case-insensitive match**  
   - Block “Eddie Hall”; variants like “eddie hall” still redirect.

7. **Persistence**  
   - Reload extension and YouTube; blocklist still applied, Settings list still populated.

8. **Multiple channels**  
   - Block several, verify all redirect and appear in list individually.

---

### 4. Trial vs Pro Parity & Trial Banner

1. **Shorts tracking parity**  
   - Set `ft_plan: "trial"`, `ft_days_left: 13`.  
   - Spend ~90 seconds on Shorts; confirm:
     ```js
     chrome.storage.local.get(
       ["ft_shorts_seconds_today","ft_shorts_engaged_today","ft_short_visits_today"],
       console.log
     );
     ```  
     Values > 0; badge visible.  
   - Switch `ft_plan: "pro"` → identical behaviour.  
   - Switch `ft_plan: "free"` → badge disappears, Shorts hard-blocks.

2. **Trial banner in popup**  
   - With plan `trial`, popup shows blue banner with days left.  
   - Update `ft_days_left` (13 → 1) to check pluralization.  
   - Click **Upgrade** → opens pricing page.  
   - Switch plan to `pro` or `free` → banner hidden.  
   - Simulate offline (set plan/days, disconnect network) → banner still renders using cached data.

3. **Trial → Free downgrade**  
   - Set `ft_plan: "trial"`, `ft_days_left: 1`, confirm banner.  
   - Then set `ft_plan: "free"`, `ft_days_left: null`; reopen popup → banner gone, status shows FREE.  
   - Shorts now follow Free behaviour (blocked).

4. **Regression spot-checks** (while still on trial/pro)  
   - Block channel + confirm redirect.  
   - Trigger spiral detection (watch 3 videos from same channel).  
   - Run searches → counter shows `X/15`.  
   - Disconnect via popup → storage cleared, banner hidden.

---

### 5. Focus Windows

1. **Settings page: Enable focus window**
   - Go to Settings → Controls → Focus Window section.
   - Toggle "Enable Focus Window" ON.
   - Set start time: "1:00 PM", end time: "6:00 PM".
   - Click "Save Focus Window".
   - Verify toast: "Focus window saved".

2. **Verify settings save to Supabase**
   ```bash
   curl "https://focustube-backend-4xah.onrender.com/extension/get-data?email=YOUR_EMAIL"
   ```
   - Check `settings.focus_window_enabled` = `true`.
   - Check `settings.focus_window_start` = `"13:00"`.
   - Check `settings.focus_window_end` = `"18:00"`.

3. **Test outside window**
   - Set system time to 10:00 AM (or adjust focus window to current time + 1 hour).
   - Visit YouTube → should see overlay: "You're Outside Your Focus Window".
   - Overlay shows: "Your YouTube window is 1:00 PM - 6:00 PM".
   - Click "Go to Settings" → opens settings page in new tab.

4. **Test inside window**
   - Set system time to 2:00 PM (or within focus window).
   - Visit YouTube → normal access, no overlay.

5. **Test edge cases**
   - Exactly at start time (1:00 PM) → should allow access.
   - Exactly at end time (6:00 PM) → should allow access.
   - 1 minute before start (12:59 PM) → should block.
   - 1 minute after end (6:01 PM) → should block.

6. **Extension popup: Settings sync**
   - Reload extension.
   - Check `chrome.storage.local.get(['ft_focus_window_enabled', 'ft_focus_window_start', 'ft_focus_window_end'], console.log);`
   - Should show enabled=true, start="13:00", end="18:00".

7. **Disable focus window**
   - Settings → toggle OFF → save.
   - Visit YouTube outside previous window → overlay no longer appears.
   - Normal access restored.

8. **Time format conversion**
   - Set times in 12h format (e.g., "9:00 AM", "11:30 PM").
   - Verify they save correctly in 24h format to backend.
   - Reload settings page → times display correctly in 12h format.

---

### 6. Dashboard

1. **Dashboard loads with real data**
   - After watching videos (with extension), visit `/app/dashboard`.
   - Should fetch from `/dashboard/stats` endpoint.
   - No "Extension not connected" message if data exists.

2. **Focus Score displays correctly**
   - Circular meter shows 0-100%.
   - Color: red (0-50), yellow (50-75), green (75-100).
   - Percentage number displayed in center.
   - Description: "Based on % of time spent on goal-aligned content vs distractions over past 7 days".

3. **Watch-Time Map shows hourly bars**
   - Bar chart displays 24 hours (0-23).
   - X-axis shows hour labels (12 AM, 2 AM, ..., 10 PM).
   - Bars show watch time in minutes (hover tooltip).
   - Color coding visible (green/yellow/red based on hour).
   - Breakdown summary shows productive/neutral/distracting percentages.

4. **Spiral Feed shows recent events**
   - If spiral events exist, list displays chronologically (most recent first).
   - Each event shows: channel name, count, type badge ("Today" or "This Week"), time detected.
   - Empty state: "No spirals detected recently. Keep up the good focus!"

5. **Channel Audit: Block button works**
   - Top 5 channels displayed with rank, videos count, minutes.
   - Click "Block" on a channel → channel added to blocklist.
   - Toast: "Channel blocked".
   - Page refreshes, channel removed from list (now blocked).

6. **Weekly Summary calculates correctly**
   - Shows total watch time this week (hours + minutes).
   - Shows % educational vs entertainment.
   - Insight sentence: "Most productive viewing: [time]. Most waste: [time]."
   - If distracting % > 50%, shows cleanup suggestion with "Block All Distractions" button.

7. **Top Distractions section**
   - If `topDistractionsThisWeek` has data, shows list with rank badges.
   - Each item shows: channel name, videos count, minutes.
   - "Block" button works (same as Channel Audit).

8. **Cleanup Suggestion**
   - If `cleanupSuggestion.hasDistractions` is true, shows card.
   - Message: "You watched X minutes of content from channels you've marked as distracting this week."
   - "Block All Distractions" button links to Settings.

9. **Empty state**
   - If no watch history, shows "Extension not connected" message.
   - Or shows components with zero/empty data gracefully.

10. **Loading state**
    - While fetching, shows "Loading dashboard data...".
    - No flash of empty content.

11. **Error state**
    - If API fails, shows error card with message and "Retry" button.
    - Retry button reloads page.

---

### 7. Quick Wrap-Up

- Confirm no console errors in background/popup/content.  
- `git status` should show only intended changes (or clean if already committed).  
- If any step fails, capture:
  - Console log snippet (`[FT] ...`).  
  - `chrome.storage.local.get(null, console.log);`.  
  - Any failing `curl` response or Supabase screenshot.

Once all sections pass, the MVP regression is complete.


---

### 7. Settings Page Redesign

1. **Page Title & Navigation**
   - Visit `/app/settings` → page title shows "Your FocusTube" (not "Settings").
   - Verify 4 tabs visible: Goals | Blocked Channels | Controls | Account.
   - Click each tab → switches correctly, content loads.

2. **Goals Tab - Display**
   - Goals tab loads existing goals from Supabase (if any).
   - Goals display as list items (not textarea).
   - Common Distractions display as list items.
   - If no goals exist, shows "No goals added yet" message.
   - If no distractions exist, shows "No distractions added yet" message.

3. **Goals Tab - Add Goals**
   - Type "Learn React" in goals input → click "Add" button (or press Enter).
   - Goal appears as list item with X button.
   - Add 2 more goals → all 3 display in list.
   - Try adding 6th goal → toast: "Maximum reached" (max 5).
   - Try adding duplicate goal → toast: "Already added".

4. **Goals Tab - Remove Goals**
   - Click X button on a goal → removes from list immediately.
   - Remove all goals → shows empty state message.

5. **Goals Tab - Save**
   - Add 2 goals, 1 distraction.
   - Click "Save Goals" button → toast: "Goals saved".
   - Verify in Supabase `users` table:
   
     curl "https://focustube-backend-4xah.onrender.com/extension/get-data?email=YOUR_EMAIL"
          - `goals` should be JSON array: `["Goal 1", "Goal 2"]`
     - `anti_goals` should be JSON array: `["Distraction 1"]`
   - Reload Settings page → goals still displayed correctly.

6. **Common Distractions Tab**
   - Same add/remove/save flow as Goals.
   - Max 5 items, deduplication works.

---

### 8. Blocked Channels Tab

1. **Display Blocked Channels**
   - Blocked Channels tab shows all channels from `extension_data.blocked_channels`.
   - Each channel displays as list item with X button.
   - If no channels, shows "No channels blocked yet".

2. **Add Channel**
   - Type "Eddie Hall" → click "Add" button (or press Enter).
   - Channel appears in list immediately.
   - Add multiple channels → all display.
   - Try duplicate → toast: "Already blocked".

3. **Remove Channel**
   - Click X on a channel → removes from list immediately.
   - Remove all → shows empty state.

4. **Save & Normalize Channels**
   - Add channels: "eddie hall", "Mr Beast", "Vikkstar123".
   - Click "Save & Normalize Channels" button.
   - Button shows "Normalizing & Saving..." while processing.
   - Page refreshes automatically after save.
   - After refresh, channels show normalized names (e.g., "Eddie Hall The Beast", "MrBeast", "Vikkstar123").
   - Verify in Supabase:
   
     curl "https://focustube-backend-4xah.onrender.com/extension/get-data?email=YOUR_EMAIL"
          - `blocked_channels` should contain normalized names.

5. **Normalization Edge Cases**
   - Add channel with typos → normalization should fix.
   - If normalization API fails → original names preserved (graceful fallback).

---

### 9. Controls Tab - Block Shorts Toggle

1. **Toggle Visibility (Pro/Trial Only)**
   - As Free user → toggle NOT visible.
   - As Pro/Trial user → toggle visible.
   - Label: "Hard Block Shorts / Track Shorts with Reminders".

2. **Toggle ON (Hard Block)**
   - Pro user: Toggle ON → description shows "Hard block Shorts (Free behavior)".
   - Click "Save All Controls" → toast: "Settings saved".
   - Verify in Supabase:
   
     curl "https://focustube-backend-4xah.onrender.com/extension/get-data?email=YOUR_EMAIL"
          - `settings.block_shorts` = `true`.
   - Reload extension.
   - Try to visit `/shorts` → immediate redirect to home (hard block).
   - Check storage:
 
     chrome.storage.local.get(['ft_pro_manual_block_shorts', 'ft_block_shorts_today'], console.log);
          - Both should be `true`.

3. **Toggle OFF (Track with Reminders)**
   - Pro user: Toggle OFF → description shows "Track Shorts with reminders (Pro behavior)".
   - Click "Save All Controls".
   - Verify `settings.block_shorts` = `false`.
   - Reload extension.
   - Visit `/shorts` → allowed, tracking active, reminders at 2/5/10 min.
   - Check storage:
 
     chrome.storage.local.get(['ft_pro_manual_block_shorts', 'ft_block_shorts_today'], console.log);
          - Both should be `false`.

---

### 10. Controls Tab - Hide Recommendations

1. **Toggle Display**
   - Controls tab shows "Hide Recommendations" toggle.
   - Description: "Remove suggested videos from sidebar and homepage".

2. **Toggle ON - Watch Page**
   - Toggle ON → click "Save All Controls".
   - Verify `settings.hide_recommendations` = `true`.
   - Reload extension.
   - Visit any YouTube watch page (e.g., `/watch?v=...`).
   - Sidebar recommendations (`ytd-watch-next-secondary-results-renderer`) should be hidden.
   - "Up next" section should be hidden.
   - Check console: `[FT]` logs should show recommendations hidden.

3. **Toggle ON - Homepage**
   - Visit YouTube homepage (`/`).
   - Main feed (`ytd-rich-grid-renderer`) should be hidden.
   - Recommendation sections should be hidden.
   - Page should appear mostly empty (only header/sidebar nav visible).

4. **Toggle OFF**
   - Toggle OFF → save.
   - Reload extension.
   - Visit watch page → sidebar recommendations visible.
   - Visit homepage → feed visible.

5. **Dynamic Content**
   - With toggle ON, navigate between pages.
   - Recommendations stay hidden on new pages.
   - MutationObserver should re-hide if YouTube adds content dynamically.

6. **Cross-Tab Sync**
   - Open 2 YouTube tabs.
   - Change toggle in Settings → save.
   - Both tabs should update (hide/show recommendations) without reload.

---

### 11. Controls Tab - Daily Limit Slider

1. **Slider Display**
   - Controls tab shows "Daily limit" slider.
   - Default value: 90 minutes (if not set).
   - Range: 15-150 minutes, step 15.
   - Badge shows current value: "90 minutes".

2. **Adjust Slider**
   - Drag slider to 60 minutes → badge updates to "60 minutes".
   - Drag to 120 minutes → badge shows "120 minutes".

3. **Save & Apply**
   - Set to 60 minutes → click "Save All Controls".
   - Verify `settings.daily_limit` = `60` in Supabase.
   - Reload extension.
   - Watch videos for 60 minutes → at 60:01, should see time limit overlay.
   - Overlay message uses selected nudge style.

4. **Default Value**
   - New user (no setting) → slider shows 90.
   - After saving, reload → slider shows saved value.

5. **Extension Enforcement**
   - Set limit to 30 minutes (for quick test).
   - Watch videos → at 30 minutes, blocking should trigger.
   - Check background console: `[FT]` logs should show limit reached.

---

### 12. Controls Tab - Focus Window

1. **Focus Window (Existing Tests)**
   - Re-run tests from Section 5 (Focus Windows).
   - Verify still works with new Settings page layout.

---

### 13. Controls Tab - Nudge Style

1. **Style Selection**
   - Controls tab shows "Nudge Style" section.
   - 3 buttons: Gentle, Direct, Firm.
   - Default: Firm (selected/highlighted).

2. **Select Style**
   - Click "Gentle" → button highlights, others unhighlight.
   - Click "Direct" → switches correctly.
   - Click "Firm" → switches correctly.

3. **Save Style**
   - Select "Gentle" → click "Save All Controls".
   - Verify `settings.nudge_style` = `"gentle"` in Supabase.
   - Reload extension.

4. **Spiral Nudge - Style Applied**
   - Watch 3 videos from same channel (trigger spiral).
   - Spiral nudge should show: "Still learning?" (Gentle style).
   - Change to "Direct" → save → trigger again → shows: "Check your goals".
   - Change to "Firm" → save → trigger again → shows: "Time's up".

5. **Time Limit Overlay - Style Applied**
   - Set daily limit to 15 minutes (quick test).
   - Watch until limit reached.
   - Overlay message should use selected style:
     - Gentle: "Take a break?"
     - Direct: "You're over your limit"
     - Firm: "Blocked for today"

6. **Focus Window Overlay - Style Applied**
   - Enable focus window, set outside current time.
   - Visit YouTube → overlay shows style message:
     - Gentle: "Maybe step away?"
     - Direct: "Time to focus"
     - Firm: "Focus now"

7. **Journal Nudge - Style Applied**
   - Pro user: Watch distracting content for 1 minute.
   - Journal nudge placeholder should use selected style (all styles use same text for journal).

---

### 14. Account Tab

1. **Subscription Display**
   - Account tab shows current plan (Free/Trial/Pro).
   - Free users see "Upgrade to Pro" button.
   - Pro/Trial users see plan name only.

2. **Sign Out**
   - Click "Sign Out" → redirects to `/login`.
   - Extension storage cleared.
   - Popup shows onboarding.

---

### 15. Settings Loading (No Defaults)

1. **Load Exact Saved Values**
   - Set goals: ["Goal 1", "Goal 2"].
   - Set daily limit: 75 minutes.
   - Set nudge style: "direct".
   - Save all.
   - Reload Settings page.
   - Goals show exactly: ["Goal 1", "Goal 2"] (not defaults).
   - Daily limit shows: 75 (not 90).
   - Nudge style shows: Direct selected (not Firm).

2. **New User (No Settings)**
   - Fresh account with no saved settings.
   - Goals tab: Empty lists (no default text).
   - Daily limit: Shows 90 (only default if not set).
   - Nudge style: Shows Firm (only default if not set).
   - Blocked channels: Empty list.

---

### 16. Integration Tests

1. **Settings Persist Across Sessions**
   - Set all settings (goals, channels, controls).
   - Save all.
   - Close browser completely.
   - Reopen → log in → Settings page.
   - All settings should be exactly as saved.

2. **Extension Syncs Settings**
   - Change settings in web app → save.
   - Reload extension.
   - Check storage:
     
     chrome.storage.local.get(['ft_extension_settings'], console.log);
          - Should contain: `block_shorts`, `hide_recommendations`, `daily_limit`, `nudge_style`.

3. **Block Shorts + Hide Recs Together**
   - Pro user: Enable both toggles.
   - Save.
   - Visit YouTube:
     - Shorts should be blocked (hard redirect).
     - Recommendations should be hidden.

4. **Daily Limit + Nudge Style**
   - Set limit to 30 minutes, style to "gentle".
   - Watch until limit → overlay shows gentle message.

---

### 17. Quick Wrap-Up

- Confirm no console errors in background/popup/content.  
- Verify page titles: "Your FocusTube" (Settings), "Your Stats" (Dashboard).  
- `git status` should show only intended changes (or clean if already committed).  
- If any step fails, capture:
  - Console log snippet (`[FT] ...`).  
  - `chrome.storage.local.get(null, console.log);`.  
  - Any failing `curl` response or Supabase screenshot.
  - Screenshot of Settings page showing issue.

Once all sections pass, the MVP regression is complete.