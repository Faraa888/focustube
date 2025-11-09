# Phase 2: Data Storage & Schema - Test Guide

**What we're testing:** Extension can save and load data from Supabase (blocked channels, watch history, etc.)

---

## 🚀 Quick Start (Do These First!)

1. **Test Backend** (Terminal) - 2 minutes
   - Run: `curl "https://focustube-backend-4xah.onrender.com/extension/get-data?email=YOUR_EMAIL"`
   - Should return: `{"ok": true, "data": {...}}`

2. **Test Extension Loads** (Extension Console) - 1 minute
   - Reload extension → Open popup → Check console
   - Should see: `"[FT] Extension data loaded from server"`

3. **Test Extension Saves** (Extension Console) - 2 minutes
   - Add channels: `chrome.storage.local.set({ft_blocked_channels: ["Eddie Hall"]})`
   - Save: `chrome.runtime.sendMessage({type: "FT_SAVE_EXTENSION_DATA"})`
   - Check Supabase table → Should see your channels

**If all 3 work → Phase 2 is complete! ✅**

---

## Pre-Test Checklist

Before starting, make sure:
- ✅ You're logged in (extension shows your email)
- ✅ Backend is running (or deployed)
- ✅ Migration 006 and 007 ran successfully in Supabase

---

## Test 1: Backend Endpoints Work (5 minutes)

### Step 1: Test GET endpoint (load data)

1. Open terminal
2. Run this command (replace YOUR_EMAIL with your actual email):
   ```bash
   curl "https://focustube-backend-4xah.onrender.com/extension/get-data?email=YOUR_EMAIL@example.com"
   ```

3. **What you should see:**
   ```json
   {
     "ok": true,
     "data": {
       "blocked_channels": [],
       "watch_history": [],
       "channel_spiral_count": {},
       "settings": {}
     }
   }
   ```

4. ✅ **If you see this → PASS!** Backend can read from Supabase
5. ❌ **If you see error → Check backend logs**

---

### Step 2: Test POST endpoint (save data)

1. In terminal, run this (replace YOUR_EMAIL):
   ```bash
   curl -X POST "https://focustube-backend-4xah.onrender.com/extension/save-data" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "YOUR_EMAIL@example.com",
       "data": {
         "blocked_channels": ["Test Channel 1", "Test Channel 2"],
         "watch_history": [],
         "channel_spiral_count": {},
         "settings": {}
       }
     }'
   ```

2. **What you should see:**
   ```json
   {
     "ok": true,
     "message": "Extension data saved successfully"
   }
   ```

3. ✅ **If you see this → PASS!** Backend can write to Supabase

4. **Now test GET again** (Step 1) - should show your test channels:
   ```bash
   curl "https://focustube-backend-4xah.onrender.com/extension/get-data?email=YOUR_EMAIL@example.com"
   ```

5. ✅ **Should show:** `"blocked_channels": ["Test Channel 1", "Test Channel 2"]`

---

## Test 2: Extension Auto-Loads Data (3 minutes)

### Step 1: Check extension loads data on startup

1. **Reload the extension:**
   - Go to `chrome://extensions`
   - Find FocusTube extension
   - Click the refresh/reload button 🔄

2. **Open extension popup:**
   - Click the extension icon
   - Right-click the popup → Click "Inspect"
   - This opens the popup console

3. **Look for this message in console:**
   ```
   [FT] Extension data loaded from server: {blockedChannels: 2, watchHistory: 0}
   ```

4. ✅ **If you see this → PASS!** Extension loaded data automatically

5. **Check storage:**
   - In the same console, type:
     ```javascript
     chrome.storage.local.get(['ft_blocked_channels'], console.log);
     ```
   - Should show: `{ft_blocked_channels: ["Test Channel 1", "Test Channel 2"]}`

---

## Test 3: Extension Can Save Data (5 minutes)

### Step 1: Add a blocked channel

1. **Open extension popup console:**
   - Click extension icon
   - Right-click popup → "Inspect"

2. **Add blocked channels to storage:**
   ```javascript
   chrome.storage.local.set({ 
     ft_blocked_channels: ["Eddie Hall", "Test Channel"] 
   });
   ```

3. **Save to server (easy way):**
   ```javascript
   chrome.runtime.sendMessage({ type: "FT_SAVE_EXTENSION_DATA" }, (response) => {
     console.log("Save result:", response);
   });
   ```

4. ✅ **Should see:** `Save result: {ok: true}`

5. **Verify in Supabase:**
   - Go to Supabase → Table Editor → `extension_data`
   - Find your email row
   - Check `blocked_channels` column
   - Should show: `["Eddie Hall", "Test Channel"]`

6. ✅ **PASS!** Extension can save data

---

## Test 4: Data Persists After Reload (3 minutes)

### Step 1: Clear extension storage

1. **In extension popup console:**
   ```javascript
   chrome.storage.local.remove(['ft_blocked_channels']);
   ```

2. **Check it's gone:**
   ```javascript
   chrome.storage.local.get(['ft_blocked_channels'], console.log);
   ```
   Should show: `{ft_blocked_channels: undefined}`

### Step 2: Reload extension

1. **Reload extension** (chrome://extensions → refresh button)

2. **Open popup again** → Check console

3. **Should see:** `[FT] Extension data loaded from server: {blockedChannels: 2, ...}`

4. **Or manually load data:**
   ```javascript
   chrome.runtime.sendMessage({ type: "FT_LOAD_EXTENSION_DATA" }, (response) => {
     console.log("Load result:", response);
   });
   ```

5. **Check storage:**
   ```javascript
   chrome.storage.local.get(['ft_blocked_channels'], console.log);
   ```

6. ✅ **Should show:** `{ft_blocked_channels: ["Eddie Hall", "Test Channel"]}`

7. ✅ **PASS!** Data persisted and reloaded from Supabase

---

## Test 5: RLS Policies Work (Security Test) (2 minutes)

### Step 1: Verify tables are restricted

1. **Go to Supabase → Table Editor**

2. **Check each table:**
   - `journal_entries` → Should show "Restricted" (not "Unrestricted")
   - `video_classifications` → Should show "Restricted"
   - `video_sessions` → Should show "Restricted"
   - `extension_data` → Should show "Restricted"

3. ✅ **If all show "Restricted" → PASS!** Tables are secure

### Step 2: Verify backend still works

1. **Run Test 1 again** (GET and POST endpoints)

2. ✅ **If they still work → PASS!** Backend can access (service_role bypasses RLS)

---

## Test 6: Watch History Sync (Optional - 5 minutes)

### Step 1: Simulate watch history

1. **In extension popup console:**
   ```javascript
   chrome.storage.local.set({
     ft_watch_history: [
       {
         channel: "Jeff Nippard",
         timestamp: Date.now(),
         category: "productive"
       },
       {
         channel: "Eddie Hall",
         timestamp: Date.now() - 3600000,
         category: "distracting"
       }
     ]
   });
   ```

2. **Save to server (easy way):**
   ```javascript
   chrome.runtime.sendMessage({ type: "FT_SAVE_EXTENSION_DATA" }, (response) => {
     console.log("Save result:", response);
   });
   ```

3. **Verify in Supabase:**
   - Go to `extension_data` table
   - Check `watch_history` column
   - Should show array with 2 entries

4. ✅ **PASS!** Watch history syncs

---

## Quick Test Summary

**All tests should pass:**
- ✅ Test 1: Backend GET/POST endpoints work
- ✅ Test 2: Extension auto-loads data on startup
- ✅ Test 3: Extension can save data to server
- ✅ Test 4: Data persists after reload
- ✅ Test 5: RLS policies are enabled (tables secure)
- ✅ Test 6: Watch history syncs (optional)

---

## If Tests Fail

### Backend errors:
- Check backend logs
- Verify Supabase credentials in backend `.env`
- Check backend is deployed/running

### Extension errors:
- Check extension console for errors
- Verify email is stored: `chrome.storage.local.get(['ft_user_email'])`
- Check network tab for failed requests

### Supabase errors:
- Verify migration 006 and 007 ran successfully
- Check RLS policies exist in Supabase dashboard
- Verify `extension_data` table exists

---

## Success! 🎉

If all tests pass, **Phase 2 is complete!**

**Next:** Phase 2.5 - Channel Blocking (will use this data storage)

---

*Last Updated: 2025-01-16*

