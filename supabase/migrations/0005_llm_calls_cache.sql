-- 0005_llm_calls_cache.sql
-- Implements: SCHEMA.md §2 `llm_calls` · TRD-2.7, TRD-3.4 · IMPLEMENTATION-PLAN Stage 0 "content-hash cache table"
-- Both tables are written only by the service-role handler (no client policies).

create table if not exists public.llm_calls (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions (id) on delete set null,
  task text not null check (task in ('transcribe','extract')),
  provider text not null,
  model text not null,
  cache_hit boolean not null default false,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  status text not null check (status in ('ok','rate_limited','failed')),
  created_at timestamptz not null default now()
);

create index if not exists llm_calls_session_idx on public.llm_calls (session_id);

alter table public.llm_calls enable row level security;
drop policy if exists "llm_calls: owner read via session" on public.llm_calls;
create policy "llm_calls: owner read via session" on public.llm_calls
  for select using (exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid()));

-- Content-hash cache: keyed on sha256 of the task input. Re-running the same audio must not re-bill.
create table if not exists public.llm_cache (
  task text not null check (task in ('transcribe','extract')),
  input_hash text not null,
  provider text not null,
  model text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (task, input_hash)
);

alter table public.llm_cache enable row level security;
-- No policies: service role only.
