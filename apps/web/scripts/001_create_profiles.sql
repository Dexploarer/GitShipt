-- GitShipt Supabase Auth Migration
-- Creates a profiles table linked to auth.users for app-specific user data.
-- Better-auth tables (sessions, accounts, verifications) are no longer used
-- and can be dropped after migration is complete.

-- Create user_role enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin', 'super_admin');
  END IF;
END$$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  -- Primary key matches auth.users.id for 1:1 relationship
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- GitShipt domain fields (previously in users table)
  github_id TEXT UNIQUE,
  github_username TEXT,
  role user_role NOT NULL DEFAULT 'user',
  mfa_secret_enc TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common lookups
CREATE INDEX IF NOT EXISTS profiles_github_username_idx ON public.profiles(github_username);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can read/update their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow insert only for authenticated users creating their own profile
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admins can read all profiles (for admin dashboard)
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- Super admins can update any profile (for role management)
CREATE POLICY "profiles_update_super_admin" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'super_admin'
    )
  );

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, github_id, github_username)
  VALUES (
    NEW.id,
    -- Extract GitHub info from user metadata if available
    COALESCE(NEW.raw_user_meta_data->>'provider_id', NULL),
    COALESCE(NEW.raw_user_meta_data->>'user_name', NULL)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
