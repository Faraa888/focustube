-- Migration: Create journal_entries table
-- Run this in Supabase SQL Editor

-- Create journal_entries table
CREATE TABLE IF NOT EXISTS journal_entries (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  note TEXT NOT NULL,
  context_url TEXT,
  context_title TEXT,
  context_channel TEXT,
  context_source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes (PostgreSQL requires indexes to be created separately)
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_created_at ON journal_entries(created_at);

-- Add comment to table
COMMENT ON TABLE journal_entries IS 'User journal entries captured from extension nudge popups';

