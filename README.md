# Kept

**Record a real conversation between two people. Every commitment becomes a tracked task — on a shared, correctable note, pushed to Trello and your calendar.**

Built for AI Builders Hackathon 2026 by Jeel Patel. Governed by [`spec.md`](./spec.md) (canonical), expanded by [`docs/PRD.md`](./docs/PRD.md), [`docs/TRD.md`](./docs/TRD.md), [`docs/SCHEMA.md`](./docs/SCHEMA.md), [`docs/UX-BRIEF.md`](./docs/UX-BRIEF.md), built in the order of [`docs/IMPLEMENTATION-PLAN.md`](./docs/IMPLEMENTATION-PLAN.md).

## The problem

Commitments die in conversation. On a job site, a client call, a vendor meeting, two people agree to things out loud — "I'll send the quote Thursday", "we'll patch 204 before the painter comes" — and then nobody writes it down, or one person writes their own version the other never sees, or it never becomes a task anyone tracks. Meeting-notes tools produce a summary for one person. A summary is not an agreement, and it is not a task.

## What Kept does

```
Record → Transcribe → Extract → Confirm → Share → Dispatch
```

1. **Record** in the phone browser (one tap, consent prompt, visible indicator, 20-min cap).
2. **Transcribe** with Groq Whisper large-v3 (Gemini via OpenRouter as fallback). Audio is deleted the moment the transcript lands.
3. **Extract** decisions, commitments (who / by when) and open questions. Every item carries the transcript span it came from. Unknown owners stay unknown. Relative dates ("end of next week") are resolved deterministically against the recording date; anything ambiguous is flagged **amber** and must be confirmed.
4. **Confirm** — nothing is shared or sent until the human confirms. Enforced server-side, not by hiding a button.
5. **Share** — a signed link gives the other party the same note, "Your items" first, no account. They can suggest corrections; the creator accepts or rejects.
6. **Dispatch** — confirmed commitments become Trello cards (name, owner, verbatim quote, due date, link back to the exact moment in the transcript) and `.ics` calendar events with reminders (download or `webcal://` subscription that stays in sync).

The differentiator is the **commitment ledger**: not "here is a summary", but "here is what each person owes, by when, and whether it happened" — with **shared truth** (both parties see and can correct the same record) and **provenance** (every card links to the line that created it).

## Architecture

```
Phone browser (Next.js 15 App Router, TypeScript strict, Tailwind v4)
  │  MediaRecorder → 30s opus chunks
  ▼
Next.js Route Handlers — single deployable on Vercel
  ├── /api/sessions                      create session
  ├── /api/sessions/:id                  status · transcript · uploaded transition
  ├── /api/sessions/:id/audio            chunk upload → Supabase Storage (private bucket)
  ├── /api/sessions/:id/transcribe       → lib/llm/router → Groq Whisper (fallback: Gemini audio)
  ├── /api/sessions/:id/extract          → lib/llm/router → Gemini Flash (fallback: Groq Llama) → Zod → draft note
  ├── /api/notes/:id                     read · edit · draft → confirmed (gated)
  ├── /api/notes/:id/share               mint / revoke signed guest link
  ├── /api/share/:token                  guest read + suggest-correction (service role, token pre-validated)
  ├── /api/trello/connect                token exchange · board/list pick · revoke
  ├── /api/trello/dispatch               confirmed commitments → cards (idempotent, per-item results)
  ├── /api/notes/:id/calendar.ics        .ics download · webcal subscription
  └── /api/notes/:id/email               share email (Resend)
        │
        ├── Supabase Postgres (RLS on every table) — source of truth
        ├── Supabase Storage  — audio, deleted after transcription
        └── External: Groq · OpenRouter · Trello REST · Resend
```

Business logic lives in `lib/` (extraction, date resolution, routing, dispatch, tokens, crypto, ics); Route Handlers validate with Zod and call into it; components render.

Key decisions (see TRD §2): record-then-process rather than streaming; context-inferred speaker labels rather than diarization; `.ics` rather than Calendar OAuth; Trello key+token rather than full OAuth app review; provider router with ordered fallback; content-hash caching of every model call.

## Trust & safety design

- **Nothing writes without human confirmation.** Share, Trello and email endpoints refuse any note not in `confirmed` state.
- **No invented facts.** Owner and due date are `null` when the words don't support them — never "today", never "the user". Dates the resolver and the model disagree on, or that only the model could anchor, are amber and block confirmation until touched.
- **Provenance always.** `commitments.source_segment_ids` has a `CHECK (array_length >= 1)` at the database. Items without provenance are rejected before they reach the DB.
- **Model output is never trusted directly.** Parsed, validated by Zod, one repair retry, then a visible failure — with the raw transcript still shown.
- **Degrade honestly.** Transcription failure keeps the audio and offers retry; extraction failure shows the transcript; Trello partial failure reports exactly which cards failed and lets you retry each.
- **Secrets stay server-side.** Provider keys, Trello tokens (AES-256-GCM at rest) and the share-token HMAC secret never reach the client. `npm run check:secrets` scans the built client bundle.

## Setup

### 1. Supabase

1. Create a project. In **SQL Editor**, run each file in `supabase/migrations/` in order (`0001` → `0006`). See `MIGRATION_LOG.md`.
2. **Authentication → Providers → Email**: enable, keep "Confirm email" on (magic links). Add `http://localhost:3000/auth/callback` and your Vercel URL `/auth/callback` to **URL Configuration → Redirect URLs**.
3. **Project Settings → API**: copy the URL, `anon` key and `service_role` key.

### 2. Providers

- **Groq** — create an API key at console.groq.com. **Set a spend cap** (CLAUDE.md §5: $20 total budget).
- **OpenRouter** — create an API key, set a credit limit.
- **Trello** — get an API key at trello.com/power-ups/admin (create a Power-Up, then "API key"). Add your app origin to **Allowed origins** (e.g. `http://localhost:3000`, your Vercel domain).
- **Resend** (optional, PRD-F13) — API key + a verified sending domain, or use `onboarding@resend.dev` for testing to your own address.

### 3. Environment

```bash
cp .env.example .env.local
openssl rand -hex 32   # → ENCRYPTION_KEY
openssl rand -hex 32   # → SHARE_TOKEN_SECRET
```

Fill in `.env.local` (see `.env.example` for every variable). `APP_URL` must be the public URL (no trailing slash) — it is used in share links, Trello card back-links and the Trello return URL.

### 4. Run

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # unit tests (date resolution fixture table, schema, tokens, crypto, ics)
npm run typecheck
npm run lint
npm run build && npm run check:secrets
```

To record from a phone against a dev server, use an HTTPS tunnel (MediaRecorder requires a secure context) or deploy to Vercel from day one (Plan Stage 0).

### 5. Deploy (Vercel)

Import the repo, add every variable from `.env.local` to the project, set `APP_URL` to the Vercel URL, and add that URL to Supabase Redirect URLs and Trello Allowed origins. Route Handlers for transcribe/extract declare `maxDuration` (120–180s); on the Hobby plan the effective limit may be lower — the demo path (90s audio) completes in well under 45s.

## Manual E2E checklist

See [`docs/E2E-CHECKLIST.md`](./docs/E2E-CHECKLIST.md). Run on a real phone before each weekly checkpoint and twice on freeze day.

## Known limitations (deliberate)

- **No speaker diarization.** Speaker labels are inferred from context and are always editable. Wrong attribution is a tap away from fixed.
- **English only.**
- **20-minute cap** per recording; two-party conversations only. 3+ participants are not a first-class feature.
- **Record-then-process**, not live transcription. A 90-second conversation yields a note in well under 45 seconds; nothing appears while you are still talking.
- **Calendar is `.ics` / `webcal://`**, not two-way Google/Outlook sync.
- **Trello token expires after 30 days** (Trello's maximum for this flow); the settings screen shows the expiry and offers reconnect.
- **Fallback transcription (Gemini native audio)** returns estimated timestamps, so provenance jumps are approximate on that path.
- Single creator account model: no teams, no roles beyond creator/guest, no billing.

Everything in `spec.md` §6 OUT is on the roadmap, not in the repo.

## Repository layout

```
app/                   screens (S1–S8) and Route Handlers
components/            UI — no business logic
lib/
  audio/               chunk storage, assembly, purge
  calendar/            .ics generation
  email/               Resend
  extract/             Zod schema · relative-date resolver · resolve · pipeline
  llm/                 router (fallback chain, cache, llm_calls log) · providers/groq · providers/openrouter
  notes/               note graph loader, confirm gate
  prompts/             versioned prompts (extract.v1, transcribe.v1)
  share/               HMAC tokens · share_links
  transcribe/          pipeline
  trello/              client · AES-GCM · connection · dispatch
supabase/migrations/   0001–0006 (forward-only) — see MIGRATION_LOG.md
tests/                 vitest unit tests
docs/                  PRD · TRD · SCHEMA · UX-BRIEF · IMPLEMENTATION-PLAN · E2E-CHECKLIST
```

## License

Private hackathon submission. All rights reserved.
