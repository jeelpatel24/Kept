// Extraction schema validation + provenance enforcement (TRD §6 unit: "extraction schema validation").
import { describe, expect, it } from "vitest";
import { resolveItems } from "@/lib/extract/resolve";
import { parseExtractionJson } from "@/lib/extract/schema";

const base = {
  title: "Site walk — unit 204",
  summary: null,
  participants: [
    { label: "Ravi", isCreator: true },
    { label: "Dana", isCreator: false },
  ],
  speakerBySegment: [{ seq: 0, speaker: "Ravi" }],
  items: [] as unknown[],
};

describe("parseExtractionJson", () => {
  it("rejects non-JSON", () => {
    const r = parseExtractionJson("```json\n{");
    expect(r.ok).toBe(false);
  });

  it("rejects an item with empty sourceSegmentIds", () => {
    const r = parseExtractionJson(
      JSON.stringify({ ...base, items: [{ type: "commitment", text: "Ravi sends quote", ownerLabel: "Ravi", dueText: null, dueDate: null, sourceSegmentIds: [], sourceQuote: "I'll send the quote" }] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/sourceSegmentIds/);
  });

  it("accepts a well-formed output", () => {
    const r = parseExtractionJson(
      JSON.stringify({ ...base, items: [{ type: "commitment", text: "Ravi sends quote", ownerLabel: "Ravi", dueText: "by Thursday", dueDate: "2026-08-27", sourceSegmentIds: [2], sourceQuote: "I'll send the quote by Thursday" }] }),
    );
    expect(r.ok).toBe(true);
  });

  it("rejects unknown item type", () => {
    const r = parseExtractionJson(JSON.stringify({ ...base, items: [{ type: "todo", text: "x", ownerLabel: null, dueText: null, dueDate: null, sourceSegmentIds: [1], sourceQuote: "x" }] }));
    expect(r.ok).toBe(false);
  });
});

describe("resolveItems", () => {
  const ctx = { recordedAt: "2026-08-24T18:30:00.000Z", timezone: "America/Toronto", validSegmentSeqs: new Set([0, 1, 2, 3]) };

  it("drops items whose provenance points at segments that do not exist", () => {
    const r = resolveItems(
      { ...base, items: [{ type: "commitment", text: "x", ownerLabel: "Ravi", dueText: null, dueDate: null, sourceSegmentIds: [99], sourceQuote: "x" }] },
      ctx,
    );
    expect(r.items).toHaveLength(0);
    expect(r.rejected).toHaveLength(1);
  });

  it("nulls an owner label that is not a declared participant (never coerces)", () => {
    const r = resolveItems(
      { ...base, items: [{ type: "commitment", text: "x", ownerLabel: "Someone", dueText: null, dueDate: null, sourceSegmentIds: [1], sourceQuote: "x" }] },
      ctx,
    );
    expect(r.items[0]?.ownerLabel).toBeNull();
  });

  it("resolves dueText server-side and marks high confidence when model agrees", () => {
    const r = resolveItems(
      { ...base, items: [{ type: "commitment", text: "x", ownerLabel: "Ravi", dueText: "by Thursday", dueDate: "2026-08-27", sourceSegmentIds: [1], sourceQuote: "x" }] },
      ctx,
    );
    expect(r.items[0]?.dueDate).toBe("2026-08-27");
    expect(r.items[0]?.dueConfidence).toBe("high");
  });

  it("marks low confidence when the model disagrees with the resolver", () => {
    const r = resolveItems(
      { ...base, items: [{ type: "commitment", text: "x", ownerLabel: "Ravi", dueText: "by Thursday", dueDate: "2026-09-03", sourceSegmentIds: [1], sourceQuote: "x" }] },
      ctx,
    );
    expect(r.items[0]?.dueDate).toBe("2026-08-27");
    expect(r.items[0]?.dueConfidence).toBe("low");
  });

  it("keeps the model date as LOW when only the model could anchor it", () => {
    const r = resolveItems(
      { ...base, items: [{ type: "commitment", text: "x", ownerLabel: "Ravi", dueText: "the Tuesday after the long weekend", dueDate: "2026-09-08", sourceSegmentIds: [1], sourceQuote: "x" }] },
      ctx,
    );
    expect(r.items[0]?.dueDate).toBe("2026-09-08");
    expect(r.items[0]?.dueConfidence).toBe("low");
  });

  it("leaves dueDate null when nothing was said, even if the model volunteered a date", () => {
    const r = resolveItems(
      { ...base, items: [{ type: "commitment", text: "x", ownerLabel: "Ravi", dueText: null, dueDate: "2026-08-25", sourceSegmentIds: [1], sourceQuote: "x" }] },
      ctx,
    );
    expect(r.items[0]?.dueDate).toBeNull();
    expect(r.items[0]?.dueConfidence).toBeNull();
  });

  it("decisions and open questions carry no owner or date", () => {
    const r = resolveItems(
      { ...base, items: [{ type: "decision", text: "grey tile", ownerLabel: "Ravi", dueText: "Thursday", dueDate: null, sourceSegmentIds: [1], sourceQuote: "x" }] },
      ctx,
    );
    expect(r.items[0]?.ownerLabel).toBeNull();
    expect(r.items[0]?.dueDate).toBeNull();
  });
});
