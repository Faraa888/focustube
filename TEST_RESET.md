# Test Daily Reset (No Overnight Wait Needed)

## Quick Test Script

Run this in the **Console** tab of DevTools on any YouTube page:

```javascript
// Step 1: Set reset key to yesterday (simulates overnight)
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayKey = yesterday.toISOString().split('T')[0];

// Step 2: Set some fake watch time
chrome.storage.local.set({ 
  ft_last_reset_key: yesterdayKey,
  ft_watch_seconds_today: 100
}, () => {
  console.log("✅ Set reset key to yesterday:", yesterdayKey);
  console.log("✅ Set watch time to 100 seconds");
  console.log("⏳ Now navigate to a different YouTube page to trigger reset!");
  console.log("   (Or refresh the page)");
});
```

## What Should Happen

1. **After running the script:**
   - Check console for: `"✅ Set reset key to yesterday"`
   - Your time counter might show old time (that's expected)

2. **After navigating/refreshing:**
   - Check console for: `"[FT] Reset key mismatch - new day detected, starting from 0"`
   - OR: `"[FT] Daily reset detected, resetting global time tracker"`
   - Your time counter should reset to 0 or the correct value

3. **Watch a video for a few seconds:**
   - Time should start counting from 0 (not from 100)

## Alternative: Check Current Values

To see what's stored right now:

```javascript
chrome.storage.local.get(['ft_last_reset_key', 'ft_watch_seconds_today'], (result) => {
  console.log("Current reset key:", result.ft_last_reset_key);
  console.log("Current watch seconds:", result.ft_watch_seconds_today);
  console.log("Today's date:", new Date().toISOString().split('T')[0]);
});
```

## If It Doesn't Work

1. Make sure you're on a YouTube page (youtube.com)
2. Make sure the extension is loaded (check for `[FT]` logs in console)
3. Try refreshing the page after running the script
4. Check console for any error messages

