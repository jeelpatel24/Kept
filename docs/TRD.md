# Kept — Technical Requirements Document

**Version:** 1.0 · **Date:** 2026-08-23
**Implements:** `PRD.md` · **Governed by:** `spec.md`

---

## 1. Architecture overview

```
Phone browser (Next.js client)
  │  MediaRecorder → audio chunks
  ▼
Next.js Route Handlers  (single deployable on Vercel)
  ├── /api/sessions            create + manage recording session
  ├── /api/sessions/:id/audio  chunk upload → Supabase Storage
  ├── /api/sessions/:id/transcribe   → Groq Whisper large-v3
  ├── /api/sessions/:id/extract      → LLM router → structured JSON
  ├── /api/notes/:id           note read/update
  ├── /api/notes/:id/share     signed link mint
  ├── /api/share/:token        guest read + correction submit
  ├── /api/trello/connect      token exchange
  ├── /api/trello/dispatch     confirmed commitments → cards
  ├── /api/notes/:id/calendar.ics   .ics generation
  └── /api/notes/:id/email     share email
        │
        ├── Supabase Postgres  (source of truth)
        ├── Supabase Storage   (audio, deleted post-transcription)
        └── External: Groq · OpenRouter/Gemini · Trello REST
```

## 2. Key decisions and justification

| # | Decision | Why |
|---|----------|-----|
| TRD-2.1 | Single Next.js app, Route Handlers as API — no separate backend service | 23-day solo build. Two deployables doubles ops surface for zero benefit at this scale. Business logic isolated in `lib/` so extraction later if needed. |
| TRD-2.2 | Record-then-process, not streaming | Streaming transcription triples complexity and adds a live failure mode on stage. Batch is reliable and fast enough (<45s for 90s audio). |
| TRD-2.3 | Context-inferred speaker labels, not diarization | Diarization is a multi-day problem with poor accuracy on noisy two-party audio. Inference + one-tap correction is honest and ships. |
| TRD-2.4 | `.ics` files, not Calendar OAuth | Google OAuth verification takes weeks; unverified consent screen looks broken. `.ics` works with every calendar, no auth, no quota. |
| TRD-2.5 | Trello token, not full OAuth app review | Trello key+token flow requires no app verification. One day of work vs. weeks. |
| TRD-2.6 | Provider router with ordered fallback | Free/cheap tiers rate-limit unpredictably. A single hardcoded provider is a demo-day failure waiting to happen. |
| TRD-2.7 | Content-hash caching of transcription and extraction | Development re-runs the same audio dozens of times. Without caching the $20 budget dies in week one. |

## 3. Component requirements

### TRD-3.1 Capture (implements PRD-F1, F3)
- `MediaRecorder` API, `audio/webm;codecs=opus`, mono, 16kHz target
- Chunked at 30s intervals, uploaded progressively so a 20-min session is never held in memory
- Persistent visible recording indicator; browser tab title reflects state
- Consent modal on first use per session; copy is a suggestion prompt, not legal advice
- Hard stop at 20 minutes with warning at 18

### TRD-3.2 Transcription (implements PRD-F2)
- Primary: Groq `whisper-large-v3`
- Fallback: Gemini native audio input via OpenRouter
- Output normalised to `TranscriptSegment[] { index, startMs, endMs, text }`
- Cache key: `sha256(audio bytes)` → skip provider call on repeat
- Timeout 120s; on total failure the session state is `transcription_failed` and the UI offers retry

### TRD-3.3 Extraction (implements PRD-F4, F5, F6)
- Input: full transcript with segment indices + recording date + timezone
- Output: strict JSON validated by Zod. Malformed output → one repair retry → then fail visibly
- Schema per extracted item:
  ```ts
  {
    type: 'decision' | 'commitment' | 'open_question',
    text: string,
    ownerLabel: string | null,        // null when unknown — never guessed
    dueDate: string | null,           // ISO date
    dueConfidence: 'high' | 'low' | null,
    sourceSegmentIds: number[],       // provenance — required, non-empty
    sourceQuote: string               // verbatim span
  }
  ```
- `sourceSegmentIds` empty → item rejected before it reaches the DB
- Relative dates ("end of next week", "before Thursday") resolved against `recordedAt`;
  anything not anchorable to a concrete date → `dueDate: null`, never a default
- Prompts versioned in `lib/prompts/extract.v1.ts`

### TRD-3.4 LLM router (implements TRD-2.6)
- `lib/llm/router.ts` exposes `complete(task, payload)` where task ∈ `{transcribe, extract}`
- Ordered provider chain per task, configured by env, not hardcoded at call sites
- Per-call: 60s timeout, 2 retries with exponential backoff, 429 → immediate next provider
- Token usage logged per call in development

### TRD-3.5 Review and confirmation (implements PRD-F7)
- Note enters state `draft`. No dispatch endpoint accepts a note not in state `confirmed`
- Enforced server-side, not by hiding a button
- Low-confidence dates block confirmation until touched by the user

### TRD-3.6 Sharing (implements PRD-F8, F9)
- Share token: HMAC-signed, contains `noteId` + `role: guest` + `exp` (default 90 days)
- Guest route is read + suggest-correction only; enforced server-side
- Corrections stored as pending rows; creator accepts/rejects; accepted correction updates the item
  and records who changed it

### TRD-3.7 Trello integration (implements PRD-F10, F11)
- Token obtained via Trello's authorize URL with scope `read,write`, expiry `30days`
- Token encrypted at rest (AES-256-GCM, key from env) — never returned to the client
- Board and list selected once, stored on the user record
- Card payload: `name` = commitment text (truncated 120), `desc` = owner + verbatim quote +
  share link, `due` = dueDate
- Dispatch is idempotent: `commitments.trello_card_id` set on success prevents duplicates on retry
- Partial failure reported per-item; successful cards are not rolled back

### TRD-3.8 Calendar (implements PRD-F12)
- Server-generated `.ics` (RFC 5545), one VEVENT per commitment, VALARM with user-selected offset
- Per-commitment download and per-note "all my items"
- `webcal://` subscription URL backed by the same handler so corrections propagate

### TRD-3.9 Email (implements PRD-F13)
- Resend (or Supabase SMTP). Plain, short: recipient's own items + share link button
- Send failure never blocks note creation

## 4. Non-functional requirements

| ID | Requirement | Target |
|----|-------------|--------|
| TRD-4.1 | Time from stop-recording to reviewable note | < 45s for 90s audio |
| TRD-4.2 | Mobile-first; usable one-handed at 390px width | All P0 screens |
| TRD-4.3 | No secret reaches the client bundle | Verified by build inspection |
| TRD-4.4 | Every external call has timeout + typed failure path | 100% |
| TRD-4.5 | Total API spend across the build | ≤ $20 |
| TRD-4.6 | Audio deleted after successful transcription | Within same request |

## 5. Security requirements

| ID | Requirement |
|----|-------------|
| TRD-5.1 | Supabase Auth for creator accounts; RLS enabled on every table |
| TRD-5.2 | Trello tokens encrypted at rest; user-revocable; never client-exposed |
| TRD-5.3 | Share tokens signed, scoped to one note, expiring, revocable |
| TRD-5.4 | All Route Handler input validated with Zod before use |
| TRD-5.5 | Audio never retained beyond transcription; transcripts owned by creator |
| TRD-5.6 | No third-party real conversation in fixtures, tests, repo, or demo |

## 6. Testing strategy

- **Unit:** extraction schema validation, date resolution against a fixture table of
  relative expressions, .ics output shape, share-token signing
- **Integration:** full pipeline against 3 recorded fixture conversations (self-recorded,
  one quiet / one noisy / one with a deliberately ambiguous date)
- **Manual E2E checklist:** run before each end-of-week checkpoint and twice on freeze day
- **Failure drills:** provider 429, malformed model JSON, Trello 401, network loss mid-upload —
  each must show a comprehensible message, never a blank screen

## 7. Environment

```
DATABASE_URL / SUPABASE_URL / SUPABASE_SERVICE_KEY / SUPABASE_ANON_KEY
GROQ_API_KEY
OPENROUTER_API_KEY
LLM_CHAIN_TRANSCRIBE=groq,openrouter
LLM_CHAIN_EXTRACT=openrouter,groq
TRELLO_API_KEY
ENCRYPTION_KEY          # 32-byte, for Trello token at rest
SHARE_TOKEN_SECRET      # HMAC signing
RESEND_API_KEY
APP_URL
```
