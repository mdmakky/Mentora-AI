-- ============================================================
-- Mentora Question Generation Runs Hotfix
-- Date: 2026-04-16
-- Purpose: Ensure rename and generation history metadata columns exist
-- ============================================================

-- Add missing columns on generation runs table
alter table if exists public.question_generation_runs
  add column if not exists generation_label text,
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz;

-- Ensure run linkage columns exist on question bank rows
alter table if exists public.question_banks
  add column if not exists generation_run_id uuid references public.question_generation_runs(id) on delete set null,
  add column if not exists part_label text;

-- Helpful indexes (safe if already present)
create index if not exists idx_qgr_course_user_created
  on public.question_generation_runs (course_id, user_id, created_at desc);

create index if not exists idx_qgr_course_user_type_created
  on public.question_generation_runs (course_id, user_id, question_type, created_at desc);

create index if not exists idx_qgr_course_user_active
  on public.question_generation_runs (course_id, user_id, is_archived, created_at desc);

create index if not exists idx_qb_generation_run
  on public.question_banks (generation_run_id);

create index if not exists idx_qb_course_user_type_source
  on public.question_banks (course_id, user_id, question_type, source_type, created_at desc);
