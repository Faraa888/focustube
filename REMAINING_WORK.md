# What's Left Beyond Testing

## ✅ Already Implemented (Based on Code Review)

1. **Settings Page Redesign** - Complete with tabs, goals, channels, controls
2. **Focus Windows** - Time-based blocking working
3. **Dashboard** - Real data integration complete
4. **Channel Blocking** - Hard blocks + normalization working
5. **Extension Settings** - Block shorts, hide recommendations, daily limit, nudge style
6. **Journal Nudge** - Implemented in content.js (shows after 1 min of distracting content)
7. **Spiral Detection** - 3+ same channel, 2+ distracting in row
8. **AI Classification** - Working with OpenAI
9. **Data Sync** - Extension ↔ Supabase ↔ Backend

---

## 🔨 Remaining Work (Post-Testing)

### 1. **Bug Fixes** (From Test Results)
**Priority: HIGH** - Fix before launch

- [x] **Test 2.6 - Goals Sync Format Mismatch** ✅ **FIXED**
  - ~~Issue: Goals saved as plain text instead of JSON array~~
  - **Status:** Fixed! `Goals.tsx` uses `arrayToJsonString()` which calls `JSON.stringify()`, and `Settings.tsx` uses `JSON.stringify()` directly
  - Both now correctly save goals as JSON arrays: `["Goal 1", "Goal 2"]`

- [ ] **Test 1.7 - Session Persistence** ⚠️ **NEEDS VERIFICATION**
  - Issue: Dashboard requires re-login after browser restart
  - **Code Status:** Implementation looks correct:
    - `supabase.ts` has `persistSession: true` ✅
    - `useRequireAuth.ts` handles `INITIAL_SESSION` event ✅
  - **Possible Causes:**
    - Supabase session actually expired (sessions expire after ~1 hour of inactivity)
    - Browser localStorage blocked/cleared
    - Supabase storage type configuration issue
  - **Action:** Re-run test 1.7 to verify if it's still failing or if it was a false positive
  - Estimated: 30 minutes (if still failing)

---

### 2. **Phase 4: Nudges & UX Polish** (~2-3 hours)
**Priority: MEDIUM** - Nice to have, not blocking

- [ ] **Trial Milestone Messages**
  - Show special messages at trial milestones (e.g., "7 days left", "Last day")
  - Estimated: 1 hour

- [ ] **Usage Alerts** (30-min reminders)
  - Already implemented in background.js, but verify it's working correctly
  - Estimated: 30 minutes

- [ ] **Journal Nudge Polish**
  - Already implemented, but verify:
    - Triggers correctly after 1 min of distracting content
    - Saves to backend correctly
    - Shows correct nudge style message
  - Estimated: 30 minutes

---

### 3. **Phase 6: Copy & Layout Polish** (~3-4 hours)
**Priority: MEDIUM** - Important for launch quality

- [ ] **Frontend Copy Review**
  - Review all text on landing page, signup, dashboard, settings
  - Ensure consistent tone and messaging
  - Fix typos, improve clarity
  - Estimated: 1-2 hours

- [ ] **Extension UI Updates**
  - Review popup text and messages
  - Ensure all overlays have consistent styling
  - Check error messages are user-friendly
  - Estimated: 1 hour

- [ ] **Layout Consistency**
  - Ensure spacing, colors, fonts are consistent across:
    - Website (landing, dashboard, settings)
    - Extension (popup, overlays)
  - Estimated: 1 hour

---

### 4. **Production Deployment** (~2-3 hours)
**Priority: HIGH** - Required for launch

- [ ] **Backend Deployment**
  - Deploy to Railway or Render
  - Set production environment variables
  - Test all endpoints in production
  - Estimated: 1 hour

- [ ] **Frontend Deployment**
  - Ensure Vercel deployment is working
  - Set production environment variables
  - Test signup/login flow in production
  - Estimated: 1 hour

- [ ] **Extension Production Config**
  - Update `SERVER_URL` in extension to production backend
  - Test extension with production backend
  - Prepare for Chrome Web Store submission
  - Estimated: 30 minutes

---

### 5. **Chrome Web Store Submission** (~1-2 hours)
**Priority: HIGH** - Required for distribution

- [ ] **Prepare Extension Package**
  - Create production build
  - Test in Chrome (not just local)
  - Verify all features work
  - Estimated: 30 minutes

- [ ] **Store Listing**
  - Write description
  - Create screenshots
  - Set up pricing (if applicable)
  - Submit for review
  - Estimated: 1 hour

---

### 6. **Optional: Post-MVP Features** (Can add after launch)
**Priority: LOW** - Future enhancements

- [ ] **Entertainment Limits** (Pro feature)
  - 1 entertainment session per month
  - Estimated: 2-3 hours

- [ ] **Subscription Analysis**
  - Analyze user's subscribed channels
  - Estimated: 2-3 hours

- [ ] **AI Journal Summary**
  - Generate summaries of journal entries
  - Estimated: 1-2 hours

---

## 📊 Summary

### **Must Do Before Launch:**
1. ✅ Fix goals format bug (DONE)
2. ⚠️ Verify session persistence bug (re-test, may already be fixed)
3. Production deployment (2-3 hours)
4. Chrome Web Store submission (1-2 hours)
**Total: ~4-6 hours** (reduced from 5-7)

### **Should Do Before Launch:**
1. Copy & layout polish (3-4 hours)
2. Nudge/UX polish (2-3 hours)
**Total: ~5-7 hours**

### **Can Do After Launch:**
- Post-MVP features
- Additional polish
- User feedback improvements

---

## 🎯 Recommended Order

1. **Run full test suite** (you're doing this now)
2. **Verify session persistence** (re-test 1.7 - code looks correct, may already be fixed)
3. **Copy & layout polish** (3-4 hours)
4. **Deploy to production** (2-3 hours)
5. **Submit to Chrome Web Store** (1-2 hours)
6. **Launch! 🚀**

**Total remaining: ~6-9 hours of focused work** (reduced from 8-11)

---

## 🚨 Critical Path to Launch

The absolute minimum to launch:
1. ✅ All tests pass (or known issues documented)
2. ✅ Fix goals format bug (DONE)
3. ⚠️ Verify session persistence (re-test - code looks correct)
4. Deploy backend + frontend to production
5. Submit extension to Chrome Web Store

**Everything else can be iterated on post-launch!**

