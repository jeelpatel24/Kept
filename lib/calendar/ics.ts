// RFC 5545 .ics generation: one VEVENT per commitment, VALARM with selectable offset. Pure (testable).
// Implements: PRD-F12, TRD-3.8.
import { createEvents, type EventAttributes } from "ics";
import { localTimeToUtc } from "@/lib/extract/dates";

export interface IcsCommitment {
  id: string;
  text: string;
  ownerLabel: string | null;
  dueDate: string | null; // YYYY-MM-DD
  sourceQuote: string;
  status: "open" | "done";
  trelloCardUrl: string | null;
}

export interface IcsInput {
  noteId: string;
  noteTitle: string;
  noteUrl: string;
  timezone: string;
  reminderMinutes: number;
  commitments: IcsCommitment[];
}

const DUE_HOUR = 17; // 5pm local — same instant Trello uses (lib/trello/dispatch.ts)
const EVENT_MINUTES = 30;

function utcParts(d: Date): [number, number, number, number, number] {
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()];
}

export function buildIcs(input: IcsInput): { ok: true; ics: string; eventCount: number } | { ok: false; error: string } {
  const events: EventAttributes[] = input.commitments
    .filter((c) => c.dueDate)
    .map((c) => {
      const start = localTimeToUtc(c.dueDate!, DUE_HOUR, 0, input.timezone);
      const description = [
        `Owner: ${c.ownerLabel ?? "Unassigned"}`,
        c.status === "done" ? "Status: done" : "Status: open",
        "",
        `"${c.sourceQuote}"`,
        "",
        `Note: ${input.noteUrl}`,
        c.trelloCardUrl ? `Trello: ${c.trelloCardUrl}` : "",
      ]
        .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
        .join("\n");
      return {
        uid: `${c.id}@kept`,
        title: c.status === "done" ? `✓ ${c.text}` : c.text,
        description,
        url: input.noteUrl,
        start: utcParts(start),
        startInputType: "utc",
        startOutputType: "utc",
        duration: { minutes: EVENT_MINUTES },
        status: c.status === "done" ? "CONFIRMED" : "CONFIRMED",
        busyStatus: "FREE",
        categories: ["Kept"],
        productId: "kept/ics",
        calName: `Kept — ${input.noteTitle}`,
        alarms: [
          {
            action: "display",
            description: `Due: ${c.text}`,
            trigger: { minutes: input.reminderMinutes, before: true },
          },
        ],
      } satisfies EventAttributes;
    });

  if (events.length === 0) {
    // Valid, empty calendar — honest rather than an error (a note may have no dated items yet).
    const empty = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:kept/ics", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:Kept — ${input.noteTitle}`, "END:VCALENDAR", ""].join("\r\n");
    return { ok: true, ics: empty, eventCount: 0 };
  }
  const { error, value } = createEvents(events);
  if (error || !value) return { ok: false, error: error?.message ?? "ics generation failed" };
  return { ok: true, ics: value, eventCount: events.length };
}
