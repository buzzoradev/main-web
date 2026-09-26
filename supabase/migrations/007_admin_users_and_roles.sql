-- ==============================================================================
-- BUZZORA STAGE 7A: SECURE ADMIN AUTHENTICATION & ROLE FOUNDATION
-- Migration: 007_admin_users_and_roles.sql
-- ==============================================================================
-- Purpose:
-- 1. Establish dedicated server-side admin role storage tied to Supabase Auth.
-- 2. Enforce strict role validation ('admin', 'superadmin') via DB constraints.
-- 3. Prevent privilege escalation via Row Level Security (RLS) denying public/client access.
-- 4. Enable immediate administrative revocation via is_active flag.
-- ==============================================================================

-- 1. Create admin_users table
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'superadmin')),
    email_snapshot TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Optimal indexes for frequent lookup & authorization checks
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_is_active ON public.admin_users(is_active);

-- 3. Row Level Security: strictly fail closed
-- Public (anon) and standard authenticated users MUST NEVER read or write admin roles
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'admin_users' AND policyname = 'Deny public and client access to admin_users'
    ) THEN
        CREATE POLICY "Deny public and client access to admin_users"
        ON public.admin_users
        FOR ALL
        TO anon, authenticated
        USING (false);
    END IF;
END $$;

-- 4. Trigger to automatically refresh updated_at timestamp on updates
CREATE OR REPLACE FUNCTION public.set_admin_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_admin_users_updated_at ON public.admin_users;

CREATE TRIGGER trg_set_admin_users_updated_at
BEFORE UPDATE ON public.admin_users
FOR EACH ROW
EXECUTE FUNCTION public.set_admin_users_updated_at();

-- ==============================================================================
-- PROVISIONING INSTRUCTIONS (ADMINISTRATIVE RUNBOOK)
-- ==============================================================================
-- To provision an administrator in production:
--
-- Step 1: Create the user in Supabase Auth (Dashboard -> Authentication -> Users -> Add User)
--         or via Supabase CLI / Auth Admin API.
--
-- Step 2: Retrieve the user's UUID from auth.users.
--
-- Step 3: Run the following SQL query in the Supabase SQL Editor:
--
--   INSERT INTO public.admin_users (user_id, role, email_snapshot, is_active)
--   VALUES (
--       '<USER_UUID_FROM_AUTH_USERS>',
--       'admin', -- or 'superadmin'
--       '<ADMIN_EMAIL>',
--       TRUE
--   )
--   ON CONFLICT (user_id) DO UPDATE SET
--       role = EXCLUDED.role,
--       is_active = EXCLUDED.is_active,
--       updated_at = now();
--
-- Step 4: To revoke admin access immediately, run:
--   UPDATE public.admin_users SET is_active = FALSE WHERE user_id = '<USER_UUID>';
-- ==============================================================================
