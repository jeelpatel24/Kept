# Kept — Product Requirements Document

**Version:** 1.0 · **Date:** 2026-08-23 · **Owner:** Jeel Patel
**Governed by:** `spec.md` (canonical)
**Event:** AI Builders Hackathon 2026 · Submission deadline 2026-09-15 23:00 EDT

---

## 1. Problem statement

Two people agree to things out loud and then lose them. Commitments made in a site
walk, a client call, or a vendor conversation exist only in memory until someone
manually turns them into a task — and usually nobody does.

The failure is not note-taking. It is the three-step gap between **spoken agreement →
shared record → tracked task**. Existing tools solve at most one step, for one person.

Consequences observed in construction coordination specifically: rework, missed
inspection windows, disputes over what was agreed, and trades arriving to find
prerequisite work undone.

## 2. Goals

| # | Goal | Measure |
|---|------|---------|
| G1 | Capture commitments without anyone typing during the conversation | Zero typing required until review |
| G2 | Produce a record both parties accept | Second party can open and correct without an account |
| G3 | Close the loop into real task tracking | Commitment → Trello card with due date, one action |
| G4 | Never create work from a hallucination | 100% of dispatched items human-confirmed |

## 3. Non-goals

Per `spec.md` §6 OUT. Notably: not a transcription product, not a meeting assistant,
not a general note app, not a team collaboration platform.

## 4. Users

**Primary — Site Coordinator / Contractor ("Ravi")**
On site, phone in hand, gloves off for thirty seconds. Has four conversations before
lunch and remembers two of them by evening. Will not open a laptop. Judges the tool
in the first ten seconds.

**Secondary — The Other Party ("Dana")**
Receives a link. Has no account, no intention of getting one. Must be able to read
the note and flag an error in under thirty seconds or she ignores it.

## 5. User stories

- **US1** As Ravi, I can start recording a conversation from my phone in one tap so I don't
  have to take notes while talking.
- **US2** As Ravi, I can see clearly that recording is active so I never record without knowing.
- **US3** As Ravi, after stopping I get a structured note listing decisions, commitments, and
  open questions, so I don't reconstruct the conversation from memory.
- **US4** As Ravi, I can correct who said what and fix any date the system was unsure about,
  so the record is accurate before anyone sees it.
- **US5** As Ravi, I can share one link with the other party so we both hold the same record.
- **US6** As Dana, I can open that link with no login and see the note and my own commitments.
- **US7** As Dana, I can suggest a correction so the record reflects what I actually said.
- **US8** As Ravi, I can push confirmed commitments to a Trello board as cards with due dates.
- **US9** As Ravi, I can open a Trello card later and click through to the exact moment the
  commitment was made.
- **US10** As Ravi, I can add my commitments to my calendar with a reminder.

## 6. Functional requirements

| ID | Requirement | Priority | Story |
|----|-------------|----------|-------|
| PRD-F1 | Browser audio recording, start/stop, visible active-state indicator, up to 20 min | P0 | US1, US2 |
| PRD-F2 | Audio uploaded and transcribed to text with timestamped segments | P0 | US3 |
| PRD-F3 | Consent prompt shown on first record; recording indicator persistent | P0 | US2 |
| PRD-F4 | Extraction of decisions, commitments (owner + due date), and open questions, each with a transcript provenance span | P0 | US3 |
| PRD-F5 | Speaker labels inferred from context, editable by the user | P0 | US4 |
| PRD-F6 | Relative time expressions resolved to dates using recording date as context; low-confidence results flagged for confirmation | P0 | US4 |
| PRD-F7 | Review screen; no downstream action possible until the user confirms | P0 | US4, G4 |
| PRD-F8 | Shared note accessible via signed link, no authentication required for guest | P0 | US5, US6 |
| PRD-F9 | Guest can submit a correction suggestion; creator sees and accepts/rejects | P1 | US7 |
| PRD-F10 | Trello OAuth-style token connect; user selects target board and list once | P0 | US8 |
| PRD-F11 | Confirmed commitments create Trello cards: name, description with quote + owner, due date, back-link to note | P0 | US8, US9 |
| PRD-F12 | .ics generation per commitment and per user, with VALARM reminder; reminder offset selectable | P1 | US10 |
| PRD-F13 | Email delivery of the share link with the recipient's own items summarised | P1 | US5 |
| PRD-F14 | Commitment status (open / done) toggleable on the shared note | P2 | G3 |
| PRD-F15 | Raw transcript always viewable, even if extraction fails | P0 | Principle 5 |

P0 = demo cannot happen without it. P1 = build if P0 is complete. P2 = only if time remains.

## 7. Assumptions

- The user is a party to the conversation being recorded (not third-party surveillance).
- Conversations are in English, two primary voices, ambient site noise possible.
- The other party has a phone and can open a link.
- Recording legality is the user's responsibility; the product surfaces consent affordances
  and does not provide legal advice.

## 8. Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Transcription accuracy in noisy environments | High | Test on real site audio early (Day 3). Show transcript so user can see and correct. |
| No speaker diarization → wrong attribution | High | Context-inferred labels, always editable, single-tap correction. Framed as a feature in review UX. |
| Date parsing wrong → wrong due date in Trello | High | Confidence flagging + mandatory confirmation for low-confidence dates (PRD-F6, F7). |
| Provider rate limit during live demo | Critical | Fallback chain; demo video recorded against cached results; live demo has a pre-warmed path. |
| Scope creep consumes polish time | Critical | Feature freeze 2026-09-08. OUT list is binding. |

## 9. Out of scope

See `spec.md` §6. Roadmap slide only.

## 10. Success metrics (hackathon)

Per `spec.md` §8. Judged against: Technical Implementation 25%, Problem Solving & Impact 25%,
Innovation 20%, UX & Design 15%, Presentation 15%.
