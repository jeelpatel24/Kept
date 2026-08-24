# Kept — Product Spec (Canonical)

**Version:** 1.0 · **Date:** 2026-08-23 · **Author:** Jeel Patel
**Status:** Locked for hackathon build. Changes require updating this file first.

> This file is the single source of truth. If any other document, prompt, or
> code contradicts it, this file wins. PRD/TRD expand it; they do not override it.

---

## 1. One-line

Kept records a real conversation between two people and turns it into a shared,
correctable note where every commitment becomes a tracked task — pushed to Trello
and added to the calendar with reminders.

## 2. The problem

Commitments die in conversation. On a job site, a client call, or a vendor meeting,
both people agree to things out loud — "I'll send the quote Thursday", "we'll patch
204 before the painter comes" — and then:

- nobody writes it down, or
- one person writes their own version, in their own notes, that the other never sees, or
- it gets written down and never turns into a task anyone tracks.

Existing meeting-notes tools produce a **summary for one person**. A summary is not
an agreement, and it is not a task. The gap is between "we said it" and "it is now
on someone's board with a due date."

## 3. What Kept does (the spine)

1. **Record** — user hits record during a two-party conversation (in person or on a call).
2. **Transcribe** — audio → text.
3. **Extract** — model pulls out: decisions, commitments (who owes what by when), and open questions.
4. **Confirm** — user reviews. Speaker labels and low-confidence dates are editable. Nothing is
   written anywhere until the human confirms.
5. **Share** — a signed link produces one shared note both parties can see. The other party can
   suggest corrections without creating an account.
6. **Dispatch** — confirmed commitments become Trello cards (primary) and calendar events with
   reminders (secondary). Each Trello card links back to the note.

## 4. The differentiator

**The commitment ledger.** Kept does not output "here is a summary." It outputs
"here is what each person owes, by when, and whether it happened."

Two properties no comparable tool has:

- **Shared truth.** Both parties see the same note. Either can correct it. It is a record,
  not one person's version.
- **Provenance.** Every Trello card links back to the exact moment in the transcript where the
  commitment was made. Open a card three weeks later, click through, read the line that created it.

## 5. Target user (v1)

Primary: **site coordinators, trades, and small contractors** who have most of their
important conversations standing up, on site, with no laptop.

Secondary (roadmap, not built): client-facing consultants, agency account managers,
freelancers doing scoping calls.

v1 is deliberately built for one user type. Generic = invisible.

## 6. Hard scope boundaries

### IN
- Two-party conversation, single recording session, up to 20 minutes
- Browser-based recording (mobile web, no native app)
- English only
- Inferred speaker labels, human-editable
- Shared note via signed link, guest view + suggest-correction
- Trello card creation
- .ics calendar events with reminders
- Email delivery of the link

### OUT — explicitly not built, do not add
- Real-time / live streaming transcription
- True speaker diarization
- Meetings with 3+ distinct participants as a first-class feature
- Google/Outlook Calendar OAuth two-way sync
- Scheduling or availability checking
- CRM, Slack, Jira, Asana, Notion integrations
- Mobile native app
- Team accounts, org management, roles beyond creator/guest
- Billing or payment
- Multi-language

Anything in the OUT list goes on the roadmap slide, not in the repo.

## 7. Non-negotiable principles

1. **Nothing writes without human confirmation.** No card, event, or email is created from
   model output alone. The model proposes; the human confirms.
2. **No invented facts.** If a date, owner, or commitment is not supported by the transcript,
   it is not extracted. Uncertainty is surfaced, not hidden.
3. **Consent is visible.** Recording state is always obvious. The other party can see the note.
4. **Provenance always.** Every extracted item carries the transcript span it came from.
5. **Degrade honestly.** If transcription or extraction fails, the user still gets the raw
   transcript. Never a blank screen.

## 8. Success criteria (demo-day definition of working)

- A 60–90 second live conversation produces a correct note in under 45 seconds
- ≥80% of commitments in that conversation are captured with the right owner
- Shared link opens on a second device with no login
- Trello cards appear on a visible board with correct due dates and a working note link
- The whole flow can be performed live on stage without a fallback

## 9. Stack

Next.js 15 (App Router, TypeScript) · Postgres (Supabase) · Vercel · Groq Whisper large-v3
(transcription) · Gemini Flash via OpenRouter (extraction, with Groq fallback) · Trello REST API ·
`ics` generation server-side · Resend or Supabase SMTP for email.

Single Next.js application with Route Handlers as the API. No separate backend service —
justified in TRD §2.
