// Prompt for the transcription FALLBACK path (Gemini native audio via OpenRouter).
// Implements: TRD-3.2. Versioned constant per CLAUDE.md §4.
export const TRANSCRIBE_PROMPT_VERSION = "transcribe.v1";

export const TRANSCRIBE_FALLBACK_PROMPT = `Transcribe this English audio of a conversation between two people.
Return ONLY a JSON object of the shape:
{"segments":[{"start":<seconds number>,"end":<seconds number>,"text":"<verbatim sentence>"}]}
Rules:
- One segment per spoken sentence or natural pause, in order.
- start/end are seconds from the beginning of the audio, best estimate.
- Transcribe verbatim. Do not summarise, translate, or add speaker names.
- If the audio is silent or unintelligible, return {"segments":[]}.`;
