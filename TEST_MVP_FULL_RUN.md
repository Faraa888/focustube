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

### 5. Quick Wrap-Up

- Confirm no console errors in background/popup/content.  
- `git status` should show only intended changes (or clean if already committed).  
- If any step fails, capture:
  - Console log snippet (`[FT] ...`).  
  - `chrome.storage.local.get(null, console.log);`.  
  - Any failing `curl` response or Supabase screenshot.

Once all sections pass, the MVP regression is complete.

