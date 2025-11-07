-- Migration: Create users table (if not exists)
-- Run this in Supabase SQL Editor
-- Note: If users table already exists, this will skip creation

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  trial_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);

-- Add trial_expires_at column if it doesn't exist (for existing tables)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'trial_expires_at'
  ) THEN
    ALTER TABLE users ADD COLUMN trial_expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add comment
COMMENT ON TABLE users IS 'FocusTube user accounts with plan and trial information';

