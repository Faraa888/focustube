# FocusTube Launch Plan - 12 Hour Sprint

**Goal:** Ship MVP with core functionality tested and deployed

---

## Phase 1: Core Functionality (3 hours)

### 1.1 Data Sync & Storage (45 min)
- [ ] Watch 3 videos → confirm they appear in `video_sessions` within 60s
- [ ] Switch accounts → confirm dashboard shows correct user's data only
- [ ] Check `user_email` auto-populates in all tables (triggers working)
- [ ] Test offline → watch video, reconnect → confirm queue flushes

**Success:** Videos sync to Supabase, no cross-account contamination

---

### 1.2 Blocked Channels (30 min)
- [ ] Add channel via Settings → confirm it saves to Supabase
- [ ] Try to remove channel → expect UI prevents it (button removed)
- [ ] Try to save smaller list via API → expect 400 error
- [ ] Confirm channels persist after logout/login

**Success:** Channels are permanently blocked, can't be removed

---

### 1.3 Dashboard (45 min)
- [ ] Open dashboard → confirm it shows data from `video_sessions` (not legacy blob)
- [ ] Check focus score calculates correctly
- [ ] Verify time breakdowns (today/week) match actual watch time
- [ ] Test empty state (new user) → shows "no data yet"

**Success:** Dashboard reads from `video_sessions` only, stats are accurate

---

## Phase 1.4: Spiral Detection & Nudging (30 min)

### Spiral Detection Tests
- [ ] Watch 3 videos from same channel today → expect spiral nudge on 3rd video
- [ ] Watch 5 videos from same channel this week → expect spiral nudge on 5th video
- [ ] Watch 2 consecutive distracting videos (within 1 hour) → expect weighted count (1.5x)
- [ ] Watch 3+ consecutive distracting videos → expect weighted count (2.0x)
- [ ] Wait 24+ hours → verify decay reduces week count by 1
- [ ] Spiral nudge shows correct channel name and count
- [ ] Spiral nudge has 10-second countdown timer
- [ ] "Continue" button dismisses nudge
- [ ] "Block YouTube for Today" button works
- [ ] "Block Channel Permanently" button works and redirects

**Success:** Spiral detection triggers correctly, nudges show, actions work

### Journal Nudge Tests
- [ ] Watch distracting video for 60+ seconds → expect journal nudge
- [ ] Journal nudge shows correct video title and channel
- [ ] "Save" button saves journal entry
- [ ] "Dismiss" button closes nudge
- [ ] Journal nudge doesn't show twice for same video

**Success:** Journal nudges trigger at 60s, save correctly

## Phase 2: AI & Classification (1.5 hours)

### 2.1 AI Classifier (45 min)
- [ ] Watch productive video → confirm classification = "productive"
- [ ] Watch distracting video → confirm classification = "distracting"
- [ ] Check cache works (same video twice = cache hit in logs)
- [ ] Test fallback (if API fails) → returns "neutral"

**Success:** AI classifies correctly, cache works, fallback safe

---

### 2.2 Pro Plan Features (45 min)
- [ ] Test AI filtering for Pro users (distracting content gets allowance)
- [ ] Test Free plan → no AI classification, neutral fallback
- [ ] Confirm allowance decrements correctly

**Success:** Pro users get AI filtering, Free users get neutral fallback

---

## Phase 3: UI & Copy Polish (2 hours)

### 3.1 Settings Page (30 min)
- [ ] Blocked channels UI shows "permanently blocked" message
- [ ] No remove button visible
- [ ] Goals/anti-goals save correctly
- [ ] Settings persist across sessions

**Success:** Settings UI is clear, no broken functionality

---

### 3.2 Dashboard UI (30 min)
- [ ] All charts render without errors
- [ ] Focus score displays correctly
- [ ] Time breakdowns are accurate
- [ ] Mobile responsive (quick check)

**Success:** Dashboard renders correctly, no console errors

---

### 3.3 Copy Review (1 hour)
- [ ] Read all user-facing text (Settings, Dashboard, Popup)
- [ ] Fix typos/grammar
- [ ] Ensure messaging is clear ("permanently blocked", etc.)
- [ ] Check error messages are helpful

**Success:** All copy is clear, professional, no typos

---

## Phase 4: Architecture Sync (1 hour)

### 4.1 Extension ↔ Website Sync (30 min)
- [ ] Login on website → extension popup shows same email
- [ ] Logout on website → extension clears local data
- [ ] Block channel on website → appears in extension popup
- [ ] Watch video → dashboard updates within 60s

**Success:** Extension and website stay in sync

---

### 4.2 Cross-Device (30 min)
- [ ] Test on second browser/device (if possible)
- [ ] Confirm data syncs across devices
- [ ] Timer syncs correctly

**Success:** Data syncs across devices (optional if time is tight)

---

## Phase 5: Final Checks & Deployment (4.5 hours)

### 5.1 Pre-Deployment Checks (1 hour)
- [ ] Remove all console.logs (or set DEBUG = false)
- [ ] Check environment variables are set (Render, Vercel)
- [ ] Verify Stripe keys are production (not test)
- [ ] Confirm Supabase RLS policies are correct
- [ ] Test with real Stripe checkout (small amount)

**Success:** Production-ready config, no debug code

---

### 5.2 Build & Test Locally (1 hour)
- [ ] Build extension (`npm run build` in extension folder)
- [ ] Test built extension in Chrome (unpacked)
- [ ] Build frontend (`npm run build` in frontend folder)
- [ ] Test production build locally

**Success:** Production builds work, no errors

---

### 5.3 Deploy Backend (30 min)
- [ ] Push to main branch (triggers Render deploy)
- [ ] Monitor Render logs for errors
- [ ] Test `/health` endpoint
- [ ] Test `/license/verify` endpoint

**Success:** Backend deployed, endpoints responding

---

### 5.4 Deploy Frontend (30 min)
- [ ] Push to main branch (triggers Vercel deploy)
- [ ] Test live site (login, dashboard, settings)
- [ ] Confirm all API calls work

**Success:** Frontend deployed, site works in production

---

### 5.5 Package Extension (1 hour)
- [ ] Create production build
- [ ] Test in fresh Chrome profile (no existing data)
- [ ] Create zip file for Chrome Web Store
- [ ] Write store listing (screenshots, description)
- [ ] Submit to Chrome Web Store (or prepare for manual upload)

**Success:** Extension packaged, ready for store submission

---

## Critical Path (If Time is Tight - 6 hours)

1. **Data sync works** (Phase 1.1) - 45 min
2. **Dashboard shows data** (Phase 1.3) - 45 min
3. **Blocked channels work** (Phase 1.2) - 30 min
4. **AI classifier works** (Phase 2.1) - 45 min
5. **Deploy everything** (Phase 5.3-5.4) - 1 hour
6. **Package extension** (Phase 5.5) - 1 hour

**Skip:** Cross-device testing, extensive copy polish, mobile responsive deep-dive

---

## Success Criteria

✅ Users can sign up, log in, and see their dashboard  
✅ Watch events sync to `video_sessions` within 60s  
✅ Blocked channels persist and can't be removed  
✅ AI classification works for Pro users  
✅ No 500 errors in production logs  
✅ Extension installs and works on fresh Chrome profile  

---

## When to Open New Windows

- **Phase 1:** Keep current setup (Render logs + Supabase + Extension console)
- **Phase 3:** Open new tab for copy review (read through all pages)
- **Phase 5:** Open Chrome Web Store developer dashboard (for submission)

---

## Known Issues / Limitations

### Test 12: Race Condition in Blocked Channels
- **Issue**: If two browser tabs save blocked channels simultaneously, the last save wins (one channel may be lost)
- **Impact**: Low - users rarely have two Settings tabs open
- **Status**: Documented, fix post-MVP
- **Workaround**: Refresh Settings page after saving

### Dashboard Data Mismatch
- **Issue**: Dashboard shows different watch time totals than Supabase queries (e.g., 479s vs 211s for productive/neutral)
- **Impact**: Medium - Focus score calculation may be inaccurate
- **Status**: Needs investigation (possible timezone issue or data sync problem)
- **Workaround**: None - needs backend fix

---

## Post-MVP Features

### Global Blocklist (Community Voting + Admin Curation)
- **Goal**: Auto-block channels that are inherently distracting for all users
- **Approach**: 
  1. Track when users individually block channels (community votes)
  2. If 10+ users block the same channel → Flag for admin review
  3. Admin reviews and adds to `global_blocked_channels` table
  4. Extension checks global list before allowing video playback
- **Database Tables Needed**:
  - `channel_block_votes` (track community votes)
  - `global_blocked_channels` (admin-curated list)
- **Implementation**: Post-MVP (requires admin dashboard, voting system, extension integration)
- **Future Enhancement**: AI batch classification to suggest candidates for admin review

---

## Notes

- Fix issues as they come up - don't move forward with broken functionality
- If something is blocking, document it and move to next item
- Prioritize core user flow: Sign up → Watch video → See dashboard → Block channel

