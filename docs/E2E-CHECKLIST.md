# Manual E2E checklist

Per TRD §6 and Implementation Plan Stage 8. Run on a **real phone at 390px width**, against the deployed app.
Tick every box or the run is NOT DONE.

## A. Solo loop (spine)

- [ ] **S1** Home loads; single record button; recent list empty state reads "No conversations yet…"
- [ ] Tap Record → consent modal appears (first time this browser session); "Not now" closes it; "They're okay" continues
- [ ] Mic permission prompt appears; granting lands on **S2** in full-bleed red, timer running, level meter moves when you talk, tab title shows "● Recording"
- [ ] Talk 60–90 s (two voices, at least 3 commitments with "by Thursday" / "end of next week" / one vague "before the painter comes")
- [ ] Tap STOP → "Saving…" → **S3** Processing with staged progress; transcript appears after "Transcribing"; then redirects to **S4**
- [ ] Time from STOP to S4 < 45 s (TRD-4.1)
- [ ] **S4** Commitments first; each row has owner chip, due chip, quote line
- [ ] ≥80% of spoken commitments captured with the right owner
- [ ] The vague one has **no date** ("Add date"), not an invented one
- [ ] At least one amber "confirm?" chip; **Confirm** is disabled with the reason "N dates need your confirmation"
- [ ] Tap amber chip → "Yes, that's right" → chip turns normal → Confirm enables
- [ ] Tap an owner "Who?" chip → pick a person → chip updates
- [ ] Tap a quote → transcript accordion opens and scrolls to the highlighted segment
- [ ] Change a speaker label in the transcript → persists on reload
- [ ] Confirm → **S5** Note

## B. Share (second device)

- [ ] S5 → Share → link shown, Copy works
- [ ] Open link on a **second physical device**, no login → **S6** with "Your items" at top
- [ ] "Something wrong?" on an item → submit a date correction with a name → "Suggestion sent ✓"
- [ ] Back on S5 (reload) → amber badge "1 suggested correction" → Accept → item's date updates
- [ ] Email the link (if Resend configured) → email arrives with the recipient's own items and a working button

## C. Trello

- [ ] **S7** Connect Trello → Trello authorize page → Allow → back on S7 "Connected", expiry date shown
- [ ] Pick board + list → Save
- [ ] S5 → Send to Trello → "N cards created"; each row shows "Trello card ↗"
- [ ] Open the board: cards exist, due date correct (17:00 local), description has owner + verbatim quote + link
- [ ] Click the note link on a card → opens the shared note; provenance segment highlighted
- [ ] Send to Trello again → nothing duplicated ("Every commitment already has a card.")
- [ ] S7 Disconnect & revoke → S5 says "Connect Trello to send cards"

## D. Calendar

- [ ] S5 → Calendar → "My items (.ics)" downloads; opens in phone calendar with a reminder at the chosen offset
- [ ] Subscribe (webcal) → URL shown → subscribing in a calendar app shows the events
- [ ] Change a due date on S5 → refresh the subscription → event moved

## E. Failure drills (TRD §6)

- [ ] **Provider 429**: set `LLM_CHAIN_EXTRACT=groq` with an invalid `GROQ_API_KEY` → S3 shows a clear error, Retry button, transcript preserved
- [ ] **Malformed JSON**: temporarily set `OPENROUTER_EXTRACT_MODEL` to a tiny model that ignores JSON mode → repair retry → either succeeds or shows "Model output could not be validated" with transcript
- [ ] **Trello 401**: revoke the token in Trello settings, then dispatch → per-item "Trello token expired or revoked — reconnect in Settings", no crash
- [ ] **Network loss mid-upload**: airplane mode for 10 s while recording → after STOP a message names how many chunks were lost; "Continue with what was captured" works
- [ ] **Expired share link**: hand-edit `exp` in a token → "This link has expired." page (no stack trace)
- [ ] **Unconfirmed dispatch**: call `POST /api/trello/dispatch` for a draft note → 409

## F. Security & a11y

- [ ] `npm run build && npm run check:secrets` passes
- [ ] View page source on S6 as guest: no Trello ids, no tokens, no service key
- [ ] Every amber state has an icon + text, not colour only
- [ ] Screen reader announces "Recording started." / "Recording stopped."
- [ ] All chips/buttons ≥ 48px and reachable by keyboard on desktop
