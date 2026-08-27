// Urgency bucketing for follow-ups and reminder digests. Deterministic and timezone-aware,
// like lib/extract/dates.ts. Pure — unit-tested. Implements: PRD-F16, PRD-F17.
import { localDateParts } from "@/lib/extract/dates";

export type FollowupBucket = "overdue" | "today" | "tomorrow" | "week" | "later" | "someday";

export const BUCKET_ORDER: FollowupBucket[] = ["overdue", "today", "tomorrow", "week", "later", "someday"];

export const BUCKET_LABELS: Record<FollowupBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  week: "This week",
  later: "Later",
  someday: "No date",
};

function dayNumber(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m, d) / 86_400_000);
}

/**
 * Buckets a due date (YYYY-MM-DD or null) relative to "now" in the given IANA timezone.
 * "week" = within the next 7 days after tomorrow.
 */
export function bucketFor(dueDate: string | null, now: Date | string, timeZone: string): FollowupBucket {
  if (!dueDate) return "someday";
  const m = dueDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "someday";
  const due = dayNumber(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const instant = typeof now === "string" ? new Date(now) : now;
  const lp = localDateParts(instant, timeZone);
  const today = dayNumber(lp.y, lp.m, lp.d);
  const delta = due - today;
  if (delta < 0) return "overdue";
  if (delta === 0) return "today";
  if (delta === 1) return "tomorrow";
  if (delta <= 7) return "week";
  return "later";
}

/** How overdue/soon, in local days (negative = overdue). Null for undated. */
export function daysUntil(dueDate: string | null, now: Date | string, timeZone: string): number | null {
  if (!dueDate) return null;
  const m = dueDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const due = dayNumber(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const instant = typeof now === "string" ? new Date(now) : now;
  const lp = localDateParts(instant, timeZone);
  return due - dayNumber(lp.y, lp.m, lp.d);
}
