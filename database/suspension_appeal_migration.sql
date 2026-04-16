-- ============================================================
-- Mentora: Suspension Appeal Migration
-- Purpose: Track when a user was suspended (for 7-day auto-lift)
--          and allow users to submit appeals for admin review
-- Run in Supabase SQL Editor
-- ============================================================

-- Track suspension timestamp for 7-day auto-lift
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS upload_suspended_at TIMESTAMPTZ;

-- Suspension appeals submitted by users
CREATE TABLE IF NOT EXISTS public.suspension_appeals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    message         TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
    admin_response  TEXT,
    decided_by      UUID REFERENCES public.users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    decided_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_suspension_appeals_user   ON public.suspension_appeals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suspension_appeals_status ON public.suspension_appeals(status, created_at DESC);
