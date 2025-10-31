You are my senior extension engineer. We are building a Chrome MV3 extension called “FocusTube (MVP)”. The codebase has become inconsistent. Your job is to:
1) Normalize the project to a clean, minimal, working baseline.
2) Implement Lesson 7E features (Shorts blocking, Search counting + block overlay).
3) Keep the design modular so we can add AI later without rewrites.
4) Work FILE BY FILE with diffs, never introduce duplicate logic, and NEVER regress existing working behaviors.

############################
# PROJECT GOALS (7E scope) #
############################
- Detect YouTube page types: HOME, WATCH, SEARCH, SHORTS, OTHER
- For SHORTS:
  - Always block in FREE plan (strict_shorts = true)
  - Pause/mute shorts video and (optionally) show overlay or redirect
- For SEARCH:
  - Track ft_searches_today
  - Block search results when threshold reached (FREE=5, PRO=15 default)
  - Show an overlay message on search results page when blocked
- Keep “decide/logic” in background, “DOM actions” in content
- Maintain SPA navigation hooks (history.pushState / replaceState / popstate)
- Keep overlay UI in CSS (content/overlay.css) and minimal JS in content.js

#########################
# REQUIRED FILE LAYOUT  #
#########################
Root:
- manifest.json (MV3, module service worker)
- background/background.js (single onMessage listener; message router)
- content/content.js (SPA router, pause shorts, show/hide overlay)
- content/overlay.css (pure styling for overlay; no inline CSS in JS)
- lib/constants.js (PLAN_FREE/PRO, PERIOD_DAILY/WEEKLY, etc.)
- lib/state.js (ensureDefaults, get/set storage helpers, rotation, plan config, bump counters, temp unlock helpers)
- lib/rules.js (evaluateBlock(ctx): returns {blocked, scope, reason})
- README.md (brief: how to load and test)
- FOCUSTUBE_TASKS.md (this prompt; keep up to date)

#######################
# KEY ARCHITECTURE    #
#######################
- Background is the **single source of truth** for decisions:
  - Handles messages:
    - FT_NAVIGATED { pageType, url } → returns decision { ok, blocked, scope, reason, ft_searches_today }
    - FT_TEMP_UNLOCK { minutes } (optional stub OK)
    - FT_PING → health
  - Uses MV3-safe listener pattern (non-async listener that returns true immediately; async IIFE inside).
  - Calls lib/state.js (ensureDefaults, maybeRotateCounters, bump, getPlanConfig)
  - Calls lib/rules.js (evaluateBlock(ctx)) for final decision

- Content script:
  - Detects pageType (regex on location.href)
  - SPA hooks: run handleNavigation on page load, history push/replace, popstate, readystatechange
  - Sends FT_NAVIGATED to background → applies ONLY DOM actions:
    - If decision.scope === "shorts" && blocked: pause/mute shorts via MutationObserver
    - If decision.scope === "search" && blocked: show overlay (CSS-driven)
    - Else: hide overlay, stop shorts observer
  - Expose window.FT_nav(pageType) for manual testing

- Overlay:
  - content/overlay.css holds all visuals
  - content.js creates minimal DOM:
    <div id="ft-overlay"><div class="ft-box"><h1>FocusTube</h1><p id="ft-overlay-message"></p><button id="ft-unlock">Temporary Unlock (dev)</button></div></div>
  - content.js sets message text and wires the button (dev-only)

############################
# NON-NEGOTIABLE INVARIANTS
############################
- ONE background message listener only. Do NOT leave duplicates.
- ONE detectPageType() only (regex-based).
- ONE FT_nav() only (exposed via window).
- Use MV3 pattern:
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
      try {
        // handle types, await helpers, then sendResponse(...)
      } catch (e) { sendResponse({ ok:false, error:String(e) }); }
    })();
    return true; // keep port open
  });

- lib/state.js must export:
  - ensureDefaults(), maybeRotateCounters(period?=null, now?=new Date())
  - getLocal(keys), setLocal(obj)
  - getResetPeriod(), resetCounters()
  - CONFIG_BY_PLAN, getPlanConfig(), setPlan()
  - bump(key)
  - isTemporarilyUnlocked(now=Date.now()), (optional) setTemporaryUnlock(...)
  - DEFAULTS contains ft_searches_today, ft_short_visits_today, ft_watch_visits_today, ft_watch_seconds_today, ft_blocked_today, ft_unlock_* keys, ft_reset_period, ft_last_reset_key, ft_plan

- lib/rules.js must export:
  - evaluateBlock(ctx) → { blocked:boolean, scope:"none"|"global"|"shorts"|"search", reason:string }
  - Rules for FREE: strict_shorts=true; search_threshold=5
  - Rules for PRO: strict_shorts=false; search_threshold=15
  - Use ctx: { pageType, ft_searches_today, planConfig, now, unlocked:boolean }

############################
# CLEANUP / MESS PREVENTION
############################
- Delete any duplicate:
  - detectPageType, FT_nav, notifyNavigation, MutationObservers that aren’t shorts
  - onMessage listeners for FT_NAVIGATED / FT_PING
- No inline overlay styles in JS except the minimal container creation; move styling to overlay.css
- No console spam: leave LOG gated by a DEBUG flag
- Comments: keep concise. Add a header comment per file describing purpose.

#####################
# IMPLEMENTATION PLAN
#####################
PHASE A — Normalize & compile
1. Normalize manifest.json: MV3, background.service_worker as module, content script includes content.js and overlay.css.
2. Ensure all imports/exports resolve (lib files imported with relative paths).
3. Ensure only one background listener (MV3 pattern).

PHASE B — State & Rules
4. lib/constants.js: export PLAN_FREE, PLAN_PRO, PERIOD_DAILY, PERIOD_WEEKLY.
5. lib/state.js: implement storage helpers, ensureDefaults, rotation, plan config, bump, unlock helpers, DEFAULTS.
6. lib/rules.js: implement evaluateBlock(ctx) using plan config and counters.

PHASE C — Background
7. background/background.js: on install/startup → ensureDefaults(); maybeRotateCounters();
8. onMessage router with MV3-safe pattern:
   - FT_NAVIGATED: call ensureDefaults(), maybeRotateCounters(); update counters (if SEARCH → bump); read plan; unlocked = isTemporarilyUnlocked(); call evaluateBlock(ctx); set ft_blocked_today if global block; send decision.
   - FT_TEMP_UNLOCK: stub ok
   - FT_PING: ok
   - No other listeners.

PHASE D — Content
9. content/content.js:
   - detectPageType() using regex
   - handleNavigation(): if pageType changed, call FT_nav(pageType) and act:
     - if resp.blocked && resp.scope === "shorts" && pageType === "SHORTS": enforceShortsBlocked() (pause/mute via MutationObserver)
     - if resp.blocked && resp.scope === "search" && pageType === "SEARCH": ensureOverlay("Search limit reached. Take a breather.")
     - else: hideOverlay(); stop shorts observer
   - SPA hooks: history patch, popstate, readystatechange, initial call
   - expose window.FT_nav = FT_nav

10. content/overlay.css: all visuals for overlay. Minimal but readable.

#########################
# ACCEPTANCE CRITERIA   #
#########################
- Load unpacked extension without errors.
- From YouTube tab console (content context):
  - await FT_nav("HOME") → blocked:false
  - await FT_nav("SEARCH") called 6 times → from 5+: blocked:true, scope:"search"
  - await FT_nav("SHORTS") → blocked:true, scope:"shorts"
- Real navigation:
  - Visiting /shorts/... pauses player immediately and stays paused on DOM swaps.
  - Performing ≥5 searches shows overlay on results page.
- No “message port closed before response” errors.
- No duplicate listeners, no duplicate helpers, no inline overlay CSS.

#########################
# DIFF & REVIEW POLICY  #
#########################
- Work ONE FILE at a time.
- For each file: show a concise plan, then a single diff block.
- After each file change, run a quick compile/type check (if applicable) and state status.
- STOP if a failing invariant appears; show me the exact error and suggested fix.

#########################
# NEXT FEATURES (LATER) #
#########################
- Popup dashboard, plan toggle, reset rotation UI.
- AI classification hook in background (call OpenAI with title/channel).
- Sidebar/home feed toggles.

Begin with PHASE A step 1. Show what you’ll change in manifest.json and why, then the diff. After I approve, proceed to the next file.