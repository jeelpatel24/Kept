# Demo video — shot list and script (target 4:30, max 5:00)

Record against **pre-warmed/cached results** (run the conversation once beforehand so transcription and extraction are cached — same audio never re-bills or varies). Shoot 3 takes. Phone screen-record for app shots; face-to-camera optional for the opening only.

## 0:00–0:40 — The problem (voice over b-roll or a single still)

> "Three weeks ago a contractor told a client: 'I'll get Marco in to patch the drywall before the painter comes.' The painter showed up on the 12th. The drywall wasn't patched. Nobody wrote it down — and the two of them now remember that conversation differently.
> Every meeting-notes tool solves the wrong problem: they write a summary, for one person. A summary is not an agreement, and it's not a task. I built Kept to close the gap between 'we said it' and 'it's on someone's board with a due date.'"

## 0:40–2:00 — Live: record a conversation (phone screen recording)

- Open the app. *"One button. Built for a phone held in one hand on a job site."*
- Tap RECORD → consent prompt → speak the fixture script with a friend (~60 s): drywall by the 10th, tile quote by Thursday, deposit end of next week, grey tile decision, one vague "before the painter comes".
- STOP → "Working through it" steps → the note appears. *"Forty seconds. Nobody typed."*

## 2:00–2:50 — The amber moment (THE anti-hallucination story — slow down here)

- Point at the ledger: owners, dates, and under each one the verbatim quote.
- Point at the amber chip: *"Kept wasn't sure about this date — so it refuses to guess. It won't let me confirm the note until I've looked at it. And this one had no date spoken at all, so it has no date — not 'today', nothing invented. Every item must cite the sentence it came from; the database literally rejects items without a source."*
- Tap the amber chip → confirm → Confirm note.

## 2:50–3:30 — Second device: the shared note

- Send the link; open it on a second physical phone on camera.
- *"This is what the other person gets. No account. Her items first. And if I got something wrong—"* tap "Something wrong?", submit a date correction → back on phone 1, accept it. *"One record, two people, correctable by both. That's the difference between a note and an agreement."*

## 3:30–4:10 — Dispatch

- Tap Send to Trello → cards appear on the real board (screen-share Trello).
- Open a card: *"Owner, due date, the exact quote — and this link goes back to the moment in the transcript it came from. Three weeks later, no arguments."*
- Show calendar: add .ics with a reminder.

## 4:10–4:45 — Architecture flash + close (one slide each, 10 s)

- Architecture slide: *"One Next.js app. Whisper on Groq, Gemini for extraction, with automatic fallback and caching. Postgres with row-level security. Every external call has a timeout and a typed failure — this demo can't hang on a rate limit."*
- Roadmap slide → end card: *"Kept. You said it. Now it's on the board."*

## Rules for the shoot

- Do not gamble on a cold API call: run the exact conversation once before recording.
- Real data only — the conversation on camera is a real (self-recorded) one.
- Show the URL bar once on each device so it's visibly live, not a mockup.
- Captions on; many judges watch muted.
