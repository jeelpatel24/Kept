# Kept — Backend Schema & Data Organization

**Version:** 1.0 · **Date:** 2026-08-23
**Implements:** `TRD.md` · **Database:** PostgreSQL (Supabase)

---

## 1. Conventions

- `uuid` primary keys, `gen_random_uuid()`
- Every table: `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`
- Soft delete via `deleted_at timestamptz` on user-owned content; queries filter `deleted_at is null`
- Ownership: every row traces to a `users.id` via `notes.user_id`
- RLS enabled on all tables. Guest access is never via RLS — it goes through a
  service-role handler that has already validated the signed share token.
- Timestamps stored UTC. `notes.timezone` holds the IANA zone for date resolution.

## 2. Tables

### `users`
Supabase Auth mirror plus integration state.

| column | type | notes |
|--------|------|-------|
| id | uuid PK | matches auth.users.id |
| email | text not null unique | |
| display_name | text | |
| trello_token_encrypted | bytea | AES-256-GCM, nullable |
| trello_board_id | text | selected default board |
| trello_list_id | text | selected default list |
| trello_connected_at | timestamptz | |
| created_at / updated_at | timestamptz | |

### `sessions`
One recording attempt. Separated from `notes` so a failed transcription is diagnosable.

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK → users NOT NULL | |
| status | text NOT NULL | `recording` \| `uploaded` \| `transcribing` \| `transcribed` \| `transcription_failed` |
| recorded_at | timestamptz NOT NULL | anchor for relative date resolution |
| timezone | text NOT NULL | IANA, e.g. `America/Toronto` |
| duration_ms | integer | |
| audio_hash | text | sha256, cache key |
| audio_deleted_at | timestamptz | set when audio purged post-transcription |
| provider_used | text | which transcription provider succeeded |
| error_detail | text | populated on failure |
| created_at / updated_at / deleted_at | | |

Index: `(user_id, created_at desc)`, `(audio_hash)`

### `transcript_segments`
Timestamped transcript. The provenance anchor for everything downstream.

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| session_id | uuid FK → sessions NOT NULL | |
| seq | integer NOT NULL | 0-based ordering; referenced by extraction |
| start_ms | integer NOT NULL | |
| end_ms | integer NOT NULL | |
| text | text NOT NULL | |
| speaker_label | text | inferred, user-editable, nullable |
| speaker_confirmed | boolean NOT NULL default false | |

Unique: `(session_id, seq)`

### `notes`
The shared artifact.

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| session_id | uuid FK → sessions NOT NULL UNIQUE | |
| user_id | uuid FK → users NOT NULL | denormalised for RLS simplicity |
| title | text NOT NULL | model-suggested, user-editable |
| summary | text | short context paragraph |
| status | text NOT NULL default `draft` | `draft` \| `confirmed` |
| confirmed_at | timestamptz | |
| extraction_version | text NOT NULL | prompt version used, e.g. `extract.v1` |
| extraction_hash | text | cache key |
| created_at / updated_at / deleted_at | | |

**Constraint enforced in application layer:** no dispatch (Trello, email) is permitted
unless `status = 'confirmed'`.

### `participants`
Two-party by design, but modelled as rows so labels are correctable.

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| note_id | uuid FK → notes NOT NULL | |
| label | text NOT NULL | e.g. "Ravi", "Site super" |
| is_creator | boolean NOT NULL default false | |
| email | text | nullable, for share delivery |

### `commitments`
The ledger. The core object of the product.

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| note_id | uuid FK → notes NOT NULL | |
| kind | text NOT NULL | `commitment` \| `decision` \| `open_question` |
| text | text NOT NULL | |
| owner_participant_id | uuid FK → participants | nullable — null means unknown, never guessed |
| due_date | date | nullable |
| due_confidence | text | `high` \| `low` \| null |
| due_confirmed | boolean NOT NULL default false | |
| source_segment_ids | integer[] NOT NULL | provenance; CHECK array_length ≥ 1 |
| source_quote | text NOT NULL | verbatim |
| status | text NOT NULL default `open` | `open` \| `done` |
| trello_card_id | text | set on successful dispatch; makes dispatch idempotent |
| trello_card_url | text | |
| dispatched_at | timestamptz | |
| created_at / updated_at / deleted_at | | |

Index: `(note_id)`, `(note_id, status)`

`CHECK (array_length(source_segment_ids, 1) >= 1)` — enforces the no-provenance-no-item rule
at the database level, per `spec.md` principle 4.

### `share_links`
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| note_id | uuid FK → notes NOT NULL | |
| token_hash | text NOT NULL UNIQUE | store hash, not token |
| role | text NOT NULL default `guest` | |
| expires_at | timestamptz NOT NULL | default now() + 90 days |
| revoked_at | timestamptz | |
| last_viewed_at | timestamptz | |
| view_count | integer NOT NULL default 0 | |

### `corrections`
Guest-suggested edits, pending creator review.

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| note_id | uuid FK → notes NOT NULL | |
| commitment_id | uuid FK → commitments | nullable — note-level correction allowed |
| field | text NOT NULL | `text` \| `owner` \| `due_date` |
| suggested_value | text NOT NULL | |
| submitted_by_label | text | guest-entered name |
| status | text NOT NULL default `pending` | `pending` \| `accepted` \| `rejected` |
| resolved_at | timestamptz | |

### `llm_calls`
Cost and reliability observability. Small table, high demo value.

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| session_id | uuid FK → sessions | nullable |
| task | text NOT NULL | `transcribe` \| `extract` |
| provider | text NOT NULL | |
| model | text NOT NULL | |
| cache_hit | boolean NOT NULL default false | |
| input_tokens / output_tokens | integer | |
| latency_ms | integer | |
| status | text NOT NULL | `ok` \| `rate_limited` \| `failed` |
| created_at | timestamptz | |

## 3. Relationships

```
users 1─┬─* sessions 1──1 notes 1─┬─* commitments
        │           1──* transcript_segments
        │                          ├─* participants
        │                          ├─* share_links
        │                          └─* corrections
        └─* llm_calls (via session)
```

## 4. State machines

**Session:** `recording → uploaded → transcribing → transcribed`
with `transcribing → transcription_failed` (retryable back to `transcribing`).

**Note:** `draft → confirmed`. One-way. Editing a confirmed note's commitment is allowed;
the note does not return to draft, but the edit is recorded via `updated_at`.

**Commitment:** `open → done`, reversible. Independent of dispatch state.

## 5. Migrations

Sequential SQL files in `supabase/migrations/`, forward-only, named
`NNNN_description.sql`. Every migration logged in `MIGRATION_LOG.md` with the
requirement ID that motivated it. No destructive migration after 2026-09-08.

## 6. Retention

| Data | Retention |
|------|-----------|
| Audio | Deleted immediately after successful transcription (`sessions.audio_deleted_at`) |
| Transcript | Retained with note; deleted on note soft-delete + 30 days |
| Trello token | Until user revokes or 30-day Trello expiry |
| Share token | 90 days default, revocable at any time |
