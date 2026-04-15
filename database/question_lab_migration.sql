-- ============================================================
-- Mentora Question Lab — Database Migration / Fix
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- Drop the incorrectly constrained tables if they exist
drop table if exists course_hot_topics;
drop table if exists paper_analyses;

-- ─────────────────────────────────────────────────────────────
-- 1. paper_analyses
--    Stores the merged pattern analysis from past question papers
--    per course per user (one row per course+user, upserted each time).
-- ─────────────────────────────────────────────────────────────
create table public.paper_analyses (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references public.courses(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  pattern_json    jsonb,          -- full merged analysis from vision AI
  repeat_topics   jsonb,          -- array of {topic, frequency, typical_marks, ...}
  paper_doc_ids   text[],         -- IDs of documents that were analyzed
  analyzed_at     timestamptz default now(),
  created_at      timestamptz default now(),
  unique (course_id, user_id)
);

alter table public.paper_analyses enable row level security;

create policy "Users can manage own analyses"
  on public.paper_analyses for all
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 2. course_hot_topics
--    Stores teacher-emphasized topics per course per user.
--    Users can add / delete topics any time.
-- ─────────────────────────────────────────────────────────────
create table public.course_hot_topics (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  topic       text not null check (length(trim(topic)) > 0),
  created_at  timestamptz default now()
);

alter table public.course_hot_topics enable row level security;

create policy "Users can manage own hot topics"
  on public.course_hot_topics for all
  using (user_id = auth.uid());

-- Optional: prevent exact duplicate topics per course+user
create unique index uniq_hot_topic_per_course
  on public.course_hot_topics (course_id, user_id, lower(trim(topic)));

-- ─────────────────────────────────────────────────────────────
-- 3. question_banks — add new columns needed by Question Lab
--    (safe to run multiple times)
-- ─────────────────────────────────────────────────────────────
alter table public.question_banks
  add column if not exists source_type  text default 'manual',
  add column if not exists topic        text,
  add column if not exists probability  text,   -- 'high' | 'medium' | 'low'
  add column if not exists set_number   integer,
  add column if not exists marks        integer;

-- Index for fast lookup of practice-generated questions
create index if not exists idx_qb_source_type
  on public.question_banks (course_id, user_id, source_type);
