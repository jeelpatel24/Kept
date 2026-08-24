# Kept — Implementation Plan

**Version:** 1.0 · **Date:** 2026-08-23
**Controls build order.** Governed by `spec.md`.

**Start:** 2026-08-23 · **Feature freeze:** 2026-09-08 · **Submission:** 2026-09-15 23:00 EDT
**Working assumption:** solo, part-time — plan to ~3 focused hours on weekdays, more on weekends.

---

## Build order rationale

Bottom-up along the data path. Each stage produces something demonstrable, so if time
runs out at any point you still have a working product, just a smaller one.

```
Foundation → Capture → Transcribe → Extract → Review → Share → Trello → Calendar → Polish
```

**Never skip forward.** Do not build the Trello integration before extraction is
producing trustworthy output — you will be dispatching garbage and won't know it.

---

## Stage 0 — Foundation · Aug 23–24

- [ ] Next.js 15 + TypeScript strict, Tailwind, repo init, README skeleton
- [ ] Supabase project, all migrations from `SCHEMA.md`, RLS on
- [ ] Supabase Auth (email magic link) — creator accounts only
- [ ] `lib/llm/router.ts` skeleton with provider chain from env
- [ ] Content-hash cache table + helper (do this now, not later — it pays for itself immediately)
- [ ] Vercel deploy from day one. Never a big-bang deploy at the end.
- [ ] Spend cap set in Groq and OpenRouter dashboards

**Exit:** deployed empty app, auth works, migrations applied, one test LLM call logged.

## Stage 1 — Capture · Aug 25–26
*Implements PRD-F1, F3 · TRD-3.1*

- [ ] MediaRecorder, chunked 30s upload to Supabase Storage
- [ ] S1 Home, S2 Recording screens
- [ ] Consent modal, persistent recording indicator, 18-min warning / 20-min stop
- [ ] Session row lifecycle: `recording → uploaded`

**Exit:** record 5 minutes on a real phone, chunks land in storage, session row correct.

## Stage 2 — Transcription · Aug 27–28
*Implements PRD-F2 · TRD-3.2*

- [ ] Groq Whisper integration, segments normalised and persisted
- [ ] Fallback provider wired through the router
- [ ] Cache by audio hash
- [ ] Audio deleted on success (TRD-4.6)
- [ ] S3 Processing screen with streaming transcript
- [ ] **Record 3 fixture conversations: quiet, noisy site, ambiguous dates.** These become
      your test set for the rest of the build.

**Exit:** 90s site audio → readable transcript in under 25s. Fixtures committed (self-recorded only).

## Stage 3 — Extraction · Aug 29–Sep 1  ← *the hard part, give it the weekend*
*Implements PRD-F4, F5, F6 · TRD-3.3*

- [ ] Zod schema + strict JSON prompt (`lib/prompts/extract.v1.ts`)
- [ ] Provenance enforcement — reject any item with empty `source_segment_ids`
- [ ] Relative date resolution anchored to `recorded_at` + timezone
- [ ] Confidence scoring on dates; `null` rather than a guess
- [ ] Speaker label inference from context
- [ ] Unit test: fixture table of ~20 relative time expressions
- [ ] Iterate prompt against all 3 fixtures until commitment recall is subjectively ≥80%

**Exit:** all three fixtures produce correct owners on most commitments, no invented dates,
every item traceable to a transcript span.

## Stage 4 — Review & Confirm · Sep 2–3
*Implements PRD-F7, F15 · TRD-3.5 · UX S4*

- [ ] S4 Review screen, three sections, commitments first
- [ ] Editable owner chips, editable dates, amber low-confidence state
- [ ] Confirm gated server-side on state, not just UI
- [ ] Transcript accordion with jump-to-source from a quote
- [ ] Zero-extraction and failure states

**Exit:** the full solo loop works end to end. **If you stop here you still have a demo.**

## Stage 5 — Sharing · Sep 4–5
*Implements PRD-F8, F9, F13 · TRD-3.6, 3.9 · UX S5, S6*

- [ ] Signed share token mint + guest route
- [ ] S6 guest view, "Your items" first
- [ ] Correction submission + creator accept/reject
- [ ] Email delivery of the link

**Exit:** open the link on a second physical device, submit a correction, accept it.

## Stage 6 — Trello · Sep 6–7
*Implements PRD-F10, F11 · TRD-3.7 · UX S7*

- [ ] Trello authorize flow, token encrypted at rest, revoke works
- [ ] Board/list picker
- [ ] Dispatch: cards with name, description (owner + quote + share link), due date
- [ ] Idempotency via `trello_card_id`; per-item partial-failure reporting

**Exit:** confirmed note → cards on a real board, each linking back to the note.

## Stage 7 — Calendar · Sep 8 (half day)
*Implements PRD-F12 · TRD-3.8*

- [ ] `.ics` generation with VALARM, per-item and per-person
- [ ] `webcal://` subscription route

## ⛔ FEATURE FREEZE — end of Sep 8

Nothing new after this line. If a stage is incomplete, it ships incomplete or gets cut
cleanly — it does not eat polish week.

## Stage 8 — Hardening · Sep 9–10

- [ ] Failure drills: provider 429, malformed JSON, Trello 401, upload interruption
- [ ] Manual E2E checklist, twice, on a real phone
- [ ] Mobile pass at 390px on every P0 screen
- [ ] Verify no secret in the client bundle
- [ ] Accessibility pass: contrast, labels, amber-state icon not colour-alone

## Stage 9 — Repo & docs · Sep 11

- [ ] README: problem, architecture diagram, setup, env, run instructions, limitations
- [ ] Honest **Known limitations** section — no diarization, English only, 20-min cap.
      Judges trust a project that names its edges.
- [ ] Architecture diagram image
- [ ] Clean commit history review

## Stage 10 — Demo video · Sep 12–13

Script (5 min max):
1. 0:00–0:45 — the problem, told as a real lost commitment
2. 0:45–2:15 — live: record a 60s conversation, note appears
3. 2:15–3:00 — the amber confirm moment (the anti-hallucination story)
4. 3:00–3:45 — second device opens the share link
5. 3:45–4:30 — Trello cards land; click a card → back to the exact quote
6. 4:30–5:00 — architecture flash + roadmap

Record against pre-warmed/cached results. Do not gamble the video on a live cold API call.
Shoot at least three takes.

## Stage 11 — Deck & submit · Sep 14–15

10 slides: Problem · Solution · Target user · Features · Architecture · AI stack ·
Trust & safety design · Impact · Roadmap · Ask.

- [ ] Submit by **Sep 14**, not Sep 15. Deadline-day submission is how people lose.
- [ ] Claim the Tin Computer credits if still open

---

## Cut list (in order, if behind schedule)

1. Email delivery (PRD-F13) — share link can be copied manually
2. Guest corrections (PRD-F9) — read-only guest view still tells the story
3. Calendar / .ics (PRD-F12) — mention as roadmap
4. Commitment status toggle (PRD-F14)

**Never cut:** capture, transcription, extraction with provenance, review/confirm, share link,
Trello dispatch. That is the spine and the pitch.

## Weekly checkpoints

- **Sun Aug 30** — transcription solid, extraction in progress
- **Sun Sep 6** — solo loop + sharing done, Trello underway
- **Mon Sep 8** — FREEZE. Whatever exists is the product.
- **Sun Sep 13** — video done
- **Mon Sep 14** — submitted
