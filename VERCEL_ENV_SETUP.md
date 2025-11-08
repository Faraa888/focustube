# Set Environment Variables in Vercel

## The Problem
Supabase environment variables are missing in Vercel, so signup/login doesn't work.

## Quick Fix (2 minutes)

1. **Go to Vercel Dashboard**
   - https://vercel.com/dashboard
   - Select your project: `focustube-beta` (or whatever it's named)

2. **Go to Settings → Environment Variables**

3. **Add these 4 variables:**

   ```
   VITE_SUPABASE_URL=https://asskfpjajdqnoiwfzedk.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzc2tmcGphamRxbm9pd2Z6ZWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNTk0OTMsImV4cCI6MjA3NzgzNTQ5M30._XaE6-wWnbRReUMphcztoF5C6U2jjHnqix4GvN1SXPk
   VITE_BACKEND_URL=https://focustube-backend-4xah.onrender.com
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_51SQ8CRCQluxzJkzZVDoCFBEYqTqYvyfa0nuOW7tD8lfj35U89tFkwkYv12BKhnni1ikHdQYY7JUgBhOqaiOOEqSR00V427Q5xS
   ```

4. **Set Environment to:** `Production`, `Preview`, and `Development` (select all)

5. **Click "Save"**

6. **Redeploy:**
   - Go to "Deployments" tab
   - Click the 3 dots on the latest deployment
   - Click "Redeploy"

## After Redeploy

1. Wait 2-3 minutes for Vercel to rebuild
2. Hard refresh the page (Cmd+Shift+R)
3. Check console - should see: `✅ [Supabase] Client initialized successfully`
4. Try signup again - should work!

## Verify It's Working

After redeploy, check browser console:
- Should see: `🔍 [Supabase] Environment check: { hasUrl: true, hasKey: true, ... }`
- Should see: `✅ [Supabase] Client initialized successfully`
- Should NOT see: `⚠️ [Supabase] Using placeholder client`

---

**Note:** These are the values from your `.env` file. Make sure they're correct in Vercel.

