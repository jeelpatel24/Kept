-- 0004_share_links_corrections.sql
-- Implements: SCHEMA.md §2 `share_links`, `corrections` · PRD-F8, F9 · TRD-3.6, TRD-5.3
-- Guest access never goes through RLS: a service-role handler validates the signed token first.

create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  token_hash text not null unique,
  role text not null default 'guest' check (role in ('guest')),
  expires_at timestamptz not null default (now() + interval '90 days'),
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists share_links_note_idx on public.share_links (note_id);

drop trigger if exists share_links_set_updated_at on public.share_links;
create trigger share_links_set_updated_at before update on public.share_links
  for each row execute function public.set_updated_at();

alter table public.share_links enable row level security;
drop policy if exists "share_links: owner via note" on public.share_links;
create policy "share_links: owner via note" on public.share_links
  for all using (exists (select 1 from public.notes n where n.id = note_id and n.user_id = auth.uid()))
  with check (exists (select 1 from public.notes n where n.id = note_id and n.user_id = auth.uid()));

create table if not exists public.corrections (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  commitment_id uuid references public.commitments (id) on delete cascade,
  field text not null check (field in ('text','owner','due_date')),
  suggested_value text not null,
  submitted_by_label text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists corrections_note_status_idx on public.corrections (note_id, status);

drop trigger if exists corrections_set_updated_at on public.corrections;
create trigger corrections_set_updated_at before update on public.corrections
  for each row execute function public.set_updated_at();

alter table public.corrections enable row level security;
drop policy if exists "corrections: owner via note" on public.corrections;
create policy "corrections: owner via note" on public.corrections
  for all using (exists (select 1 from public.notes n where n.id = note_id and n.user_id = auth.uid()))
  with check (exists (select 1 from public.notes n where n.id = note_id and n.user_id = auth.uid()));
