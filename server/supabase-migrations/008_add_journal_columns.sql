-- Migration: Add distraction_level and context_videos columns to journal_entries
-- Run this in Supabase SQL Editor

-- Add distraction_level column
ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS distraction_level TEXT;

-- Add context_videos column (JSONB array for spiral video lists)
ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS context_videos JSONB;

-- Add comment
COMMENT ON COLUMN journal_entries.distraction_level IS 'Distraction level: "distracting", "productive", "neutral", or "channel based"';
COMMENT ON COLUMN journal_entries.context_videos IS 'Array of videos watched (for spiral nudges): [{video_id, video_title, watched_at}]';

