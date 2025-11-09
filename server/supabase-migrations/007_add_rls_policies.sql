-- Migration: Add RLS policies and verify schemas for analytics tables
-- Run this in Supabase SQL Editor
-- This secures journal_entries, video_classifications, and video_sessions tables

-- ============================================
-- 1. JOURNAL_ENTRIES TABLE
-- ============================================

-- Enable RLS
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage journal_entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can view own journal entries" ON journal_entries;

-- Policy: Allow service role (backend) to read/write all data
CREATE POLICY "Service role can manage journal_entries"
  ON journal_entries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Allow authenticated users to view their own entries (optional)
CREATE POLICY "Users can view own journal entries"
  ON journal_entries
  FOR SELECT
  TO authenticated
  USING (
    user_id = (auth.jwt() ->> 'email')
  );

-- Verify schema matches code expectations
-- Expected columns: id, user_id, note, context_url, context_title, context_channel, context_source, created_at
DO $$
BEGIN
  -- Check if context_channel exists (might be truncated in UI)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'journal_entries' AND column_name = 'context_channel'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN context_channel TEXT;
  END IF;
  
  -- Check if context_source exists (might be truncated in UI)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'journal_entries' AND column_name = 'context_source'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN context_source TEXT;
  END IF;
END $$;

-- ============================================
-- 2. VIDEO_CLASSIFICATIONS TABLE
-- ============================================

-- Enable RLS
ALTER TABLE video_classifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage video_classifications" ON video_classifications;
DROP POLICY IF EXISTS "Users can view own video_classifications" ON video_classifications;

-- Policy: Allow service role (backend) to read/write all data
CREATE POLICY "Service role can manage video_classifications"
  ON video_classifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Allow authenticated users to view their own classifications (optional)
CREATE POLICY "Users can view own video_classifications"
  ON video_classifications
  FOR SELECT
  TO authenticated
  USING (
    user_id = (auth.jwt() ->> 'email')
  );

-- Verify/fix schema - check for column name mismatches
DO $$
BEGIN
  -- Fix confidence_distraction if it's named confidence_display
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'video_classifications' AND column_name = 'confidence_display'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'video_classifications' AND column_name = 'confidence_distraction'
  ) THEN
    ALTER TABLE video_classifications RENAME COLUMN confidence_display TO confidence_distraction;
  END IF;
  
  -- Fix watch_seconds if it's named watch_second
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'video_classifications' AND column_name = 'watch_second'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'video_classifications' AND column_name = 'watch_seconds'
  ) THEN
    ALTER TABLE video_classifications RENAME COLUMN watch_second TO watch_seconds;
  END IF;
  
  -- Ensure all required columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'video_classifications' AND column_name = 'confidence_distraction'
  ) THEN
    ALTER TABLE video_classifications ADD COLUMN confidence_distraction NUMERIC(3, 2);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'video_classifications' AND column_name = 'watch_seconds'
  ) THEN
    ALTER TABLE video_classifications ADD COLUMN watch_seconds INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================
-- 3. VIDEO_SESSIONS TABLE
-- ============================================

-- Enable RLS
ALTER TABLE video_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage video_sessions" ON video_sessions;
DROP POLICY IF EXISTS "Users can view own video_sessions" ON video_sessions;

-- Policy: Allow service role (backend) to read/write all data
CREATE POLICY "Service role can manage video_sessions"
  ON video_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Allow authenticated users to view their own sessions (optional)
CREATE POLICY "Users can view own video_sessions"
  ON video_sessions
  FOR SELECT
  TO authenticated
  USING (
    user_id = (auth.jwt() ->> 'email')
  );

-- Verify/fix schema - check for column name mismatches
DO $$
BEGIN
  -- Fix watch_seconds if it's named watch_second
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'video_sessions' AND column_name = 'watch_second'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'video_sessions' AND column_name = 'watch_seconds'
  ) THEN
    ALTER TABLE video_sessions RENAME COLUMN watch_second TO watch_seconds;
  END IF;
  
  -- Ensure all required columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'video_sessions' AND column_name = 'watch_seconds'
  ) THEN
    ALTER TABLE video_sessions ADD COLUMN watch_seconds INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================

-- Log success
DO $$
BEGIN
  RAISE NOTICE 'RLS policies added and schemas verified for all analytics tables';
END $$;

