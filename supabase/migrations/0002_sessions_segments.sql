-- 0002_sessions_segments.sql
-- Implements: SCHEMA.md §2 `sessions`, `transcript_segments` · PRD-F2 · TRD-3.1, TRD-3.2, TRD-4.6

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  status text not null default 'recording'
    check (status in ('recording','uploaded','transcribing','transcribed','transcription_failed')),
  recorded_at timestamptz not null default now(),
  timezone text not null,
  duration_ms integer,
  audio_hash text,
  audio_deleted_at timestamptz,
  provider_used text,
  error_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists sessions_user_created_idx on public.sessions (user_id, created_at desc);
create index if not exists sessions_audio_hash_idx on public.sessions (audio_hash);

drop trigger if exists sessions_set_updated_at on public.sessions;
create trigger sessions_set_updated_at before update on public.sessions
  for each row execute function public.set_updated_at();

alter table public.sessions enable row level security;

drop policy if exists "sessions: owner all" on public.sessions;
create policy "sessions: owner all" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- transcript_segments: provenance anchor for everything downstream
create table if not exists public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  seq integer not null,
  start_ms integer not null,
  end_ms integer not null,
  text text not null,
  speaker_label text,
  speaker_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, seq)
);

drop trigger if exists transcript_segments_set_updated_at on public.transcript_segments;
create trigger transcript_segments_set_updated_at before update on public.transcript_segments
  for each row execute function public.set_updated_at();

alter table public.transcript_segments enable row level security;

drop policy if exists "segments: owner via session" on public.transcript_segments;
create policy "segments: owner via session" on public.transcript_segments
  for all using (
    exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
  );
