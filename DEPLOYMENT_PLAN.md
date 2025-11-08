# Deployment Plan - FocusTube

## Architecture Overview

### **Frontend (Website)**
- **Build:** Lovable (visual editor)
- **Host:** Vercel (automatic deployment)
- **URL:** `https://your-app.vercel.app`

### **Backend (API Server)**
- **Host:** Railway or Render (auto-deploys from Git)
- **URL:** `https://your-backend.railway.app` or `https://your-backend.onrender.com`

### **Extension (Chrome Add-on)**
- **Host:** Chrome Web Store
- **Calls:** Backend API (Railway/Render)

---

## Backend Deployment Options

### Recommended: Railway or Render

1. **Railway** (Recommended)
   - Free tier available
   - Auto-deploys from Git
   - Simple setup
   - URL: `https://your-app.railway.app`

2. **Render** (Good alternative)
   - Free tier available
   - Auto-deploys from Git
   - URL: `https://your-app.onrender.com`

**Note:** Backend is separate from frontend. Frontend goes to Vercel, backend goes to Railway/Render.

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

### Backend Deployment (Railway/Render)

1. **Push backend code to Git**
   ```bash
   cd /Users/faraazanjum/Desktop/FocusTube/server
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Connect Railway/Render to Git repo**
   - Go to railway.app or render.com
   - Click "New Project" → "Deploy from Git"
   - Connect your GitHub repo
   - Select the `/server` directory

3. **Set environment variables in Railway/Render**
   - Add all variables from `server/.env.example`
   - See list below

4. **Deploy**
   - Railway/Render auto-deploys
   - Get production URL: `https://your-backend.railway.app`

5. **Update extension with production URL**
   - Update `extension/lib/config.js` with backend URL
   - Or set via `chrome.storage.local.set({ ft_server_url: 'https://...' })`

6. **Test end-to-end**
   - Test extension → backend connection
   - Test frontend → backend connection

### Frontend Deployment (Vercel)

1. **Build frontend in Lovable**
   - Create project in Lovable
   - Build pages
   - Lovable auto-syncs to Git

2. **Connect Vercel to Git**
   - Go to vercel.com
   - Import Git repository (from Lovable)
   - Vercel auto-detects framework

3. **Set environment variables in Vercel**
   - `VITE_BACKEND_URL` = your Railway/Render URL
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
   - `VITE_STRIPE_PUBLISHABLE_KEY` = your Stripe key

4. **Deploy**
   - Vercel auto-deploys on every Git push
   - Get URL: `https://your-app.vercel.app`

## Current Status

### Backend
- ✅ Server code ready for deployment
- ✅ CORS configured for extensions
- ⚠️ Need to deploy to Railway/Render
- ⚠️ Need to set environment variables

### Frontend
- ⚠️ Need to build in Lovable
- ⚠️ Need to connect Vercel to Git
- ⚠️ Need to set environment variables in Vercel

### Extension
- ✅ Extension code ready
- ⚠️ Hardcoded to `localhost:3000` (needs update)
- ⚠️ Need to set production backend URL after deployment

