# Server Deployment Plan

## Where Will the Server Be in Production?

### Recommended Options

1. **Railway** (Easiest)
   - Free tier available
   - Auto-deploys from Git
   - Simple setup
   - URL: `https://your-app.railway.app`

2. **Render** (Good alternative)
   - Free tier available
   - Auto-deploys from Git
   - URL: `https://your-app.onrender.com`

3. **Lovable Cloud** (If using Lovable)
   - Integrated with Lovable platform
   - URL: `https://your-app.lovable.app`

4. **Fly.io** (More control)
   - Good for production
   - URL: `https://your-app.fly.dev`

## What Needs to Change

### 1. Update Extension to Use Production URL

**File:** `extension/lib/config.js`

Change from:
```javascript
return 'http://localhost:3000';
```

To:
```javascript
// Check chrome.storage for production URL
const storage = await chrome.storage.local.get(['ft_server_url']);
if (storage.ft_server_url) {
  return storage.ft_server_url;
}
// Fallback to production URL
return 'https://your-app.railway.app';
```

### 2. Set Environment Variables on Hosting Platform

Add to Railway/Render/etc:
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_MONTHLY`
- `STRIPE_PRICE_ANNUAL`
- `STRIPE_PRICE_LIFETIME`

### 3. Update Stripe Webhook URL

In Stripe Dashboard:
- Change webhook URL from `localhost:3000/webhook/stripe`
- To: `https://your-app.railway.app/webhook/stripe`

### 4. Update CORS Settings

Server already allows Chrome extensions, but verify:
- CORS should allow `chrome-extension://` origins
- Already configured in `server/src/index.ts`

## Deployment Steps

1. **Push code to Git**
2. **Connect Railway/Render to your repo**
3. **Set environment variables**
4. **Deploy**
5. **Update extension with production URL**
6. **Test end-to-end**

## Current Status

- ✅ Server code ready for deployment
- ✅ CORS configured for extensions
- ⚠️ Extension hardcoded to `localhost:3000` (needs update)
- ⚠️ Need to set production URL in extension config

