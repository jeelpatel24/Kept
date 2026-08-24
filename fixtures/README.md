# Fixtures

Plan Stage 2: record **three self-recorded** conversations and keep them here for the rest of the build:

- `quiet.webm` — indoors, two clear voices, 3–4 commitments with concrete dates
- `noisy-site.webm` — outdoors / machinery, same script
- `ambiguous-dates.webm` — "end of next week", "Thursday" said on a Thursday, "before the painter comes"

Audio files are git-ignored (`*.webm`) — never commit recorded audio (CLAUDE.md §7). Only synthetic or self-recorded
audio, never a real third party's conversation (TRD-5.6). Once transcribed, results are cached by content hash so
re-running a fixture never re-bills.

Suggested script (two speakers, ~75 s): see `script.md`.
