# Migration log

Per `docs/SCHEMA.md` §5: sequential, forward-only, each entry names the requirement that motivated it.
No destructive migration after 2026-09-08.

| File | Date | Motivated by | Summary |
|------|------|--------------|---------|
| `0001_users.sql` | 2026-08-24 | SCHEMA §2 users · TRD-5.1 · TRD-5.2 | Auth mirror, Trello integration state, RLS self-only, `set_updated_at()` trigger |
| `0002_sessions_segments.sql` | 2026-08-24 | SCHEMA §2 sessions, transcript_segments · PRD-F2 · TRD-3.2 · TRD-4.6 | Recording session lifecycle, timestamped segments (provenance anchor), RLS via owner |
| `0003_notes_participants_commitments.sql` | 2026-08-24 | SCHEMA §2 notes, participants, commitments · PRD-F4, F5, F7, F11, F14 | Shared note, participants, commitment ledger with `CHECK array_length(source_segment_ids,1) >= 1` |
| `0004_share_links_corrections.sql` | 2026-08-24 | SCHEMA §2 share_links, corrections · PRD-F8, F9 · TRD-3.6, TRD-5.3 | Hashed share tokens, guest corrections |
| `0005_llm_calls_cache.sql` | 2026-08-24 | SCHEMA §2 llm_calls · TRD-2.7 · Plan Stage 0 | Observability table + content-hash cache (service-role only) |
| `0006_storage_audio.sql` | 2026-08-24 | TRD §1 · TRD-3.1 · TRD-4.6 | Private `audio` storage bucket |
| `0007_reminders.sql` | 2026-08-27 | PRD-F17 (docs/PRD-AMENDMENT-01.md) | `users.reminders_enabled` opt-in flag for the daily digest |
