-- 0007_reminders.sql
-- Implements: PRD-F17 (docs/PRD-AMENDMENT-01.md) — opt-in daily reminder digest.
-- Opt-in default false: nothing is emailed unless the user enables it (spec principle 1).

alter table public.users
  add column if not exists reminders_enabled boolean not null default false;
