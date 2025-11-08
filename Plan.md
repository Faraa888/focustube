# FocusTube - 34-Hour Development Plan & Tracking

## 📊 Macro Plan Overview (34 Hours Total)

### Phase 1: User Flow & Authentication (Foundation) - ~5 hours
**Status:** ✅ Complete  
**Time Spent:** ~5 hours  
**Time Remaining:** 0 hours

**Objectives:**
- Frontend signup/login with Google OAuth + email/password
- Goals collection page
- Extension authentication flow
- Backend auth endpoints

**Key Deliverables:**
- ✅ Signup page with email verification message
- ✅ Goals page (collects goals/anti-goals)
- ✅ Extension login integration (popup with onboarding + email sync)
- ✅ Backend auth endpoints (updated /license/verify with exists flag)
- ✅ Frontend stores email in chrome.storage for extension
- ✅ Extension auto-detects email from chrome.storage
- ✅ Extension "Sign in" opens frontend login page
- ✅ YouTube overlay prompts clicking extension icon

---

### Phase 2: Data Storage & Schema (Infrastructure) - ~4 hours
**Status:** 🟢 Partially Complete  
**Time Spent:** ~1 hour  
**Time Remaining:** ~3 hours

**Objectives:**
- Verify database schema matches requirements
- Extension storage sync with Supabase
- Data flow verification

**Key Deliverables:**
- ✅ Database columns added (goals, anti_goals, trial_started_at)
- ⏳ Extension storage sync
- ⏳ Data flow testing

---

### Phase 2.5: Channel Blocking (Critical Feature) - ~4 hours
**Status:** ⚪ Not Started  
**Time Spent:** 0 hours  
**Time Remaining:** ~4 hours

**Objectives:**
- Hard block specific channels (e.g., Eddie Hall)
- Allow other channels (e.g., Jeff Nippard) 
- No soft blocking/nudging for blocked channels - just remove them
- Stop spirals on good channels

**Key Deliverables:**
- ⏳ Channel blocklist storage (chrome.storage + Supabase)
- ⏳ Channel detection from video metadata
- ⏳ Hard redirect for blocked channels (immediate, no overlay)
- ⏳ Settings UI to manage blocked channels
- ⏳ Integration with existing blocking logic in rules.js

**Priority:** HIGH - Most important feature per user requirements

---

### Phase 3: API Calls & Classifier (Core Functionality) - ~6 hours
**Status:** ⚪ Not Started  
**Time Spent:** 0 hours  
**Time Remaining:** ~6 hours

**Objectives:**
- AI classifier API integration
- Watch events & analytics
- Error handling & fallbacks

**Key Deliverables:**
- ⏳ Classifier API working
- ⏳ Watch events logging
- ⏳ Error handling

---

### Phase 4: Nudges & User Experience (UX) - ~5 hours
**Status:** ⚪ Not Started  
**Time Spent:** 0 hours  
**Time Remaining:** ~5 hours

**Objectives:**
- Journal nudge system
- Trial reminders
- Usage alerts

**Key Deliverables:**
- ⏳ Journal nudge popup
- ⏳ Trial milestone messages
- ⏳ Usage alerts

---

### Phase 5: Dashboard & Settings (User Value) - ~6 hours
**Status:** 🟡 Mock Created  
**Time Spent:** ~1 hour  
**Time Remaining:** ~5 hours

**Objectives:**
- Dashboard data endpoints
- Dashboard frontend (wire up)
- Settings page

**Key Deliverables:**
- ✅ Dashboard mock UI
- ⏳ Dashboard data endpoints
- ⏳ Dashboard wired up
- ⏳ Settings page

---

### Phase 6: Copy & Layout (Polish) - ~4 hours
**Status:** ⚪ Not Started  
**Time Spent:** 0 hours  
**Time Remaining:** ~4 hours

**Objectives:**
- Frontend copy refinement
- Extension UI polish
- Layout & design consistency

**Key Deliverables:**
- ⏳ Frontend copy review
- ⏳ Extension UI updates
- ⏳ Layout consistency

---

## 📋 Individual Detailed Plans

### Plan: Email Verification Message
**Status:** ✅ Complete  
**Phase:** Phase 1  
**Time:** ~30 minutes

**What was done:**
- Added success-style email verification message
- Replaced error message with green Alert component
- Added "Already verified? Sign in" button
- Form hidden when confirmation sent

**Files Modified:**
- `frontend/src/pages/Signup.tsx`

---

### Plan: Extension Authentication Popup
**Status:** ✅ Complete  
**Phase:** Phase 1  
**Time:** ~1 hour

**What was done:**
- Created extension popup (popup.html) for user login
- Added email verification against backend /license/verify endpoint
- Integrated with Chrome storage to save email and sync plan
- Added logout functionality
- Shows current connection status and plan
- Links to frontend signup page for new users

**Files Created:**
- `extension/popup.html`
- `extension/popup.js`

**Files Modified:**
- `extension/manifest.json` (added popup action)
- `extension/background/background.js` (added FT_SYNC_PLAN handler)

---

### Plan: Complete Login Flow Implementation
**Status:** ✅ Complete  
**Phase:** Phase 1  
**Time:** ~2 hours

**What was done:**
- Fixed Supabase RLS policies (added INSERT policy)
- Improved error handling for database inserts
- Created extensionStorage utility for frontend to store email in chrome.storage
- Updated Login.tsx to store email after login and handle extension redirects
- Updated Signup.tsx to store email after signup
- Updated Goals.tsx to store email on OAuth callback
- Updated extension popup to auto-detect email from chrome.storage
- Updated extension "Sign in" button to open frontend login page
- Updated backend /license/verify to return exists flag
- Replaced YouTube onboarding overlay to prompt clicking extension icon
- Added storage listener in extension to detect email changes

**Files Created:**
- `frontend/src/lib/extensionStorage.ts`
- `server/supabase-migrations/005_fix_rls_policies.sql`

**Files Modified:**
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Signup.tsx`
- `frontend/src/pages/Goals.tsx`
- `extension/popup.js`
- `extension/content/content.js`
- `server/src/index.ts`

---

### Plan: [Next Plan Name]
**Status:** ⏳ Pending  
**Phase:** [Phase Number]  
**Time:** [Estimated hours]

**Objectives:**
- [Objective 1]
- [Objective 2]

**Tasks:**
- [ ] Task 1
- [ ] Task 2

**Files to Modify:**
- `path/to/file1`
- `path/to/file2`

---

## 📈 Progress Summary

**Total Time Allocated:** 34 hours  
**Time Spent:** ~7 hours  
**Time Remaining:** ~27 hours  
**Completion:** ~21%

**By Phase:**
- Phase 1: 100% complete ✅
- Phase 2: 25% complete
- Phase 2.5: 0% complete (Channel Blocking - HIGH PRIORITY)
- Phase 3: 0% complete
- Phase 4: 0% complete
- Phase 5: 17% complete
- Phase 6: 0% complete

---

## 🎯 Next Steps

1. ✅ Complete Phase 1: Extension authentication integration (DONE)
2. ✅ Complete all sign-in flow tests (DONE)
3. **PRIORITY:** Phase 2.5: Implement hard channel blocking
4. Complete Phase 2: Extension storage sync & data flow verification
5. Begin Phase 3: API calls & classifier

---

*Last Updated: 2025-01-16*
