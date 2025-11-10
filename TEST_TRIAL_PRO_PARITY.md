## Trial vs Pro Parity QA

Run these steps after pulling the latest extension build. They verify that trial accounts get the full Pro feature set (Shorts tracking, AI, spiral) plus the new trial reminder banner, while Free users stay limited.

---

### 0. Prep

1. Open `chrome://extensions`, enable **Developer Mode**, and `Inspect views → background/background.html` so you can watch `[FT]` logs.
2. Keep the storage viewer handy in the background console:
   ```js
   chrome.storage.local.get(null, console.log);
   ```
3. If you need a clean slate, run:
   ```js
   chrome.storage.local.clear(() => console.log("Storage cleared"));
   ```
   Then toggle the extension off/on to make sure defaults are recreated.

---

### 1. Trial plan is treated like Pro

1. **Set plan to trial** (if not already):
   ```js
   chrome.storage.local.set({
     ft_plan: "trial",
     ft_days_left: 13
   });
   ```
2. Navigate to `https://www.youtube.com/shorts/...`.
3. Watch at least two Shorts clips for ~90 seconds total. Scroll to at least one new video.
4. Confirm counters move:
   ```js
   chrome.storage.local.get(
     ["ft_shorts_seconds_today", "ft_shorts_engaged_today", "ft_short_visits_today"],
     console.log
   );
   ```
   All three should be > 0. The Shorts badge should be visible.
5. Navigate to a Watch page and confirm AI + spiral still run (check for the usual `[FT]` classification / spiral logs).
6. Change plan to `pro` and repeat the same steps — results should be identical.
7. Change plan to `free` and reload Shorts. The Shorts badge should **not** appear and Shorts should block immediately (existing Free behaviour).

---

### 2. Trial banner in the popup

1. Open the extension popup (click the FocusTube icon).
2. With `ft_plan: "trial"` and `ft_days_left` set, the popup should show a blue “Pro trial” banner between the account row and the Disconnect button.
   - If `ft_days_left` is a number, the heading should read e.g. `Pro trial: 13 days left`.
   - Change `ft_days_left` to `1` and reopen the popup → heading should use singular (“1 day left”).
3. Click **Upgrade** — a new tab should open `https://focustube-beta.vercel.app/pricing`.
4. Switch plan to `pro` or `free`:
   ```js
   chrome.storage.local.set({ ft_plan: "pro" });
   ```
   Reopen the popup → the banner should be hidden.
5. Simulate a cached/offline state:
   - Set `ft_plan: "trial"` and `ft_days_left: 5`.
   - Disconnect your network, reopen the popup.
   - The banner should still show using the cached values.

---

### 3. Trial → Free downgrade snapshot

1. Set trial state with only 1 day left:
   ```js
   chrome.storage.local.set({
     ft_plan: "trial",
     ft_days_left: 1
   });
   ```
2. Open the popup, note the banner.
3. Simulate trial expiry:
   ```js
   chrome.storage.local.set({
     ft_plan: "free",
     ft_days_left: null
   });
   ```
4. Reload the popup. The banner should disappear and the status should read `Plan: FREE`.
5. Open Shorts → badge/timers should be disabled (Free behaviour).

---

### 4. Regression spot-checks

1. **Channel blocking & spiral**: while still in Trial or Pro, confirm the “Block Channel” button and spiral nudges still work (no change expected).
2. **Search counter**: run a few searches and verify it still reads `X/15` in trial/pro and `X/5` in free.
3. **Logout**: click Disconnect in the popup. All trial indicators should clear, banner hidden, plan resets to free until you reconnect.

If any step deviates, capture the `[FT]` console log and storage snapshot so we can trace the regression quickly.

