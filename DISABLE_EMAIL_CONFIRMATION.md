# How to Disable Email Confirmation in Supabase

## Steps:

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** → **Settings** (left sidebar)
4. Scroll down to **Email Auth** section
5. Find **"Enable email confirmations"** toggle
6. **Turn it OFF** (disable)
7. Click **Save**

## What This Does:

- Users can sign up and immediately log in (no email verification needed)
- Perfect for MVP/testing
- You can re-enable it later for production

## After Disabling:

- Signup will immediately create a session
- User will be redirected to `/goals` right away
- No "check your email" message"

---

**Note:** This is a Supabase dashboard setting, not code. Once you disable it, signup will work immediately.

