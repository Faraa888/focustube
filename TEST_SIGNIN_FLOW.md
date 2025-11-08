# Complete Sign-In Flow Test Guide

This guide helps you verify that the complete sign-in flow works end-to-end after implementing the logout button in the Header.

## Pre-Test Setup

### 1. Clear Extension Storage
- Open extension popup → Right-click → Inspect
- In console, run:
  ```javascript
  chrome.storage.local.clear(() => console.log('Cleared'));
  ```

### 2. Use Fresh Email for Signup Tests
- Use a unique email like: `test-{timestamp}@example.com`
- Or clear the user from Supabase if reusing an email

---

## Test 1: Dashboard Protection ✅

**Steps:**
1. Open `https://focustube-beta.vercel.app/app/dashboard` in a new incognito window
2. **Expected:** Redirects to `/login` immediately
3. **If it shows dashboard → FAIL**

**Result:** ✅ Dashboard requires authentication

---

## Test 2: New User Signup → Extension Detection ✅

**Steps:**
1. Go to: `https://focustube-beta.vercel.app/signup`
2. Fill form:
   - Name: Test User
   - Email: `test-signup-{timestamp}@example.com` (use unique email)
   - Password: `testpassword123`
3. Click "Start free trial"
4. Should redirect to `/goals`
5. Fill goals:
   - Goals: "Learn React, Study TypeScript"
   - Anti-goals: "Gaming videos, Viral content"
6. Click "Continue to Download"
7. **Check browser console (F12)** → Should see: `"Email stored in chrome.storage for extension: ..."`
8. Click extension icon (top right)
9. Open extension popup console (right-click popup → Inspect)
10. Check console logs:
    ```
    🔍 [POPUP] Checking for email in chrome.storage...
    ✅ [POPUP] Email found in storage, verifying with backend...
    ✅ [POPUP] User verified, showing status screen
    ```

**Expected Results:**
- ✅ Extension popup shows status screen (not onboarding)
- ✅ Email displayed correctly
- ✅ Plan shows "TRIAL" or "PRO"
- ✅ No errors in console

---

## Test 3: Existing User Login → Extension Sync ✅

**Steps:**
1. Clear extension storage (same as Pre-Test Setup)
2. Go to: `https://focustube-beta.vercel.app/login`
3. Enter email/password from Test 2
4. Click "Sign in"
5. Should redirect to `/app/dashboard`
6. **Check browser console** → Should see: `"Email stored in chrome.storage for extension: ..."`
7. Click extension icon
8. Check extension popup console for detection logs

**Expected Results:**
- ✅ Dashboard loads successfully
- ✅ Extension popup shows status screen
- ✅ Email and plan displayed correctly

---

## Test 4: "Continue with Free" Button ✅

**Steps:**
1. Clear extension storage
2. Click extension icon
3. Should show onboarding screen
4. Click "Continue with Free"
5. Popup should close immediately
6. Click extension icon again
7. Should still show onboarding (no email stored)

**Expected Results:**
- ✅ Popup closes on click
- ✅ No email stored in chrome.storage
- ✅ Extension works in free mode

---

## Test 5: Logout from Website (Header) ✅ NEW

**Steps:**
1. Make sure you're logged in (from Test 2 or 3)
2. Look at top navigation bar
3. **Should see:** "Dashboard", "Settings", and "Sign Out" buttons
4. Click "Sign Out" button in header
5. Should redirect to `/login`
6. Click extension icon
7. Should show onboarding screen (email cleared)

**Expected Results:**
- ✅ Logout button visible in header when logged in
- ✅ Clicking logout redirects to login
- ✅ Extension detects logout (shows onboarding)
- ✅ "Start Free Trial" button appears when logged out

---

## Test 6: Logout from Extension ✅

**Steps:**
1. Make sure you're logged in
2. Click extension icon
3. Should show status screen with email
4. Click "Disconnect" button
5. Should show onboarding screen
6. Check chrome.storage (in popup console):
   ```javascript
   chrome.storage.local.get(null, console.log);
   ```
7. Should show empty or no `ft_user_email`

**Expected Results:**
- ✅ Extension logout clears storage
- ✅ Shows onboarding after logout
- ✅ chrome.storage is cleared

---

## Test 7: Login Persistence ✅

**Steps:**
1. Sign in (Test 3)
2. Close browser completely
3. Reopen browser
4. Go to: `https://focustube-beta.vercel.app/app/dashboard`
5. Should still be logged in (no redirect to login)
6. Click extension icon
7. Should still show status screen

**Expected Results:**
- ✅ Login persists across browser sessions
- ✅ Dashboard accessible without re-login
- ✅ Extension remembers login state

---

## Test 8: Backend Verification ✅

**Steps:**
1. Use email from Test 2
2. In terminal, run:
   ```bash
   curl "https://focustube-backend-4xah.onrender.com/license/verify?email=YOUR_EMAIL_HERE"
   ```
3. **Expected response:**
   ```json
   {
     "exists": true,
     "plan": "trial",
     "days_left": 13,
     "trial_expires_at": "2024-..."
   }
   ```

**Expected Results:**
- ✅ Backend returns `exists: true`
- ✅ Plan matches Supabase
- ✅ Trial dates correct

---

## Test 9: Header Navigation Changes ✅ NEW

**Steps:**
1. **When NOT logged in:**
   - Header should show: Home, Pricing, Download, Login
   - "Start Free Trial" button visible
2. **When logged in:**
   - Header should show: Home, Pricing, Download, Dashboard, Settings
   - "Sign Out" button visible (with logout icon)
   - "Start Free Trial" button hidden
3. **Mobile menu:**
   - Same logic applies in mobile menu
   - "Sign Out" button in mobile menu works

**Expected Results:**
- ✅ Header shows correct links based on auth state
- ✅ Logout button only visible when authenticated
- ✅ Mobile menu matches desktop behavior

---

## Quick Test Checklist

After making changes, verify:

- [ ] Dashboard redirects to login when not authenticated
- [ ] Signup → Extension popup shows status (not onboarding)
- [ ] Login → Extension popup shows status
- [ ] "Continue with Free" closes popup
- [ ] Logout button visible in header when logged in
- [ ] Logout from header → Redirects to login
- [ ] Logout from extension → Shows onboarding
- [ ] Login persists after browser restart
- [ ] Header navigation changes based on auth state
- [ ] Mobile menu shows correct options

---

## If Tests Fail

1. **Check browser console (F12)** for errors
2. **Check extension popup console** (right-click popup → Inspect)
3. **Verify Supabase RLS policies** (run migration `005_fix_rls_policies.sql`)
4. **Check backend is running:**
   ```bash
   curl https://focustube-backend-4xah.onrender.com/health
   ```
5. **Verify environment variables** in Vercel
6. **Check Supabase Auth settings** - email confirmation should be disabled for MVP

---

## Success Criteria

All tests should pass:
- ✅ Authentication flow works end-to-end
- ✅ Extension syncs with website login
- ✅ Logout works from both website and extension
- ✅ Login state persists correctly
- ✅ Dashboard is protected
- ✅ Header shows correct navigation based on auth state

