# For judges — evaluate Kept in 3 minutes, no account, no microphone

**Live app:** https://kept-omega-liart.vercel.app · **Repo:** https://github.com/jeelpatel24/Kept

## 1. Open a real shared note (30 s)

> **⟶ SAMPLE NOTE LINK — paste here before submitting** (a live `/s/<token>` link from a real recorded conversation)

This is what the *other* party of a conversation receives: their items first, every commitment with owner and due date, the verbatim sentence it came from, and a "Something wrong?" action to suggest a correction — no signup. This link **is** the product's core claim: one shared record instead of two conflicting memories.

## 2. Look for the three things that make Kept different (60 s)

- **Provenance.** Tap any quote — it jumps to the exact transcript moment. In the database, `commitments.source_segment_ids` has `CHECK (array_length ≥ 1)`: an item without a source physically cannot exist. (`supabase/migrations/0003…`)
- **Refusal to guess.** Items with no spoken date show *no date* — never "today". Unclear owners show "Who?" — never the recorder. Low-confidence dates render **amber** and block confirmation server-side until a human touches them (`app/api/notes/[id]/route.ts`, `untouchedLowConfidenceCount`).
- **Human gate.** Try `POST /api/trello/dispatch` for a draft note → `409 Note must be confirmed before dispatch`. Share, email and dispatch all refuse unconfirmed model output.

## 3. Skim the engineering (60 s)

- `lib/extract/dates.ts` — deterministic relative-date resolver ("end of next week" → a date, timezone-anchored). 36-case fixture table in `tests/dates.test.ts`.
- `lib/llm/router.ts` — ordered provider fallback (Groq ⇄ OpenRouter), 429 → next provider, every result cached by content hash.
- `lib/trello/crypto.ts` — AES-256-GCM for tokens at rest; `lib/share/token.ts` — HMAC-signed, expiring, revocable guest links.
- CI (`.github/workflows/ci.yml`): typecheck · lint · 71 tests · build · **client-bundle secret scan**.
- `docs/E2E-CHECKLIST.md` — the failure drills we run: provider 429, malformed JSON, Trello 401, mid-upload network loss.

## 4. Full flow (optional, 2 min, needs a mic)

Sign in at the live app (email link), tap **RECORD**, speak two sentences with a commitment and a date ("I'll send you the quote by Thursday"), stop → watch the note assemble → confirm → share/dispatch.

## Honest limitations

No diarization (labels inferred, one-tap correction) · English only · two people · 20-minute cap · `.ics`/webcal rather than calendar OAuth. Chosen deliberately — reasoning in `docs/TRD.md` §2.
