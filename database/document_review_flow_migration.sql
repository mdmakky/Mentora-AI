-- ============================================================
-- Mentora Document Review Flow Migration
-- Date: 2026-04-16
-- Purpose: support user rescan + admin review request workflow
-- ============================================================

alter table public.documents
  add column if not exists flag_reason text,
  add column if not exists review_requested boolean not null default false,
  add column if not exists review_status text not null default 'none',
  add column if not exists review_note text,
  add column if not exists review_requested_at timestamptz,
  add column if not exists review_decided_at timestamptz,
  add column if not exists review_decided_by uuid references public.users(id) on delete set null,
  add column if not exists rescan_count integer not null default 0,
  add column if not exists last_rescanned_at timestamptz;

alter table public.documents
  drop constraint if exists documents_review_status_check;

alter table public.documents
  add constraint documents_review_status_check
  check (review_status in ('none', 'pending', 'approved', 'rejected'));

create index if not exists idx_documents_review_pending
  on public.documents (review_status, created_at desc)
  where is_deleted = false;
 