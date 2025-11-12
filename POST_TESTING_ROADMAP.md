# 🚀 Post-Testing Roadmap

**Last Updated:** After button fix + before full test run

---

## ✅ Just Completed

- [x] **Dashboard Link Fix** - Global limit overlay button now opens dashboard in new tab
- [x] **Block Channel Button Fix** - Button now updates correctly on navigation

---

## 🎯 Phase 1: Complete Testing (90 mins)

### Current Status
- [ ] Run full test suite from `TEST_MVP_FULL_RUN.md`
- [ ] Document all test results
- [ ] Identify critical vs. minor bugs
- [ ] Create bug fix priority list

### Expected Outcomes
- All critical tests passing
- Known issues documented
- Clear path forward

---

## 🔧 Phase 2: Critical Bug Fixes (1-3 hours)

### High Priority Bugs (Fix Before Launch)

#### Test 1.7 - Session Persistence ⚠️ **NEEDS VERIFICATION**
- **Issue:** Dashboard requires re-login after browser restart
- **Code Status:** Implementation looks correct (persistSession: true)
- **Action:** Re-test to verify if still failing
- **Estimate:** 30 mins (if still failing)

#### Any Critical Bugs Found in Testing
- [ ] Document each bug
- [ ] Fix in priority order
- [ ] Re-test after fixes

**Estimate:** 1-3 hours (depends on findings)

---

## 📝 Phase 3: Copy & Layout Polish (3-4 hours)

### Frontend Copy Review (1-2 hours)
- [ ] **Landing Page**
  - Review all text for clarity
  - Check for typos
  - Ensure consistent tone
- [ ] **Signup/Login Pages**
  - Review form labels
  - Check error messages
  - Verify success messages
- [ ] **Dashboard**
  - Review all stats labels
  - Check empty states
  - Verify tooltips/help text
- [ ] **Settings Page**
  - Review all section headers
  - Check form labels
  - Verify save/delete messages

### Extension UI Updates (1 hour)
- [ ] **Popup Text**
  - Review all messages
  - Check button labels
  - Verify status messages
- [ ] **Overlays**
  - Review all overlay messages
  - Check button text consistency
  - Verify error messages
- [ ] **Console Logs** (optional)
  - Consider reducing verbose logging in production

### Layout Consistency (1 hour)
- [ ] **Website**
  - Verify spacing consistency
  - Check color scheme matches
  - Ensure font sizes are consistent
- [ ] **Extension**
  - Verify overlay styling matches website
  - Check popup styling
  - Ensure button styles match

**Total Estimate:** 3-4 hours

---

## 🎨 Phase 4: Nudges & UX Polish (2-3 hours)

### Trial Milestone Messages (1 hour)
- [ ] Show special messages at trial milestones:
  - "7 days left in your trial"
  - "3 days left in your trial"
  - "Last day of your trial"
  - "Trial ending today - upgrade to continue"
- [ ] Where to show:
  - Dashboard banner
  - Extension popup
  - Overlay messages

### Usage Alerts Verification (30 mins)
- [ ] Verify 30-min usage alerts are working
- [ ] Check alert timing is correct
- [ ] Verify alert messages match nudge style
- [ ] Test alert dismissal

### Journal Nudge Polish (30 mins)
- [ ] Verify triggers after 1 min of distracting content
- [ ] Check saves to backend correctly
- [ ] Verify shows correct nudge style message
- [ ] Test journal entry flow

**Total Estimate:** 2-3 hours

---

## 🚀 Phase 5: Production Deployment (2-3 hours)

### Backend Deployment (1 hour)
- [ ] **Deploy to Railway/Render**
  - Set up production environment
  - Configure environment variables:
    - `SUPABASE_URL`
    - `SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY`
    - `OPENAI_API_KEY`
    - `STRIPE_SECRET_KEY`
    - `STRIPE_WEBHOOK_SECRET`
  - Test all endpoints in production
  - Verify health check endpoint
  - Test Stripe webhook URL

### Frontend Deployment (1 hour)
- [ ] **Verify Vercel Deployment**
  - Ensure latest code is deployed
  - Set production environment variables:
    - `VITE_SUPABASE_URL`
    - `VITE_SUPABASE_ANON_KEY`
  - Test signup/login flow in production
  - Verify dashboard loads correctly
  - Test settings save/load

### Extension Production Config (30 mins)
- [ ] **Update SERVER_URL**
  - Change from localhost to production backend URL
  - Update in `extension/background/background.js` or config file
  - Test extension with production backend
  - Verify all API calls work
  - Test Stripe checkout flow

**Total Estimate:** 2-3 hours

---

## 📦 Phase 6: Chrome Web Store Submission (1-2 hours)

### Prepare Extension Package (30 mins)
- [ ] **Create Production Build**
  - Remove dev-only code
  - Minimize/optimize code
  - Test in Chrome (not just local)
  - Verify all features work
  - Test on clean Chrome profile

### Store Listing (1 hour)
- [ ] **Write Description**
  - Short description (132 chars)
  - Detailed description
  - Feature list
  - Use cases
- [ ] **Create Screenshots**
  - Extension popup screenshot
  - Overlay examples
  - Dashboard screenshot
  - Settings page screenshot
- [ ] **Set Up Pricing** (if applicable)
  - Configure subscription pricing
  - Set up payment flow
- [ ] **Submit for Review**
  - Fill out all required fields
  - Upload screenshots
  - Submit for review

**Total Estimate:** 1-2 hours

---

## ✅ Phase 7: Final Checks (1 hour)

### Pre-Launch Verification
- [ ] **End-to-End Test**
  - Sign up new user
  - Install extension
  - Test all features
  - Verify Stripe checkout
  - Test Pro features
- [ ] **Cross-Browser Test** (if applicable)
  - Test in Chrome
  - Test in Edge (if supporting)
- [ ] **Performance Check**
  - Check API response times
  - Verify no console errors
  - Check extension load time
- [ ] **Security Check**
  - Verify API keys are not exposed
  - Check CORS settings
  - Verify authentication flow

**Total Estimate:** 1 hour

---

## 📊 Time Estimates Summary

### Must Do Before Launch:
1. Complete testing: **90 mins**
2. Critical bug fixes: **1-3 hours** (depends on findings)
3. Production deployment: **2-3 hours**
4. Chrome Web Store submission: **1-2 hours**
5. Final checks: **1 hour**

**Total Critical Path: ~6-9 hours**

### Should Do Before Launch:
1. Copy & layout polish: **3-4 hours**
2. Nudge/UX polish: **2-3 hours**

**Total Should-Do: ~5-7 hours**

### Grand Total: **~11-16 hours** of focused work

---

## 🎯 Recommended Execution Order

1. ✅ **Run Full Test Suite** (90 mins) ← **YOU ARE HERE**
2. **Fix Critical Bugs** (1-3 hours)
3. **Copy & Layout Polish** (3-4 hours)
4. **Nudge/UX Polish** (2-3 hours)
5. **Deploy to Production** (2-3 hours)
6. **Submit to Chrome Web Store** (1-2 hours)
7. **Final Checks** (1 hour)
8. **Launch! 🚀**

---

## 🚨 Critical Path (Minimum to Launch)

If time is tight, focus on:

1. ✅ All tests pass (or critical bugs documented)
2. ✅ Fix critical bugs only
3. ✅ Deploy backend + frontend to production
4. ✅ Submit extension to Chrome Web Store
5. ✅ Quick final check

**Everything else can be iterated post-launch!**

---

## 📋 Quick Checklist

### Before Testing:
- [x] Dashboard link fixed
- [x] Block channel button fixed

### After Testing:
- [ ] All tests documented
- [ ] Critical bugs identified
- [ ] Bug fix plan created

### Before Launch:
- [ ] All critical bugs fixed
- [ ] Production deployed
- [ ] Extension submitted to store
- [ ] Final checks complete

---

## 💡 Notes

- **Dashboard Sync:** Verify extension data syncs to dashboard in real time during testing
- **Copy Check:** Keep a running list of typos/clarity issues found during testing
- **Error Handling:** Note any confusing error messages during testing
- **Performance:** Watch for slow API calls or UI lag during testing

---

**Good luck with testing! 🎉**

