-- Migration: Create video_sessions table
-- Run this in Supabase SQL Editor

-- Create video_sessions table
CREATE TABLE IF NOT EXISTS video_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT,
  channel TEXT,
  category TEXT,
  duration INTEGER,
  alignment TEXT,
  date DATE NOT NULL,
  watch_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_video_sessions_user_id ON video_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_date ON video_sessions(date);
CREATE INDEX IF NOT EXISTS idx_video_sessions_user_date ON video_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_video_sessions_video_id ON video_sessions(video_id);

-- Add comment
COMMENT ON TABLE video_sessions IS 'Batched watch session events for analytics and dashboard';

