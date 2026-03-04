# FocusTube Test Plan – Cases 6‑17

Expanded checklist for the remaining functional tests referenced in `WHERE_WE_AT.md`. Run after completing Tests 1‑5.

---

## Prep (run once)
1. Reload extension: `chrome://extensions` → toggle FocusTube off/on.
2. Open service worker console: `chrome://extensions` → Inspect views → `background/background.html`.
3. Optional clean slate: `chrome.storage.local.clear(() => console.log("Cleared"));`
4. Have Supabase SQL tab ready plus curl access for quick server checks.

---

## Test 6 – Focus window check during playback (5 min)
**Steps**
1. In Settings → Controls, enable “Focus Window” and set hours that exclude the current time (e.g., window = 18:00‑19:00 while it’s 14:00).
2. Save controls (should toast “Settings saved”).
3. Open any long YouTube video and let it play.
4. Wait ~30 seconds for the periodic check.
5. Change window to include the current time and save again.

**Expected**
- Overlay message `🕐 You're Outside Your Focus Window` appears during playback (not only on navigation).
- Page stops scrolling/video pauses; no buttons available.
- Overlay disappears automatically once the active window includes the current time.

**Helpful commands**
```js
chrome.storage.local.get(["ft_focus_window_enabled","ft_focus_window_start","ft_focus_window_end"], console.log);
```

---

## Test 7 – Watch‑Time Map scale (2 min)
**Steps**
1. Watch short bursts of content at different hours (morning, afternoon, night) or use stored data.
2. Open dashboard once data is synced.

**Expected**
- Watch-Time Map shows bars at hours with activity.
- Scale auto-expands (max value +10% padding, min scale 10 min) so bars are not bunched at the bottom.
- Hover tooltip displays minutes.

---

## Test 8 – Logout timer persistence (3 min)
**Steps**
1. With plan logged in, accumulate at least ~120 seconds (watch or fast-forward).
2. Log out of the FocusTube website.
3. Keep watching for another minute while logged out.
4. Log in again.

**Expected**
- `ft_watch_seconds_today` retains cumulative time (not reset on logout).
- After login, local timer matches or exceeds pre-logout total.

**Helpful command**
```js
chrome.storage.local.get(["ft_watch_seconds_today"], console.log);
```

---

## Test 9 – Sign-in sync & default to Free (3 min)
**Steps**
1. Clear auth (log out everywhere).
2. Navigate YouTube; extension should treat you as Free.
3. Inspect storage for `ft_plan`.
4. Log back in via popup or website.

**Expected**
- While logged out: plan defaults to `"free"`, shorts blocked, free limits active.
- After login: plan pulled from backend (trial/pro) within seconds; popup status matches website.

**Helpful command**
```js
chrome.storage.local.get(["ft_plan","ft_user_email"], console.log);
```

---

## Test 10 – Goals auto‑block sync after signup (6 min)
**Steps**
1. Visit `/goals` while logged in with a fresh/secondary email.
2. Add at least one “Common Distraction” channel, toggle “Block these channels immediately”.
3. Submit the form.
4. Without reloading extension, open YouTube and check `chrome.storage.local.get(["ft_blocked_channels"])`.

**Expected**
- Newly added distractions appear in `ft_blocked_channels` immediately (thanks to `FT_RELOAD_SETTINGS` postMessage).
- Visiting a video from that channel redirects home instantly.

**Server verification**
```bash
curl "https://focustube-backend-4xah.onrender.com/extension/get-data?email=YOU"
```

---

## Test 11 – Website → Extension block sync (4 min)
**Steps**
1. On dashboard “Biggest Distractions” or Channel Audit, click `Block` for a channel.
2. Observe background console for `[FT] Settings reloaded...`.
3. Attempt to open the channel on YouTube.

**Expected**
- Within seconds, extension loads revised blocklist and hard-redirects.
- `chrome.storage.local.get(['ft_blocked_channels'])` contains the new channel without manual reload.

---

## Test 12 – Extension → Website block sync (4 min)
**Steps**
1. From a YouTube video, use the injected “Block Channel” overlay/button (or spiral nudge action) to block a channel.
2. Open `/app/settings` → Blocked Channels.

**Expected**
- Blocked channel appears in the settings list after page refresh (Supabase merge succeeded).
- Saving from settings keeps both entries (smart merge, no overwrites).

---

## Test 13 – Manage Account button wiring (2 min)
**Steps**
1. Open extension popup while logged in.
2. Click `Manage Account`.

**Expected**
- New tab opens to `https://focustube-beta.vercel.app/app/settings`.
- Popup closes; website shows authenticated session.

---

## Test 14 – Onboarding overlay + FT_RELOAD (3 min)
**Steps**
1. Clear onboarding flag: `chrome.storage.local.remove("ft_onboarding_completed")`.
2. Reload YouTube homepage.

**Expected**
- Full-screen onboarding overlay appears with CTA buttons.
- Clicking “Got it” sets `ft_onboarding_completed=true`, hides overlay, and triggers `handleNavigation()` to resume normal flow.

---

## Test 15 – Shorts blocking flows (6 min)
**Steps**
1. Ensure plan = Free. Visit `/shorts/...`: confirm free overlay (`Shorts are blocked on the Free plan...`) plus upgrade CTA.
2. Switch to Pro/Trial, enable “Block Shorts” from Settings, save.
3. Visit Shorts again.

**Expected**
- Free plan: overlay with `Back to Home Screen` + `Upgrade to Pro`.
- Pro manual block: overlay text `You have chosen to block Shorts for today...` with `Continue` button.
- In both cases, navigation prevents Shorts playback until user re-enables.

---

## Test 16 – Spiral nudge & actions (8 min)
**Steps**
1. Watch ≥3 videos from the same channel (or 2 distracting ones) to trigger spiral detection.
2. When overlay appears, test each button:
   - `Continue`
   - `Block for Today`
   - `Block Permanently`

**Expected**
- Overlay title uses nudge style (`⚠️ Time's up` etc.), countdown from 10.
- `Continue` dismisses overlay and clears spiral flag.
- `Block for Today` redirects to YT home, channel stored in daily block list.
- `Block Permanently` adds channel to Supabase + local storage; future visits redirect immediately.

---

## Test 17 – Dashboard data freshness & category math (6 min)
**Steps**
1. After generating fresh watch events (≥45s), wait for `/events/watch` to log.
2. Refresh dashboard.

**Expected**
- `Content Categories` card reflects new data (videos/minutes update, totals aligned with Supabase query).
- `Most Viewed Channels` percentages add up (percentage = channel minutes / total watch time).
- `Top Distractions` shows newly blocked channels with `Block` CTA.

**Verification**
```bash
psql or Supabase SQL:
SELECT category_primary, COUNT(*) videos, SUM(watch_seconds) seconds
FROM video_sessions
WHERE user_id = <uuid> AND watched_at > now() - interval '60 days'
GROUP BY 1 ORDER BY seconds DESC;
```

---

**Completion criteria:** all 12 tests above pass without manual extension reloads, and any regressions are logged in `WHERE_WE_AT.md` for follow-up. Update this file whenever wording, flows, or expected results change.

