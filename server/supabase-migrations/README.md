# Supabase Database Migrations

Run these migrations in order in the Supabase SQL Editor.

## Migration Order

1. **000_create_users.sql** - Creates users table (if not exists) and adds trial_expires_at column
2. **001_create_journal_entries.sql** - Creates journal_entries table for journal nudge feature
3. **002_create_video_classifications.sql** - Creates video_classifications table for AI classification storage
4. **003_create_video_sessions.sql** - Creates video_sessions table for watch event analytics

## How to Run

1. Open Supabase Dashboard → SQL Editor
2. Run each migration file in order (000, 001, 002, 003)
3. Each migration uses `IF NOT EXISTS` so it's safe to run multiple times

## Tables Created

- **users** - User accounts with plan and trial info
- **journal_entries** - Journal notes from extension nudge popups
- **video_classifications** - AI classification results per video/user
- **video_sessions** - Batched watch session events for analytics

## Notes

- All tables use `TEXT` for user_id (email for now, can migrate to UUID later)
- Indexes are created separately (PostgreSQL requirement)
- All migrations are idempotent (safe to run multiple times)

