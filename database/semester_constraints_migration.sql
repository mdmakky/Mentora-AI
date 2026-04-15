-- ============================================================
-- Mentora Semester Constraints Migration
-- Date: 2026-04-16
-- Purpose: enforce one semester number per user and valid 1st-8th terms
-- ============================================================

-- Normalize term values where possible (safe canonicalization by existing number pattern).
update public.semesters
set term = concat(
  regexp_replace(lower(coalesce(term, '') || ' ' || coalesce(name, '')), '.*\b([1-8])(?:st|nd|rd|th)?\b.*', '\1'),
  case regexp_replace(lower(coalesce(term, '') || ' ' || coalesce(name, '')), '.*\b([1-8])(?:st|nd|rd|th)?\b.*', '\1')
    when '1' then 'st'
    when '2' then 'nd'
    when '3' then 'rd'
    else 'th'
  end
)
where (coalesce(term, '') || ' ' || coalesce(name, '')) ~* '\b([1-8])(?:st|nd|rd|th)?\b';

-- Enforce valid term domain.
alter table public.semesters
  drop constraint if exists semesters_term_valid_check;

alter table public.semesters
  add constraint semesters_term_valid_check
  check (lower(term) in ('1st','2nd','3rd','4th','5th','6th','7th','8th'));

-- IMPORTANT: if this index creation fails, you still have existing duplicates.
-- Keep one row per (user_id, term), delete extras, then run again.
create unique index if not exists idx_semesters_user_term_unique
  on public.semesters (user_id, lower(term));
