-- 0003_notes_participants_commitments.sql
-- Implements: SCHEMA.md §2 `notes`, `participants`, `commitments` · PRD-F4, F5, F7, F11, F14 · TRD-3.3, 3.5, 3.7
-- spec.md principle 4: CHECK on source_segment_ids enforces no-provenance-no-item at the DB.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  summary text,
  status text not null default 'draft' check (status in ('draft','confirmed')),
  confirmed_at timestamptz,
  extraction_version text not null,
  extraction_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists notes_user_created_idx on public.notes (user_id, created_at desc);

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at before update on public.notes
  for each row execute function public.set_updated_at();

alter table public.notes enable row level security;
drop policy if exists "notes: owner all" on public.notes;
create policy "notes: owner all" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- participants
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  label text not null,
  is_creator boolean not null default false,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists participants_note_idx on public.participants (note_id);

drop trigger if exists participants_set_updated_at on public.participants;
create trigger participants_set_updated_at before update on public.participants
  for each row execute function public.set_updated_at();

alter table public.participants enable row level security;
drop policy if exists "participants: owner via note" on public.participants;
create policy "participants: owner via note" on public.participants
  for all using (exists (select 1 from public.notes n where n.id = note_id and n.user_id = auth.uid()))
  with check (exists (select 1 from public.notes n where n.id = note_id and n.user_id = auth.uid()));

-- commitments: the ledger
create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  kind text not null check (kind in ('commitment','decision','open_question')),
  text text not null,
  owner_participant_id uuid references public.participants (id) on delete set null,
  due_date date,
  due_confidence text check (due_confidence in ('high','low')),
  due_confirmed boolean not null default false,
  source_segment_ids integer[] not null,
  source_quote text not null,
  status text not null default 'open' check (status in ('open','done')),
  trello_card_id text,
  trello_card_url text,
  dispatched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint commitments_provenance_required check (array_length(source_segment_ids, 1) >= 1)
);

create index if not exists commitments_note_idx on public.commitments (note_id);
create index if not exists commitments_note_status_idx on public.commitments (note_id, status);

drop trigger if exists commitments_set_updated_at on public.commitments;
create trigger commitments_set_updated_at before update on public.commitments
  for each row execute function public.set_updated_at();

alter table public.commitments enable row level security;
drop policy if exists "commitments: owner via note" on public.commitments;
create policy "commitments: owner via note" on public.commitments
  for all using (exists (select 1 from public.notes n where n.id = note_id and n.user_id = auth.uid()))
  with check (exists (select 1 from public.notes n where n.id = note_id and n.user_id = auth.uid()));
