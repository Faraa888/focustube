-- Migration: Add model_used, classified_at, expires_at columns to video_classifications
-- Run this in Supabase SQL Editor

-- Add missing columns
ALTER TABLE video_classifications 
  ADD COLUMN IF NOT EXISTS model_used TEXT,
  ADD COLUMN IF NOT EXISTS classified_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Create index on expires_at for efficient cache lookups
CREATE INDEX IF NOT EXISTS idx_video_classifications_expires_at 
  ON video_classifications(expires_at);

-- Add comment
COMMENT ON COLUMN video_classifications.model_used IS 'AI model used for classification (gpt-4o-mini, claude-sonnet-3-5, etc.)';
COMMENT ON COLUMN video_classifications.classified_at IS 'Timestamp when classification was performed';
COMMENT ON COLUMN video_classifications.expires_at IS 'Cache expiration timestamp (24 hours from classification)';
