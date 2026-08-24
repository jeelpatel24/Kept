// .ics output shape (TRD §6 unit: ".ics output shape").
import { describe, expect, it } from "vitest";
import { buildIcs } from "@/lib/calendar/ics";

const base = {
  noteId: "n1",
  noteTitle: "Site walk",
  noteUrl: "https://kept.example/s/abc",
  timezone: "America/Toronto",
  reminderMinutes: 60,
};

describe("buildIcs", () => {
  it("emits one VEVENT per dated commitment with a VALARM", () => {
    const r = buildIcs({
      ...base,
      commitments: [
        { id: "c1", text: "Ravi sends the quote", ownerLabel: "Ravi", dueDate: "2026-08-27", sourceQuote: "I'll send the quote Thursday", status: "open", trelloCardUrl: null },
        { id: "c2", text: "No date item", ownerLabel: null, dueDate: null, sourceQuote: "x", status: "open", trelloCardUrl: null },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.eventCount).toBe(1);
    expect(r.ics).toContain("BEGIN:VCALENDAR");
    expect((r.ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(1);
    expect(r.ics).toContain("BEGIN:VALARM");
    expect(r.ics).toContain("TRIGGER:-PT60M");
    expect(r.ics).toContain("UID:c1@kept");
    expect(r.ics).toContain("DTSTART:20260827T210000Z"); // 17:00 EDT
    expect(r.ics).toContain("SUMMARY:Ravi sends the quote");
    expect(r.ics).toMatch(/URL:https:\/\/kept\.example\/s\/abc/);
  });

  it("uses the selected reminder offset", () => {
    const r = buildIcs({ ...base, reminderMinutes: 1440, commitments: [{ id: "c1", text: "x", ownerLabel: null, dueDate: "2026-08-27", sourceQuote: "x", status: "open", trelloCardUrl: null }] });
    expect(r.ok && r.ics).toContain("TRIGGER:-PT1440M");
  });

  it("returns a valid empty calendar when nothing is dated", () => {
    const r = buildIcs({ ...base, commitments: [] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.eventCount).toBe(0);
      expect(r.ics).toContain("BEGIN:VCALENDAR");
      expect(r.ics).toContain("END:VCALENDAR");
    }
  });
});
