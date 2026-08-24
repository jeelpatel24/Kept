// Turns validated model output into persisted-shape items: server-side date resolution + provenance enforcement.
// Pure (testable). Implements: TRD-3.3, PRD-F6.
import { resolveRelativeDate } from "@/lib/extract/dates";
import type { ExtractionOutput, ResolvedItem } from "@/lib/extract/schema";

export interface ResolveContext {
  recordedAt: string;
  timezone: string;
  /** Valid segment seq numbers; items citing unknown segments are rejected. */
  validSegmentSeqs: Set<number>;
}

export interface ResolveResult {
  items: ResolvedItem[];
  rejected: { reason: string; text: string }[];
}

export function resolveItems(output: ExtractionOutput, ctx: ResolveContext): ResolveResult {
  const labels = new Set(output.participants.map((p) => p.label));
  const items: ResolvedItem[] = [];
  const rejected: ResolveResult["rejected"] = [];

  for (const it of output.items) {
    const seqs = Array.from(new Set(it.sourceSegmentIds)).filter((s) => ctx.validSegmentSeqs.has(s)).sort((a, b) => a - b);
    if (seqs.length === 0) {
      rejected.push({ reason: "no valid provenance segments", text: it.text });
      continue; // spec principle 4: no provenance, no item
    }

    // Owner must be one of the declared participants; otherwise unknown (null), never coerced.
    const ownerLabel = it.ownerLabel && labels.has(it.ownerLabel) ? it.ownerLabel : null;

    let dueDate: string | null = null;
    let dueConfidence: "high" | "low" | null = null;
    if (it.type === "commitment" && it.dueText) {
      const resolved = resolveRelativeDate(it.dueText, ctx.recordedAt, ctx.timezone);
      if (resolved) {
        dueDate = resolved.date;
        // Disagreement with the model's own reading is a signal of ambiguity → surface it.
        dueConfidence = it.dueDate && it.dueDate !== resolved.date ? "low" : resolved.confidence;
      } else if (it.dueDate) {
        // Only the model could anchor it (e.g. "the Tuesday after the long weekend"). Keep, but demand confirmation.
        dueDate = it.dueDate;
        dueConfidence = "low";
      }
      // else: time was mentioned but nothing anchorable → null, UI asks (never a default)
    }

    items.push({
      type: it.type,
      text: it.text,
      ownerLabel: it.type === "commitment" ? ownerLabel : null,
      dueDate,
      dueConfidence,
      sourceSegmentIds: seqs,
      sourceQuote: it.sourceQuote,
    });
  }
  return { items, rejected };
}
