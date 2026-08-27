# PRD Amendment 01 — Follow-ups & Reminders

**Date:** 2026-08-27 · **Author:** Jeel Patel · **Amends:** `PRD.md` §6 · **Status:** Approved (pre-freeze)

The ledger promise is "who owes what, by when, **and whether it happened**". v1.0 covered capture through
dispatch; this amendment closes the loop after dispatch, before the 2026-09-08 freeze.

## New functional requirements

| ID | Requirement | Priority | Story |
|----|-------------|----------|-------|
| PRD-F16 | **Follow-ups screen**: every open commitment across all confirmed notes in one list, grouped by urgency (Overdue · Today · Tomorrow · This week · Later · No date), with owner, source note, and a one-tap done toggle. Reachable from Home with an open count. | P1 | US11 |
| PRD-F17 | **Automatic reminder digest**: an opt-in daily email listing overdue / due-today / due-tomorrow commitments, sent server-side on a schedule (plus on demand). Opt-in is explicit; nothing is emailed without the user enabling it. | P1 | US12 |

## New user stories

- **US11** As Ravi, I can open one screen that shows everything still owed across all my conversations,
  most urgent first, so nothing slips once the conversation is three weeks old.
- **US12** As Ravi, I get a morning email listing what is overdue and due today, so the system chases the
  commitments instead of me — like a calendar reminder, but for promises.

## Scope guard

Still OUT (spec §6 unchanged): scheduling/availability, CRM/Slack/Jira, push notifications, native app.
The digest reuses the existing Resend integration (TRD-3.9) and the existing commitment data — no new
external services. Device-level alarms remain the job of the `.ics` VALARM (PRD-F12).

## Technical notes

- `users.reminders_enabled boolean not null default false` — migration `0007_reminders.sql` (opt-in, per spec principle 1).
- Bucketing is deterministic and timezone-aware (`lib/followups/bucket.ts`), unit-tested like date resolution.
- Scheduled run: Vercel Cron → `GET /api/reminders/run` authorised by `CRON_SECRET` bearer token; the route is
  otherwise unauthenticated-inaccessible. A signed-in user can also trigger their own digest (`POST`).
