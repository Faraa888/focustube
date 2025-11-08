# Login Flow Test Verification Guide

This guide helps you verify that the complete login flow works end-to-end.

## Prerequisites Checklist

Before testing, ensure:

- [ ] **RLS Migration Applied**: Run `server/supabase-migrations/005_fix_rls_policies.sql` in Supabase SQL Editor
  - Or disable RLS: `ALTER TABLE users DISABLE ROW LEVEL SECURITY;`
- [ ] **Backend Deployed**: `https://focustube-backend-4xah.onrender.com` is running
- [ ] **Frontend Deployed**: `https://focustube-beta.vercel.app` is accessible
- [ ] **Extension Loaded**: Extension is installed and loaded in Chrome
- [ ] **Environment Variables**: All `.env` files are configured correctly

## Quick Verification Commands

### Check Backend `/license/verify` Endpoint

```bash
# Test with non-existent email (should return exists: false)
curl "https://focustube-backend-4xah.onrender.com/license/verify?email=test@nonexistent.com"

# Expected: {"exists":false,"plan":"free"}
```

### Check Extension Storage

1. Open Chrome DevTools (F12)
2. Go to Application tab → Storage → Local Storage → `chrome-extension://[your-extension-id]`
3. Or run in console: `chrome.storage.local.get(null, console.log)`

### Check Supabase Users Table

1. Go to Supabase Dashboard → Table Editor → `users`
2. Verify user rows exist with correct `plan`, `goals`, `anti_goals` columns

## Test Scenarios

### Test 1: New User Signup Flow ✅

**Steps:**
1. Clear extension storage:
   ```javascript
   // In extension popup console or DevTools
   chrome.storage.local.clear(() => console.log('Cleared'));
   ```
2. Go to: `https://focustube-beta.vercel.app/signup`
3. Fill in form:
   - Name: Test User
   - Email: `test1@example.com` (use unique email)
   - Password: `testpassword123`
4. Click "Start free trial"
5. **Check browser console** - should see: `"Email stored in chrome.storage for extension: test1@example.com"`
6. **Check Supabase** - `users` table should have new row with:
   - `email`: `test1@example.com`
   - `plan`: `trial`
   - `trial_started_at`: current timestamp
   - `trial_expires_at`: 14 days from now
7. **Click extension icon** - should show:
   - Status screen (not onboarding)
   - Email: `test1@example.com`
   - Plan: `TRIAL`

**Expected Results:**
- ✅ User row created in Supabase
- ✅ Email stored in chrome.storage
- ✅ Extension popup shows logged-in status
- ✅ Plan synced from backend

**If it fails:**
- Check Supabase RLS policies (run migration)
- Check browser console for errors
- Check Supabase logs for insert errors
- Verify backend is running

---

### Test 2: Google OAuth Signup Flow ✅

**Steps:**
1. Clear extension storage (same as Test 1)
2. Go to: `https://focustube-beta.vercel.app/signup`
3. Click "Continue with Google"
4. Complete Google OAuth
5. Should redirect to `/goals` page
6. Fill in goals and anti-goals
7. Click "Continue to Download"
8. **Check Supabase** - `users` table should have user row
9. **Click extension icon** - should auto-detect email

**Expected Results:**
- ✅ OAuth creates user in Supabase Auth
- ✅ User row created in `users` table (via Goals page)
- ✅ Extension detects email automatically

**If it fails:**
- Check OAuth redirect URL in Supabase settings
- Verify Goals page saves to Supabase
- Check RLS policies allow inserts

---

### Test 3: Existing User Login Flow ✅

**Steps:**
1. Clear extension storage (simulate logged out)
2. Click extension icon - should show onboarding screen
3. Click "Sign in" button
4. Should open: `https://focustube-beta.vercel.app/login?return=extension`
5. Log in with existing account (from Test 1)
6. **Check browser console** - should see email stored
7. **Extension popup should auto-update** (or reopen to see status)

**Expected Results:**
- ✅ Frontend login works
- ✅ Email stored in chrome.storage
- ✅ Extension detects email and shows logged-in status

**If it fails:**
- Check `storeEmailForExtension` is called after login
- Verify extension listens for storage changes
- Check backend `/license/verify` returns `exists: true`

---

### Test 4: Extension "Sign in" Button ✅

**Steps:**
1. Clear extension storage
2. Click extension icon
3. Click "Sign in" button
4. Should open frontend login page with `?return=extension`
5. Log in
6. Tab should close after 2 seconds (or show success message)
7. **Reopen extension popup** - should show logged-in status

**Expected Results:**
- ✅ "Sign in" opens correct URL
- ✅ Login works
- ✅ Extension detects email after login
- ✅ Tab closes automatically (if opened by extension)

**If it fails:**
- Check `FRONTEND_URL` in `popup.js`
- Verify `return=extension` parameter is handled
- Check `window.close()` works (may not work if tab wasn't opened by extension)

---

### Test 5: Backend Verification ✅

**Steps:**
1. Sign up a new user (Test 1)
2. **Check backend logs** (Render dashboard) for `/license/verify` call
3. **Verify response** should be: `{ exists: true, plan: "trial" }`
4. **Test with non-existent email**:
   ```bash
   curl "https://focustube-backend-4xah.onrender.com/license/verify?email=nonexistent@test.com"
   ```
5. Should return: `{ exists: false, plan: "free" }`

**Expected Results:**
- ✅ Backend returns `exists: true` for real users
- ✅ Backend returns `exists: false` for non-existent users
- ✅ Extension doesn't save email if `exists: false`

**If it fails:**
- Check backend logs for errors
- Verify `getUserPlanInfo` function works
- Check Supabase connection in backend

---

### Test 6: Data Storage Per User ✅

**Steps:**
1. Sign up User A: `userA@test.com` (Test 1)
2. Sign up User B: `userB@test.com` (Test 1 with different email)
3. **Check Supabase** `users` table - should see 2 separate rows
4. **User A logs in extension** - should only see their data
5. **User B logs in extension** - should only see their data
6. **Test RLS** (if enabled): Try to query other user's data - should fail

**Expected Results:**
- ✅ Each user has separate row in database
- ✅ Extension only shows data for logged-in user
- ✅ RLS prevents users from accessing each other's data (if enabled)

**If it fails:**
- Check RLS policies are correct
- Verify email is used as unique identifier
- Check extension filters data by email

---

### Test 7: Plan Sync ✅

**Steps:**
1. User signs up → Gets trial plan (Test 1)
2. Extension syncs → Shows "TRIAL"
3. **Manually change plan in Supabase**:
   ```sql
   UPDATE users SET plan = 'pro' WHERE email = 'test1@example.com';
   ```
4. **Clear extension cache** (or wait 6 hours):
   ```javascript
   chrome.storage.local.remove(['ft_plan'], () => {
     // Reopen extension popup to trigger sync
   });
   ```
5. **Extension syncs again** → Should show "PRO"

**Expected Results:**
- ✅ Plan syncs from backend
- ✅ Extension updates when plan changes
- ✅ Features update based on plan

**If it fails:**
- Check backend cache TTL (24 hours)
- Verify `syncPlanFromServer` function
- Check extension calls `/license/verify` correctly

---

## Debug Checklist

If any test fails, check:

- [ ] **Supabase RLS Policies**: Run migration `005_fix_rls_policies.sql` or disable RLS
- [ ] **Browser Console**: Check for JavaScript errors
- [ ] **Supabase Logs**: Check for insert/update errors
- [ ] **Backend Logs**: Check Render dashboard for API errors
- [ ] **Extension Storage**: Run `chrome.storage.local.get(null, console.log)` in console
- [ ] **Extension Popup Console**: Right-click popup → Inspect → Check console
- [ ] **Frontend Network Tab**: Check API calls to Supabase and backend
- [ ] **Environment Variables**: Verify all `.env` files are correct

## Common Issues & Fixes

### Issue: "Email not found in database"
**Fix**: User needs to sign up first on frontend, not just enter email in extension

### Issue: "Failed to fetch" error
**Fix**: Check backend is running and CORS is configured correctly

### Issue: Extension doesn't detect email after login
**Fix**: 
- Check `storeEmailForExtension` is called after login
- Verify extension listens for `chrome.storage.onChanged`
- Check extension popup is reopened after login

### Issue: RLS blocking inserts
**Fix**: Run migration `005_fix_rls_policies.sql` or disable RLS temporarily

### Issue: Plan doesn't sync
**Fix**: 
- Check backend `/license/verify` endpoint
- Verify email is correct in storage
- Clear cache and retry

## Success Criteria

All tests pass when:
- ✅ Users can sign up and data saves to Supabase
- ✅ Extension auto-detects logged-in users
- ✅ Backend verifies users exist correctly
- ✅ Each user's data is isolated (stored per user)
- ✅ Plan syncs correctly between frontend/backend/extension
- ✅ Login flow works for both email/password and Google OAuth

---

## Next Steps After Testing

Once all tests pass:
1. ✅ Login flow is working
2. ✅ Data is stored per user
3. ✅ Extension syncs correctly
4. → Move to Phase 2: Data Storage & Schema verification
5. → Move to Phase 3: API calls & classifier

