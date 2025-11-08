-- Migration: Add goals, anti_goals, and trial_started_at columns to users table
-- Run this in Supabase SQL Editor

-- Add goals column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'goals'
  ) THEN
    ALTER TABLE users ADD COLUMN goals TEXT;
  END IF;
END $$;

-- Add anti_goals column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'anti_goals'
  ) THEN
    ALTER TABLE users ADD COLUMN anti_goals TEXT;
  END IF;
END $$;

-- Add trial_started_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'trial_started_at'
  ) THEN
    ALTER TABLE users ADD COLUMN trial_started_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN users.goals IS 'User goals - what they want to achieve on YouTube';
COMMENT ON COLUMN users.anti_goals IS 'User anti-goals - what distracts them on YouTube';
COMMENT ON COLUMN users.trial_started_at IS 'When the user started their trial period';

