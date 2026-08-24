// Zod schema for model extraction output. Model output is never trusted directly (docs/ENGINEERING.md §4).
// Implements: TRD-3.3 item schema + speaker inference (PRD-F5) + title/summary (SCHEMA notes.title/summary).
import { z } from "zod";

export const extractedItemSchema = z.object({
  type: z.enum(["decision", "commitment", "open_question"]),
  text: z.string().trim().min(1).max(1000),
  /** Participant label exactly as listed in `participants`, or null when unknown — never guessed. */
  ownerLabel: z.string().trim().min(1).max(80).nullable(),
  /** Verbatim time expression from the transcript, e.g. "by Thursday", or null if none was said. */
  dueText: z.string().trim().min(1).max(120).nullable(),
  /** Model's own ISO resolution of dueText. Used only as a low-confidence fallback. */
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  /** Provenance — required, non-empty (spec principle 4). */
  sourceSegmentIds: z.array(z.number().int().min(0)).min(1).max(20),
  sourceQuote: z.string().trim().min(1).max(1500),
});

export const extractionOutputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(600).nullable(),
  participants: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        isCreator: z.boolean(),
      }),
    )
    .min(1)
    .max(4),
  /** Inferred speaker per segment. Segments not listed stay unlabelled. */
  speakerBySegment: z.array(z.object({ seq: z.number().int().min(0), speaker: z.string().trim().min(1).max(80) })).max(2000),
  items: z.array(extractedItemSchema).max(100),
});

export type ExtractedItem = z.infer<typeof extractedItemSchema>;
export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;

/** The shape actually persisted after server-side date resolution (TRD-3.3 schema). */
export interface ResolvedItem {
  type: ExtractedItem["type"];
  text: string;
  ownerLabel: string | null;
  dueDate: string | null;
  dueConfidence: "high" | "low" | null;
  sourceSegmentIds: number[];
  sourceQuote: string;
}

export function parseExtractionJson(raw: string): { ok: true; data: ExtractionOutput } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: `not valid JSON: ${(e as Error).message}` };
  }
  const result = extractionOutputSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    return { ok: false, error: `schema violation: ${issues.join("; ")}` };
  }
  return { ok: true, data: result.data };
}
