-- Migration: Fix RLS policies to allow inserts
-- Run this in Supabase SQL Editor
-- This allows authenticated users to insert/update their own data

-- First, check if RLS is enabled (you can skip this if RLS is disabled)
-- To disable RLS entirely (for MVP/testing), run:
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- If you want to keep RLS enabled, use these policies:

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Authenticated users can insert" ON users;
DROP POLICY IF EXISTS "Authenticated users can manage own data" ON users;

-- Policy: Allow authenticated users to insert their own data
-- This matches by email from the JWT token
CREATE POLICY "Authenticated users can insert own data"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'email' = email
  );

-- Policy: Allow authenticated users to view their own data
CREATE POLICY "Authenticated users can view own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'email' = email
  );

-- Policy: Allow authenticated users to update their own data
CREATE POLICY "Authenticated users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'email' = email
  );

-- Note: If you want to disable RLS entirely (simpler for MVP), run:
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;
-- This allows all operations without policies
