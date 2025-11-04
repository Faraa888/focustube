-- Supabase Row Level Security (RLS) Setup
-- Run this in Supabase SQL Editor to make data private
-- This ensures users can only see their own data

-- Enable Row Level Security on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own data
CREATE POLICY "Users can view own data"
  ON users
  FOR SELECT
  USING (auth.uid()::text = id::text);

-- Policy: Users can only update their own data
CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  USING (auth.uid()::text = id::text);

-- Note: Service role key bypasses RLS
-- This is why we use service_role for the backend server
-- Regular users will only see their own data

-- To test RLS:
-- 1. Create a user in Supabase Auth
-- 2. Try to query users table from that user's context
-- 3. They should only see their own row

