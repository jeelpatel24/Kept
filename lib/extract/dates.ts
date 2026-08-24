// Deterministic relative-date resolution anchored to the recording date + IANA timezone.
// Implements: PRD-F6, TRD-3.3 ("anything not anchorable to a concrete date → null, never a default").
// Pure, no I/O — unit-tested against a fixture table (TRD §6).

export type Confidence = "high" | "low";
export interface ResolvedDate {
  date: string; // YYYY-MM-DD
  confidence: Confidence;
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAY_ABBR: Record<string, number> = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_ABBR: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
const SMALL_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, couple: 2, few: 3,
};

/** Local calendar date (y, m0, d, weekday) of an instant in a timezone. */
export function localDateParts(instant: Date, timeZone: string): { y: number; m: number; d: number; wd: number } {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric", weekday: "short" });
  const parts = fmt.formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { y: Number(get("year")), m: Number(get("month")) - 1, d: Number(get("day")), wd: wdMap[get("weekday")] ?? 0 };
}

function ymd(utcDay: Date): string {
  return `${utcDay.getUTCFullYear()}-${String(utcDay.getUTCMonth() + 1).padStart(2, "0")}-${String(utcDay.getUTCDate()).padStart(2, "0")}`;
}
function addDays(base: Date, n: number): Date {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + n));
}
function lastDayOfMonth(y: number, m: number): Date {
  return new Date(Date.UTC(y, m + 1, 0));
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[.,;:!?()"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TIME_OF_DAY = /\b(first thing|morning|afternoon|evening|noon|midday|tonight|night|eod|end of day|end of the day|cob|close of business|am|pm|o ?clock|\d{1,2}(:\d{2})?\s?(am|pm))\b/g;
const LEAD_IN = /^(by|before|on|until|till|no later than|around|about|for|due|sometime|some time|latest|at the latest|the|this coming|coming|maybe|probably|hopefully|ideally|definitely|likely)\s+/;

function stripNoise(s: string): string {
  let out = s.replace(TIME_OF_DAY, " ").replace(/\s+/g, " ").trim();
  // Iteratively strip lead-ins ("by this Thursday" → "thursday")
  let prev = "";
  while (prev !== out) {
    prev = out;
    out = out.replace(LEAD_IN, "").trim();
  }
  out = out.replace(/\s+(at the latest|latest|or so|ish|or sooner|or earlier)$/, "").trim();
  return out;
}

function weekdayIndex(word: string): number | null {
  const i = WEEKDAYS.indexOf(word);
  if (i >= 0) return i;
  return WEEKDAY_ABBR[word] ?? null;
}
function monthIndex(word: string): number | null {
  const i = MONTHS.indexOf(word);
  if (i >= 0) return i;
  return MONTH_ABBR[word] ?? null;
}

/**
 * Resolve a natural-language due expression to a calendar date.
 * Returns null when the expression cannot be anchored to a concrete date.
 */
export function resolveRelativeDate(expression: string | null | undefined, recordedAt: Date | string, timeZone: string): ResolvedDate | null {
  if (!expression) return null;
  const anchorInstant = typeof recordedAt === "string" ? new Date(recordedAt) : recordedAt;
  if (Number.isNaN(anchorInstant.getTime())) return null;
  const lp = localDateParts(anchorInstant, timeZone);
  const today = new Date(Date.UTC(lp.y, lp.m, lp.d));
  const todayWd = lp.wd;

  const raw = normalise(expression);
  if (!raw) return null;

  // ISO date anywhere in the string
  const iso = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return Number.isNaN(d.getTime()) ? null : { date: ymd(d), confidence: "high" };
  }

  const s = stripNoise(raw);
  if (!s) return null;

  // Vague → null (never default)
  if (/^(soon|asap|as soon as possible|later|eventually|whenever|sometime|some time|tbd|tba|when (i|we|you) can|in a bit|shortly|at some point)$/.test(s)) return null;

  if (s === "today" || s === "now") return { date: ymd(today), confidence: "high" };
  if (s === "tomorrow" || s === "tmrw") return { date: ymd(addDays(today, 1)), confidence: "high" };
  if (/^(the )?day after tomorrow$/.test(s)) return { date: ymd(addDays(today, 2)), confidence: "high" };
  if (/^yesterday$/.test(s)) return { date: ymd(addDays(today, -1)), confidence: "high" };

  // "in N days/weeks/months", "N days from now", "within N days"
  const inN = s.match(/^(?:in|within|after)?\s*(\d+|[a-z]+)\s+(day|days|week|weeks|month|months)(?:\s+(?:from now|from today|time))?$/);
  if (inN) {
    const n = /^\d+$/.test(inN[1]!) ? Number(inN[1]) : SMALL_NUMBERS[inN[1]!];
    if (n !== undefined && n > 0 && n < 400) {
      const unit = inN[2]!;
      const conf: Confidence = /^(within|after)/.test(s) ? "low" : "high";
      if (unit.startsWith("day")) return { date: ymd(addDays(today, n)), confidence: conf };
      if (unit.startsWith("week")) return { date: ymd(addDays(today, 7 * n)), confidence: conf };
      const d = new Date(Date.UTC(lp.y, lp.m + n, lp.d));
      return { date: ymd(d), confidence: conf === "high" ? "low" : conf }; // month arithmetic is inherently fuzzy
    }
  }

  // Week-relative
  const startOfThisWeek = addDays(today, -((todayWd + 6) % 7)); // Monday
  if (/^(end of (the|this) week|end of week|eow|this week)$/.test(s)) {
    const fri = addDays(startOfThisWeek, 4);
    const target = fri.getTime() < today.getTime() ? today : fri;
    return { date: ymd(target), confidence: s === "this week" ? "low" : "high" };
  }
  if (/^(end of next week)$/.test(s)) return { date: ymd(addDays(startOfThisWeek, 11)), confidence: "high" };
  if (/^(next week|early next week|beginning of next week|start of next week|first thing next week)$/.test(s)) {
    return { date: ymd(addDays(startOfThisWeek, 7)), confidence: "low" };
  }
  if (/^(mid next week|middle of next week)$/.test(s)) return { date: ymd(addDays(startOfThisWeek, 9)), confidence: "low" };
  if (/^(this weekend|the weekend|weekend|on the weekend|over the weekend)$/.test(s)) {
    const sat = addDays(startOfThisWeek, 5);
    return { date: ymd(sat.getTime() < today.getTime() ? addDays(sat, 7) : sat), confidence: "low" };
  }
  if (/^(next weekend)$/.test(s)) return { date: ymd(addDays(startOfThisWeek, 12)), confidence: "low" };
  if (/^(in )?(a )?(two|2|couple of|couple) weeks?$/.test(s)) return { date: ymd(addDays(today, 14)), confidence: "high" };

  // Month-relative
  if (/^(end of (the|this) month|end of month|eom|month end)$/.test(s)) return { date: ymd(lastDayOfMonth(lp.y, lp.m)), confidence: "high" };
  if (/^(next month|early next month|beginning of next month|start of next month)$/.test(s)) return { date: ymd(new Date(Date.UTC(lp.y, lp.m + 1, 1))), confidence: "low" };
  if (/^(end of next month)$/.test(s)) return { date: ymd(lastDayOfMonth(lp.y, lp.m + 1)), confidence: "high" };
  if (/^(mid month|middle of the month|mid-month)$/.test(s)) return { date: ymd(new Date(Date.UTC(lp.y, lp.m, 15))), confidence: "low" };

  // Weekday: "thursday", "this thursday", "next thursday", "a week thursday", "thursday week"
  const wdMatch = s.match(/^(?:(this|next|a week|a week on|the following|following)\s+)?([a-z]+)(?:\s+(week|next week|this week|after next))?$/);
  if (wdMatch) {
    const wd = weekdayIndex(wdMatch[2]!);
    if (wd !== null) {
      const qualifier = wdMatch[1] ?? "";
      const suffix = wdMatch[3] ?? "";
      let delta = (wd - todayWd + 7) % 7; // 0 = today
      let confidence: Confidence = "high";
      if (qualifier === "" || qualifier === "this") {
        if (delta === 0) {
          // "Thursday" said on a Thursday — could be today or next week
          delta = 7;
          confidence = "low";
        }
      } else if (qualifier === "next" || qualifier === "the following" || qualifier === "following") {
        // "next Thursday": if the bare next occurrence is within the same calendar week, people usually mean the week after.
        const bare = delta === 0 ? 7 : delta;
        const bareDate = addDays(today, bare);
        const bareInThisWeek = bareDate.getTime() <= addDays(startOfThisWeek, 6).getTime();
        delta = bareInThisWeek ? bare + 7 : bare;
        confidence = "low";
      } else {
        // "a week thursday"
        delta = (delta === 0 ? 7 : delta) + 7;
        confidence = "low";
      }
      if (suffix === "week" || suffix === "next week") {
        delta = (wd - 1 + 7) % 7; // position within next week
        return { date: ymd(addDays(startOfThisWeek, 7 + delta)), confidence: suffix === "week" ? "low" : "high" };
      }
      if (suffix === "after next") return { date: ymd(addDays(startOfThisWeek, 14 + ((wd - 1 + 7) % 7))), confidence: "low" };
      return { date: ymd(addDays(today, delta)), confidence };
    }
  }

  // "the 15th" / "15th" / "on the 3rd"
  const ordinalOnly = s.match(/^(?:the )?(\d{1,2})(?:st|nd|rd|th)?$/);
  if (ordinalOnly) {
    const day = Number(ordinalOnly[1]);
    if (day >= 1 && day <= 31) {
      let d = new Date(Date.UTC(lp.y, lp.m, day));
      if (d.getUTCMonth() !== lp.m) return null;
      if (d.getTime() < today.getTime()) d = new Date(Date.UTC(lp.y, lp.m + 1, day));
      if (d.getUTCDate() !== day) return null;
      return { date: ymd(d), confidence: "high" };
    }
  }

  // "march 3", "march 3rd", "3 march", "3rd of march", "sept 12 2026", "march 3 2027"
  const md1 = s.match(/^(?:the )?([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?$/);
  const md2 = s.match(/^(?:the )?(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+([a-z]+)(?:\s+(\d{4}))?$/);
  const mdm = md1 ? { month: md1[1]!, day: md1[2]!, year: md1[3] } : md2 ? { month: md2[2]!, day: md2[1]!, year: md2[3] } : null;
  if (mdm) {
    const m = monthIndex(mdm.month);
    const day = Number(mdm.day);
    if (m !== null && day >= 1 && day <= 31) {
      let year = mdm.year ? Number(mdm.year) : lp.y;
      let d = new Date(Date.UTC(year, m, day));
      if (d.getUTCMonth() !== m) return null;
      if (!mdm.year && d.getTime() < today.getTime()) {
        year += 1;
        d = new Date(Date.UTC(year, m, day));
      }
      return { date: ymd(d), confidence: "high" };
    }
  }

  // Numeric "9/12" or "12/9" — ambiguous ordering; treat as M/D, low confidence
  const num = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (num) {
    const m = Number(num[1]) - 1;
    const day = Number(num[2]);
    let year = num[3] ? Number(num[3]) : lp.y;
    if (year < 100) year += 2000;
    let d = new Date(Date.UTC(year, m, day));
    if (d.getUTCMonth() !== m) return null;
    if (!num[3] && d.getTime() < today.getTime()) d = new Date(Date.UTC(year + 1, m, day));
    return { date: ymd(d), confidence: "low" };
  }

  return null;
}

/**
 * Converts a local wall-clock time (in `timeZone`) to a UTC instant. Used for Trello `due` and .ics DTSTART.
 * Handles DST by measuring the zone offset at the guessed instant (two-pass for transitions).
 */
export function localTimeToUtc(dateIso: string, hour: number, minute: number, timeZone: string): Date {
  const [y, m, d] = dateIso.split("-").map(Number) as [number, number, number];
  const wall = Date.UTC(y, m - 1, d, hour, minute, 0);
  const offsetAt = (instant: number) => {
    const p = new Intl.DateTimeFormat("en-US", { timeZone, hour12: false, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" }).formatToParts(new Date(instant));
    const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? "0");
    const hourVal = g("hour") % 24; // some engines emit "24" for midnight
    return Date.UTC(g("year"), g("month") - 1, g("day"), hourVal, g("minute")) - instant;
  };
  let instant = wall - offsetAt(wall);
  instant = wall - offsetAt(instant);
  return new Date(instant);
}
