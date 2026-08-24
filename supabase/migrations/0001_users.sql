-- 0001_users.sql
-- Implements: SCHEMA.md §2 `users`, TRD-5.1, TRD-5.2
-- Supabase Auth mirror plus integration state.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text,
  trello_token_encrypted bytea,
  trello_board_id text,
  trello_list_id text,
  trello_connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at trigger shared by all tables
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

-- Mirror new auth users into public.users
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

alter table public.users enable row level security;

drop policy if exists "users: self read" on public.users;
create policy "users: self read" on public.users
  for select using (auth.uid() = id);

drop policy if exists "users: self update" on public.users;
create policy "users: self update" on public.users
  for update using (auth.uid() = id);
