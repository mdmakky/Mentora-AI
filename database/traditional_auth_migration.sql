-- Traditional auth migration for existing Supabase DB
-- Run this in Supabase SQL Editor once.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Remove dependency on auth.users so backend can manage local user IDs.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND constraint_name = 'users_id_fkey'
    ) THEN
        ALTER TABLE public.users DROP CONSTRAINT users_id_fkey;
    END IF;
END $$;

ALTER TABLE public.users ALTER COLUMN id SET DEFAULT uuid_generate_v4();

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verification_code TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reset_code TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reset_code_expires_at TIMESTAMPTZ;

-- Cleanup old recursive policies if they still exist in your live DB.
DROP POLICY IF EXISTS "admin_access" ON public.users;
DROP POLICY IF EXISTS "admin_access" ON public.documents;
DROP POLICY IF EXISTS "admin_insert_only" ON public.admin_activity_logs;
DROP POLICY IF EXISTS "admin_read_only" ON public.admin_activity_logs;
