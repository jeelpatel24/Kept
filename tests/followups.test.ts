// Follow-up bucketing (PRD-F16/F17) — deterministic, timezone-aware, tested like date resolution.
import { describe, expect, it } from "vitest";
import { bucketFor, daysUntil } from "@/lib/followups/bucket";

const TZ = "America/Toronto";
const NOW = "2026-08-27T18:30:00.000Z"; // Thursday Aug 27, 14:30 local

describe("bucketFor", () => {
  it("buckets relative to the LOCAL calendar day", () => {
    expect(bucketFor("2026-08-26", NOW, TZ)).toBe("overdue");
    expect(bucketFor("2026-08-27", NOW, TZ)).toBe("today");
    expect(bucketFor("2026-08-28", NOW, TZ)).toBe("tomorrow");
    expect(bucketFor("2026-08-30", NOW, TZ)).toBe("week");
    expect(bucketFor("2026-09-03", NOW, TZ)).toBe("week");
    expect(bucketFor("2026-09-04", NOW, TZ)).toBe("later");
    expect(bucketFor(null, NOW, TZ)).toBe("someday");
  });

  it("late-evening local time does not roll the day (UTC crossing)", () => {
    // 23:30 Toronto on Aug 27 = 03:30Z Aug 28
    const lateNight = "2026-08-28T03:30:00.000Z";
    expect(bucketFor("2026-08-27", lateNight, TZ)).toBe("today");
    expect(bucketFor("2026-08-28", lateNight, TZ)).toBe("tomorrow");
  });

  it("handles garbage dates as undated rather than crashing", () => {
    expect(bucketFor("soon", NOW, TZ)).toBe("someday");
  });
});

describe("daysUntil", () => {
  it("is negative for overdue, zero today, positive ahead", () => {
    expect(daysUntil("2026-08-25", NOW, TZ)).toBe(-2);
    expect(daysUntil("2026-08-27", NOW, TZ)).toBe(0);
    expect(daysUntil("2026-09-01", NOW, TZ)).toBe(5);
    expect(daysUntil(null, NOW, TZ)).toBeNull();
  });
});
