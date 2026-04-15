-- ============================================================
-- Mentora Question Generation Runs Migration
-- Adds generation-cluster tracking for practice questions.
-- ============================================================

-- 1) Generation run metadata table (one row per generation action)
create table if not exists public.question_generation_runs (
  id                   uuid primary key default gen_random_uuid(),
  course_id            uuid not null references public.courses(id) on delete cascade,
  user_id              uuid not null references public.users(id) on delete cascade,
  question_type        text not null check (question_type in ('broad', 'short', 'mcq')),
  generation_label     text,
  requested_count      integer not null default 8,
  generated_sets_count integer not null default 0,
  saved_rows_count     integer not null default 0,
  failed_rows_count    integer not null default 0,
  status               text not null default 'running',
  is_archived          boolean not null default false,
  archived_at          timestamptz,
  source               text not null default 'question_lab',
  hot_topics           jsonb default '[]'::jsonb,
  pattern_snapshot     jsonb default '{}'::jsonb,
  created_at           timestamptz default now()
);

alter table public.question_generation_runs
  add column if not exists generation_label text,
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz;

-- 2) Add run linkage and part label to question_banks
alter table public.question_banks
  add column if not exists generation_run_id uuid references public.question_generation_runs(id) on delete set null,
  add column if not exists part_label text;

-- 3) Helpful indexes
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
