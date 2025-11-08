# Frontend Integration Plan - Lovable + Vercel + FocusTube

## Architecture Overview

### **Frontend (Website)**
- **Build:** Lovable (visual drag-and-drop editor)
- **Host:** Vercel (automatic deployment from Git)
- **Flow:** Lovable → Git → Vercel → Live Site

### **Backend (API Server)**
- **Host:** Railway or Render (auto-deploys from Git)
- **Flow:** Git → Railway/Render → Live API

### **Extension (Chrome Add-on)**
- **Host:** Chrome Web Store
- **Calls:** Backend API (Railway/Render)

## Current State

### ✅ What We Have
- **Extension** - Fully working (Chrome MV3)
- **Backend Server** - Express + TypeScript + Supabase + OpenAI
- **Database** - All migrations ready
- **Git Repo** - Code pushed and ready

### ⚠️ What's Missing
- **Frontend Website** - Needs to be built in Lovable, deployed to Vercel
- **Integration** - Frontend ↔ Backend ↔ Extension

---

## Step 1: Build Frontend in Lovable

### Workflow: Lovable → Git → Vercel

1. **Build in Lovable** (visual editor)
   - Create project in Lovable
   - Build pages with drag-and-drop
   - Add API calls and logic in code editor
   - Lovable auto-syncs to Git

2. **Get Git URL from Lovable**
   - In Lovable: Settings → Git
   - Copy the Git repository URL

3. **Connect Vercel to Git**
   - Go to vercel.com
   - Import Git repository (from Lovable)
   - Vercel auto-deploys on every Git push

4. **Optional: Pull Locally for Customization**
   ```bash
   cd /Users/faraazanjum/Desktop
   git clone <lovable-git-url> FocusTube-Frontend
   cd FocusTube-Frontend
   # Customize in Cursor if needed
   git push  # Vercel auto-deploys
   ```

---

## Step 2: Understand What Needs to Be Built

Based on `MVP_SPECS.md`, the frontend needs:

### **1. Landing Page** (`/`)
- Marketing copy
- "Start 14-Day Free Trial" button
- "Buy Pro" button
- Feature comparison (Free vs Pro)
- Screenshots/demo

### **2. Signup/Auth** (`/signup`)
- Google OAuth (preferred - same as YouTube)
- Email/password fallback
- Collect user goals during signup
- Store in Supabase `users` table
- Set `plan = 'trial'`, `trial_start = now()`
- Redirect to `/download` after signup

### **3. Download Page** (`/download`)
- "Install Chrome Extension" button
- Link to Chrome Web Store (when published)
- Or direct download instructions
- Shows onboarding steps

### **4. Dashboard** (`/dashboard`) - Pro Only
- **Top Section:**
  - Focus Score (% aligned today)
  - Total Watch Time
  - Streak Days Focused
  - Time Saved vs Yesterday
  
- **Mid Section:**
  - Watch Time chart (7-day line)
  - Alignment breakdown (pie/bar)
  - Peak Distraction Hours (heatmap)
  
- **Bottom Section:**
  - Top Viewed Channels
  - Top Distraction Themes
  - Content Split (learning/entertainment)

### **5. Settings** (`/settings`)
- Update goals
- Update anti-goals
- Change plan (upgrade/downgrade)
- Stripe checkout integration
- Export data

---

## Step 3: Backend API Endpoints (Already Built)

Your backend already has these endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Server health check |
| `/license/verify?email=` | GET | Get user plan |
| `/ai/classify` | POST | Classify video content |
| `/events/watch` | POST | Log watch sessions |
| `/journal` | POST | Save journal entries |
| `/stripe/create-checkout` | POST | Create Stripe checkout session |
| `/webhook/stripe` | POST | Handle Stripe webhooks |

**You'll need to add:**
- `POST /auth/signup` - Create user account
- `POST /auth/login` - Authenticate user
- `GET /dashboard/stats` - Get dashboard data
- `GET /user/goals` - Get user goals
- `POST /user/goals` - Update user goals

---

## Step 4: Integration Points

### **Frontend → Backend**
```javascript
// Example: Signup
const response = await fetch('https://your-server.com/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: userEmail,
    goals: userGoals,
    plan: 'trial'
  })
});
```

### **Frontend → Supabase**
```javascript
// Direct Supabase calls for auth
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: userEmail,
  password: userPassword
});
```

### **Extension → Backend**
Already working! Extension calls:
- `/license/verify` - Get plan
- `/ai/classify` - Classify videos
- `/events/watch` - Log sessions
- `/journal` - Save notes

---

## Step 5: Environment Variables

### Frontend Environment Variables (Set in Vercel)

In Vercel project settings → Environment Variables:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_BACKEND_URL=https://your-backend.railway.app
VITE_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
```

**Note:** Replace `your-backend.railway.app` with your actual backend URL (Railway or Render)

### Backend (.env) - Already set up
```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
STRIPE_SECRET_KEY=...
```

---

## Step 6: Authentication Flow

### Current (Email-based)
- Extension uses `ft_user_email` from storage
- Backend verifies by email

### Future (Session-based)
- User logs in on website
- Website stores session token
- Extension gets token from website
- Backend verifies token

**For now:** Keep email-based, but design for future migration.

---

## Step 7: Deployment Order

1. **Deploy Backend** (Railway or Render)
   - Push backend code to Git
   - Connect Railway/Render to Git repo
   - Set environment variables in Railway/Render
   - Get production URL: `https://your-backend.railway.app`
   
2. **Deploy Frontend** (Vercel)
   - Build frontend in Lovable (auto-syncs to Git)
   - Go to vercel.com → Import Git repo (from Lovable)
   - Set environment variables in Vercel:
     - `VITE_BACKEND_URL` = your Railway/Render URL
     - `VITE_SUPABASE_URL` = your Supabase URL
     - etc.
   - Vercel auto-deploys → Get URL: `https://your-app.vercel.app`
   
3. **Update Extension**
   - Change `SERVER_URL` to production backend URL
   - Test locally
   
4. **Publish Extension**
   - Chrome Web Store
   - Update download page with store link

---

## Quick Start Checklist

### Frontend (Lovable + Vercel)
- [ ] Create project in Lovable
- [ ] Build landing page in Lovable
- [ ] Build signup/auth flow in Lovable
- [ ] Add API calls to backend (in Lovable code editor)
- [ ] Connect to Supabase (in Lovable code editor)
- [ ] Build dashboard (Pro only) in Lovable
- [ ] Add Stripe checkout in Lovable
- [ ] Connect Lovable to Git (Settings → Git)
- [ ] Connect Vercel to Git repo
- [ ] Set environment variables in Vercel
- [ ] Test frontend deployment

### Backend (Railway/Render)
- [ ] Deploy backend to Railway or Render
- [ ] Set environment variables in Railway/Render
- [ ] Get production backend URL
- [ ] Test backend endpoints

### Extension
- [ ] Update extension `SERVER_URL` to production backend
- [ ] Test extension with production backend
- [ ] Publish to Chrome Web Store

---

## Architecture Summary

```
┌─────────────────┐
│   Lovable       │  Build frontend (visual editor)
│   (Build)       │  → Auto-syncs to Git
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Git           │  Stores all code
│   (Storage)     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌──────────┐
│ Vercel  │ │ Railway/ │
│(Frontend│ │ Render   │
│  Host)  │ │(Backend  │
│         │ │  Host)   │
└─────────┘ └──────────┘
    │            │
    └─────┬──────┘
          │
          ▼
    ┌──────────┐
    │Extension │  Calls backend API
    │(Chrome)  │
    └──────────┘
```

## Next Steps (Right Now)

1. **Create frontend in Lovable** (if not started)
2. **Get Git URL from Lovable** (Settings → Git)
3. **Connect Vercel to Git repo** (vercel.com → Import)
4. **Set environment variables in Vercel**
5. **Deploy backend to Railway/Render** (separate step)

Let me know when you have the Lovable Git URL and we'll set up Vercel! 🚀

