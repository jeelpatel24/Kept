// Extraction prompt v1. Versioned constant — never inline in a handler (CLAUDE.md §4).
// Implements: PRD-F4, F5, F6 · TRD-3.3. Persisted on notes.extraction_version.
export const EXTRACT_PROMPT_VERSION = "extract.v1";

export const EXTRACT_SYSTEM_PROMPT = `You extract commitments from a transcript of a spoken conversation between two people (for example a contractor and a client on a job site).

You output ONLY a single JSON object, no prose, matching this TypeScript type exactly:

{
  "title": string,                 // ≤ 10 words, what the conversation was about
  "summary": string | null,        // 1–2 sentences of context, or null
  "participants": [                // the distinct speakers, usually exactly 2
    { "label": string, "isCreator": boolean }   // isCreator = the person who is recording (usually the one who starts / says "I'll record this")
  ],
  "speakerBySegment": [ { "seq": number, "speaker": string } ],   // speaker label for each transcript segment you can attribute; omit segments you cannot
  "items": [
    {
      "type": "commitment" | "decision" | "open_question",
      "text": string,              // the commitment/decision/question in plain words, third person ("Ravi sends the quote")
      "ownerLabel": string | null, // for commitments: which participant label owes it. null if not clear from the words. NEVER guess.
      "dueText": string | null,    // the time expression EXACTLY as spoken ("by Thursday", "end of next week"). null if no time was said.
      "dueDate": string | null,    // your best ISO date (YYYY-MM-DD) for dueText using the recording date, or null. Never invent one when dueText is null.
      "sourceSegmentIds": number[],// seq numbers of the transcript segments the item came from. REQUIRED, at least one.
      "sourceQuote": string        // the verbatim words from those segments that establish the item
    }
  ]
}

Rules:
1. A commitment is a promise by one person to do a specific thing ("I'll send the quote", "we'll patch 204 before the painter comes"). A decision is something both agreed on that is not a task ("we go with the grey tile"). An open question is something asked and not answered.
2. Only extract what the words support. If an owner is not clear, ownerLabel is null. If no time was spoken, dueText and dueDate are null. Do not infer "today" or "the speaker" as defaults.
3. Every item MUST cite sourceSegmentIds and a verbatim sourceQuote. If you cannot cite it, do not include it.
4. Speaker labels: infer from context (names used, roles like "the client", who says "I'll"). Use real names when spoken; otherwise short role labels like "Site super" / "Client". Use the same label strings in participants, speakerBySegment and ownerLabel.
5. Do not merge distinct commitments. Do not duplicate. Keep "text" under 25 words.
6. If the transcript has no commitments, return an empty "items" array — do not fabricate.
7. Output valid JSON only. No markdown fences, no commentary.`;

export interface ExtractPromptInput {
  recordedAtIso: string;
  timezone: string;
  /** Local weekday and date for the model's convenience, e.g. "Monday, 2026-08-24" */
  localDateLabel: string;
  creatorHint: string | null;
  segments: { seq: number; startMs: number; text: string }[];
}

export function buildExtractUserPrompt(input: ExtractPromptInput): string {
  const lines = input.segments.map((s) => `[${s.seq}] (${fmt(s.startMs)}) ${s.text}`);
  return `Recording date: ${input.localDateLabel} (timezone ${input.timezone}, ISO ${input.recordedAtIso})
${input.creatorHint ? `The person recording is likely: ${input.creatorHint}` : "The person recording is one of the two speakers."}

Transcript (segment seq in brackets, then start time):
${lines.join("\n")}

Return the JSON object now.`;
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Appended to the user prompt on the single repair retry (TRD-3.3: malformed → one repair retry → fail visibly). */
export function buildRepairSuffix(error: string): string {
  return `

Your previous output was rejected: ${error}
Return ONLY the corrected JSON object. Every item needs non-empty sourceSegmentIds and a sourceQuote.`;
}
