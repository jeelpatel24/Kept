# Engineering Standards

How code gets written in this repo. Every commit is held to these rules.

---

## 0. Read order

1. `spec.md` — canonical. Wins over everything.
2. `docs/PRD.md` — what and why
3. `docs/TRD.md` — how
4. `docs/SCHEMA.md` — data
5. `docs/UX-BRIEF.md` — screens and states
6. `docs/IMPLEMENTATION-PLAN.md` — build order

If two documents conflict, `spec.md` wins. If `spec.md` is silent, **stop and ask.**
Do not resolve ambiguity by guessing.

---

## 1. Scope discipline (the most important rule)

This is a 23-day solo build with a hard deadline of **2026-09-15, 23:00 EDT**.
Scope creep is the primary failure mode, not bugs.

- Never implement anything in `spec.md` §6 OUT.
- Never add a dependency, table, route, or screen that is not traceable to a
  requirement ID. If you think one is needed, say so and wait.
- If a task is taking longer than its plan estimate, stop and report rather than
  expanding the approach.
- Prefer the boring solution. This is not a platform. It is one flow that must work.

---

## 2. Traceability

Every non-trivial PR/commit must state which requirement it implements:

```
feat(extract): commitment extraction with provenance spans

Implements: PRD-F4, TRD-3.3
Touches: commitments, transcript_segments
```

Requirement IDs live in PRD (`PRD-Fn`) and TRD (`TRD-n.n`).
No ID → do not build it.

---

## 3. Code rules

- **TypeScript strict.** No `any`. No `@ts-ignore` without a comment explaining why.
- **Server-side only for secrets.** Provider API keys and Trello tokens never reach the client.
  All model and Trello calls go through Route Handlers.
- **No business logic in components.** Extraction, parsing, dispatch logic lives in `lib/`.
- **Validate at the boundary.** Every Route Handler validates input with Zod before use.
- **Every external call has a timeout, a retry, and a typed failure path.** The demo must not
  hang on a 429.
- Small commits, real messages. A repo with three "add feature" commits reads as unowned work.

## 4. Model-output rules

- **Model output is never trusted directly.** Parse it, validate it against a schema, and
  reject malformed output rather than coercing it.
- **Every extracted item carries provenance** — the transcript character span it came from.
  An item without provenance is a bug, not a feature.
- **Confidence is surfaced, not hidden.** Dates and owners below the confidence threshold render
  visually distinct and require confirmation.
- **No silent fallback to a guess.** If the model cannot determine an owner or a date,
  the field is `null` and the UI asks. Never default to "today" or "the user."
- Prompts live in `lib/prompts/` as versioned exported constants — never inline in a handler.

## 5. Cost and rate limits

- Hard budget: **$20 total.** Spend cap set in the provider dashboard.
- **Cache by content hash.** Transcription and extraction results are keyed on a hash of the
  input. Re-running the same test audio must not re-bill. This is not optional — it is the
  single biggest cost lever during development.
- Provider calls go through `lib/llm/router.ts` with an ordered fallback chain.
  Never hardcode a single model name at a call site.
- Log token usage per call in development.

## 6. Data and privacy

- Audio is deleted after transcription completes. Only the transcript persists.
- Trello tokens are encrypted at rest, scoped to the minimum, and revocable by the user.
- Shared-link tokens are signed, single-purpose, and expiring.
- Test with synthetic or self-recorded audio only. Never a real third party's conversation
  in the repo, fixtures, or demo.

## 7. Never do

- Never write to Trello, calendar, or email without explicit user confirmation in the UI.
- Never fabricate demo data. If a value is not real, it is not rendered.
  Empty states are honest; fake rows are not.
- Never commit `.env`, tokens, or recorded audio.

## 8. Definition of done (per task)

A task is done when:

- [ ] The requirement ID it claims is fully implemented
- [ ] Input is validated; failure path is handled and visible to the user
- [ ] It works on a phone-width viewport
- [ ] It has been run manually end-to-end at least once
- [ ] No secret is exposed client-side
- [ ] README updated if setup changed

Otherwise the status is NOT DONE. Report it as NOT DONE.

## 9. Freeze

**Feature freeze: 2026-09-08.** After that date, only bug fixes, polish, README,
demo video, and deck. No new capability regardless of how small it seems.
