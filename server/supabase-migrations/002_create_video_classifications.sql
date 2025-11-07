-- Migration: Create video_classifications table
-- Run this in Supabase SQL Editor

-- Create video_classifications table
CREATE TABLE IF NOT EXISTS video_classifications (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  video_title TEXT,
  channel_name TEXT,
  video_category TEXT,
  distraction_level TEXT,
  category_primary TEXT,
  confidence_distraction NUMERIC(3, 2),
  watch_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, video_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_video_classifications_user_id ON video_classifications(user_id);
CREATE INDEX IF NOT EXISTS idx_video_classifications_video_id ON video_classifications(video_id);
CREATE INDEX IF NOT EXISTS idx_video_classifications_distraction_level ON video_classifications(distraction_level);
CREATE INDEX IF NOT EXISTS idx_video_classifications_created_at ON video_classifications(created_at);

-- Add comment
COMMENT ON TABLE video_classifications IS 'AI classification results for YouTube videos per user';

