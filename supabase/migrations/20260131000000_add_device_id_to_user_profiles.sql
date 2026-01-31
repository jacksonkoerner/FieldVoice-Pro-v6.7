-- Migration: Add device_id column to user_profiles table
-- Date: 2026-01-31
-- Purpose: Fix schema mismatch - PowerSync and application code expect device_id column

-- Add device_id column to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Create unique index on device_id (required for upsert with onConflict: 'device_id')
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_device_id_unique ON user_profiles(device_id) WHERE device_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.device_id IS 'Unique device identifier from localStorage, used to identify user profiles per device';
