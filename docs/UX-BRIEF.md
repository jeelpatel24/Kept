# Kept — Site Flow & UI/UX Design Brief

**Version:** 1.0 · **Date:** 2026-08-23
**Implements:** `PRD.md`, `TRD.md` · **Governed by:** `spec.md`

---

## 1. Design principles

1. **One-handed, gloves-off, thirty seconds.** The primary user is standing on a site
   holding a phone. Mobile-first is not a nicety; the desktop view is the afterthought.
2. **The record button is the product.** Home screen has one obvious action.
3. **Uncertainty is visible, not hidden.** Anything the model was unsure about looks
   different and asks for a tap. This is a trust feature, not an apology.
4. **The guest is not a user.** Dana has thirty seconds, no account, and no patience.
   Her screen is read-first with one optional action.
5. **Honest empty states.** No fake rows, no skeleton content that implies data.
   If nothing was extracted, say so and show the transcript.

## 2. Visual direction

Utility over decoration — this is a tool used in bad light with dirty hands.

- **Type:** one strong sans (Inter or system stack). Large base size (17px mobile) —
  it will be read in sunlight.
- **Palette:** near-black text on off-white. One accent for action. Amber reserved
  exclusively for "needs your confirmation." Never use amber decoratively.
- **Density:** generous. Tap targets ≥ 48px. Real whitespace between commitment rows.
- **Motion:** minimal. The only animated element is the recording indicator.

## 3. Screen inventory

| # | Screen | Route | Requirements |
|---|--------|-------|--------------|
| S1 | Home / Record | `/` | PRD-F1, F3 |
| S2 | Recording active | `/record/[sessionId]` | PRD-F1, F2, F3 |
| S3 | Processing | `/record/[sessionId]/processing` | PRD-F2, F4 |
| S4 | Review & Confirm | `/notes/[id]/review` | PRD-F4, F5, F6, F7, F15 |
| S5 | Note (creator view) | `/notes/[id]` | PRD-F8, F9, F11, F12, F14 |
| S6 | Shared note (guest) | `/s/[token]` | PRD-F8, F9 |
| S7 | Trello connect & board pick | `/settings/trello` | PRD-F10 |
| S8 | Note list | `/notes` | — |

## 4. Flow

```
S1 Home
 └─[Record]→ consent (first time) → S2 Recording
      └─[Stop]→ S3 Processing
           ├─ success → S4 Review
           └─ transcription failed → S4 with transcript only + retry
S4 Review
 └─[Confirm]→ S5 Note
      ├─[Share]→ link + email → S6 opens on other device
      ├─[Send to Trello]→ cards created, per-item status shown
      └─[Add to calendar]→ .ics download / webcal
S6 Guest
 └─[Suggest correction]→ pending → creator sees badge on S5
```

## 5. Screen specifications

### S1 — Home
- Single large record button, centred, thumb-reachable
- Below: recent notes, three most recent, each showing title + open commitment count
- No nav bar. No hamburger. Nothing else competes.
- Empty state: "No conversations yet. Hit record during your next one."

### S2 — Recording active
- Full-bleed recording state — impossible to mistake for idle
- Elapsed timer, large
- Animated level meter (real audio input, not decorative)
- Warning banner at 18 min, hard stop at 20
- Single STOP button
- Consent copy shown once before first record: a suggested line the user can say out loud.
  Framed as a prompt, explicitly not legal advice.

### S3 — Processing
- Honest staged progress: "Transcribing…" → "Finding commitments…"
- Show the transcript streaming in as it becomes available — do not make the user
  stare at a spinner for 40 seconds
- On failure: clear message, retry button, transcript preserved if it exists

### S4 — Review & Confirm  ← **the most important screen**
Three grouped sections, in this order:

1. **Commitments** (the hero) — each row shows:
   - the commitment text
   - owner chip: tappable, shows inferred label, amber if unknown
   - due date chip: normal if high-confidence, **amber with a small "confirm?" affordance**
     if low-confidence, "add date" if null
   - a quote line: the verbatim sentence it came from, muted, tappable to jump to transcript
2. **Decisions** — text + provenance, no owner/date
3. **Open questions** — things nobody answered

Below: **Transcript** in a collapsed accordion, always available (PRD-F15).

The **Confirm** button is disabled while any low-confidence date is untouched, with an
inline reason: "2 dates need your confirmation." Do not hide the button — explain it.

### S5 — Note (creator)
- Title, date, participants
- Commitment ledger with status toggles (open/done)
- Action row: Share · Send to Trello · Add to calendar
- After Trello dispatch: each commitment row shows a small card link. Failures shown
  per-item with retry, successes untouched.
- Pending guest corrections appear as a badge at the top with accept/reject

### S6 — Shared note (guest)
- Opens with **"Your items"** first — Dana's own commitments above everything else
- Then the full note, read-only
- One subtle action: "Something wrong?" → inline correction with an optional name field
- No signup prompt. No app download banner. Nothing that makes her bounce.

### S7 — Trello connect
- One button → Trello authorize → return
- Board picker, then list picker. Saved as default.
- Visible "Disconnect" that actually revokes. Show token expiry date.

## 6. Key states to design (do not skip)

| State | Why it matters |
|-------|----------------|
| Low-confidence date | The trust mechanism. Amber, tappable, blocks confirm. |
| Unknown owner | Model refused to guess — show as "Who?" chip, not blank. |
| Zero commitments extracted | Honest: "No commitments found. Here's the transcript." |
| Transcription failed | Retry + preserved audio state, never a dead end. |
| Trello partial failure | 3 of 4 cards created — show exactly which failed. |
| Provider rate-limited | "Busy, retrying with backup…" — not a generic error. |

## 7. Accessibility

- Contrast ≥ 4.5:1 for all text; amber state must also carry an icon and label,
  never colour alone
- Every interactive element keyboard reachable and labelled
- Recording state announced to screen readers on change
- Transcript is real selectable text, not an image or canvas

## 8. Demo-critical polish

These three moments are what judges see. Budget real time for them:

1. The **stop → note appears** transition (S3→S4)
2. The **amber confirm** interaction on S4 — this is the "we don't hallucinate" story, visually
3. The **second device opening the share link** (S6) with "Your items" at the top
