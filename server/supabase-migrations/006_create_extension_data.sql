-- Migration: Create extension_data table for storing extension-specific data
-- Run this in Supabase SQL Editor
-- This stores channel blocklists, watch history, and other extension data per user

-- Create extension_data table
CREATE TABLE IF NOT EXISTS extension_data (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL, -- References users.email
  blocked_channels JSONB DEFAULT '[]'::jsonb, -- Array of blocked channel names
  watch_history JSONB DEFAULT '[]'::jsonb, -- Array of watch events (last 7 days)
  channel_spiral_count JSONB DEFAULT '{}'::jsonb, -- Object: {channel: count}
  settings JSONB DEFAULT '{}'::jsonb, -- Other extension settings
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id) -- One row per user
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_extension_data_user_id ON extension_data(user_id);

-- Add comment
COMMENT ON TABLE extension_data IS 'Extension-specific data per user (blocklists, history, settings)';

-- Enable RLS (Row Level Security)
ALTER TABLE extension_data ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role (backend) to read/write all data
-- This is needed because backend uses service role key
CREATE POLICY "Service role can manage extension_data"
  ON extension_data
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Allow authenticated users to view their own data (if using auth.jwt())
-- This is optional - backend will handle access control via email matching
CREATE POLICY "Users can view own extension data"
  ON extension_data
  FOR SELECT
  TO authenticated
  USING (
    user_id = (auth.jwt() ->> 'email')
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_extension_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER extension_data_updated_at
  BEFORE UPDATE ON extension_data
  FOR EACH ROW
  EXECUTE FUNCTION update_extension_data_updated_at();

