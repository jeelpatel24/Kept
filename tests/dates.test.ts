// Fixture table of relative time expressions (Plan Stage 3, TRD §6).
// Anchor: Monday 2026-08-24 14:30 America/Toronto (18:30Z). Late-evening UTC crossing is tested separately.
import { describe, expect, it } from "vitest";
import { localDateParts, localTimeToUtc, resolveRelativeDate } from "@/lib/extract/dates";

const TZ = "America/Toronto";
const ANCHOR = "2026-08-24T18:30:00.000Z"; // Monday local

const cases: { expr: string; date: string | null; confidence?: "high" | "low" }[] = [
  { expr: "today", date: "2026-08-24", confidence: "high" },
  { expr: "tomorrow", date: "2026-08-25", confidence: "high" },
  { expr: "by tomorrow morning", date: "2026-08-25", confidence: "high" },
  { expr: "day after tomorrow", date: "2026-08-26", confidence: "high" },
  { expr: "Thursday", date: "2026-08-27", confidence: "high" },
  { expr: "by Thursday", date: "2026-08-27", confidence: "high" },
  { expr: "before Thursday", date: "2026-08-27", confidence: "high" },
  { expr: "this Friday", date: "2026-08-28", confidence: "high" },
  { expr: "Monday", date: "2026-08-31", confidence: "low" }, // said on a Monday
  { expr: "next Monday", date: "2026-08-31", confidence: "low" },
  { expr: "next Thursday", date: "2026-09-03", confidence: "low" },
  { expr: "end of the week", date: "2026-08-28", confidence: "high" },
  { expr: "end of next week", date: "2026-09-04", confidence: "high" },
  { expr: "end of the next week", date: "2026-09-04", confidence: "high" },
  { expr: "by the end of next week", date: "2026-09-04", confidence: "high" },
  { expr: "next week", date: "2026-08-31", confidence: "low" },
  { expr: "early next week", date: "2026-08-31", confidence: "low" },
  { expr: "in three days", date: "2026-08-27", confidence: "high" },
  { expr: "in 2 weeks", date: "2026-09-07", confidence: "high" },
  { expr: "a couple of weeks", date: "2026-09-07", confidence: "high" },
  { expr: "within 10 days", date: "2026-09-03", confidence: "low" },
  { expr: "end of the month", date: "2026-08-31", confidence: "high" },
  { expr: "next month", date: "2026-09-01", confidence: "low" },
  { expr: "the 15th", date: "2026-09-15", confidence: "high" }, // 15th already passed → next month
  { expr: "by the 28th", date: "2026-08-28", confidence: "high" },
  { expr: "September 12", date: "2026-09-12", confidence: "high" },
  { expr: "Sept 12th", date: "2026-09-12", confidence: "high" },
  { expr: "3rd of March", date: "2027-03-03", confidence: "high" }, // passed this year → next year
  { expr: "March 3 2027", date: "2027-03-03", confidence: "high" },
  { expr: "2026-09-10", date: "2026-09-10", confidence: "high" },
  { expr: "this weekend", date: "2026-08-29", confidence: "low" },
  { expr: "Thursday afternoon", date: "2026-08-27", confidence: "high" },
  { expr: "first thing Wednesday", date: "2026-08-26", confidence: "high" },
  { expr: "before the painter comes", date: null },
  { expr: "soon", date: null },
  { expr: "ASAP", date: null },
  { expr: "when I get a chance", date: null },
  { expr: "", date: null },
];

describe("resolveRelativeDate", () => {
  for (const c of cases) {
    it(`"${c.expr}" → ${c.date ?? "null"}${c.confidence ? ` (${c.confidence})` : ""}`, () => {
      const r = resolveRelativeDate(c.expr, ANCHOR, TZ);
      if (c.date === null) {
        expect(r).toBeNull();
      } else {
        expect(r?.date).toBe(c.date);
        if (c.confidence) expect(r?.confidence).toBe(c.confidence);
      }
    });
  }

  it("anchors to the LOCAL date, not UTC (late evening Toronto is next day UTC)", () => {
    // 2026-08-24 23:30 Toronto = 2026-08-25 03:30Z
    const r = resolveRelativeDate("tomorrow", "2026-08-25T03:30:00.000Z", TZ);
    expect(r?.date).toBe("2026-08-25");
    const lp = localDateParts(new Date("2026-08-25T03:30:00.000Z"), TZ);
    expect(lp.d).toBe(24);
    expect(lp.wd).toBe(1);
  });

  it("never returns a default for null/undefined", () => {
    expect(resolveRelativeDate(null, ANCHOR, TZ)).toBeNull();
    expect(resolveRelativeDate(undefined, ANCHOR, TZ)).toBeNull();
  });

  it("returns null for invalid anchor", () => {
    expect(resolveRelativeDate("tomorrow", "not-a-date", TZ)).toBeNull();
  });
});

describe("localTimeToUtc", () => {
  it("converts 17:00 Toronto (EDT, UTC-4) to 21:00Z", () => {
    expect(localTimeToUtc("2026-08-27", 17, 0, "America/Toronto").toISOString()).toBe("2026-08-27T21:00:00.000Z");
  });
  it("converts 17:00 Toronto (EST, UTC-5) to 22:00Z", () => {
    expect(localTimeToUtc("2026-12-15", 17, 0, "America/Toronto").toISOString()).toBe("2026-12-15T22:00:00.000Z");
  });
  it("handles UTC and eastern-hemisphere zones", () => {
    expect(localTimeToUtc("2026-08-27", 9, 30, "UTC").toISOString()).toBe("2026-08-27T09:30:00.000Z");
    expect(localTimeToUtc("2026-08-27", 9, 0, "Asia/Kolkata").toISOString()).toBe("2026-08-27T03:30:00.000Z");
  });
});
