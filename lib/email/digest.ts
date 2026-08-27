// The daily follow-up digest email — a calendar-style reminder, but for promises.
// Implements: PRD-F17, TRD-3.9. Plain and short; never sent unless the user opted in (or asked right now).
import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { formatDueDate } from "@/lib/format";
import type { FollowupItem } from "@/lib/followups/load";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function section(title: string, color: string, items: FollowupItem[]): string {
  if (items.length === 0) return "";
  const rows = items
    .map(
      (i) =>
        `<li style="margin-bottom:6px">${esc(i.text)} <span style="color:#5d6673">— ${esc(i.ownerLabel ?? "unassigned")}${i.dueDate ? ` · ${esc(formatDueDate(i.dueDate))}` : ""} · <a href="${env.APP_URL}/notes/${i.noteId}" style="color:#1f5fe0">${esc(i.noteTitle)}</a></span></li>`,
    )
    .join("");
  return `<p style="margin:14px 0 6px;font-weight:700;color:${color}">${title}</p><ul style="margin:0;padding-left:18px">${rows}</ul>`;
}

export function digestSubject(overdue: number, today: number): string {
  if (overdue > 0) return `Kept — ${overdue} overdue, ${today} due today`;
  if (today > 0) return `Kept — ${today} follow-up${today === 1 ? "" : "s"} due today`;
  return "Kept — what's coming up";
}

export async function sendDigestEmail(to: string, displayName: string | null, items: FollowupItem[]): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!env.RESEND_API_KEY) return { ok: false, error: "Email is not configured (RESEND_API_KEY missing)" };
  const overdue = items.filter((i) => i.bucket === "overdue");
  const today = items.filter((i) => i.bucket === "today");
  const tomorrow = items.filter((i) => i.bucket === "tomorrow");
  if (overdue.length + today.length + tomorrow.length === 0) return { ok: true }; // nothing worth an email — send nothing

  const textLines = [...overdue.map((i) => `OVERDUE  ${i.text} — ${i.ownerLabel ?? "unassigned"} (${i.noteTitle})`), ...today.map((i) => `TODAY    ${i.text} — ${i.ownerLabel ?? "unassigned"} (${i.noteTitle})`), ...tomorrow.map((i) => `TOMORROW ${i.text} — ${i.ownerLabel ?? "unassigned"} (${i.noteTitle})`)];
  const html = `<div style="font-family:'IBM Plex Sans',Inter,system-ui,sans-serif;font-size:15px;color:#1b2430;max-width:560px">
<p>${esc(displayName ? `Morning, ${displayName}.` : "Morning.")} Here's what's still owed:</p>
${section(`⚠ Overdue (${overdue.length})`, "#c0392b", overdue)}
${section(`Due today (${today.length})`, "#1b2430", today)}
${section(`Tomorrow (${tomorrow.length})`, "#5d6673", tomorrow)}
<p style="margin-top:18px"><a href="${env.APP_URL}/followups" style="display:inline-block;background:#1f5fe0;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600">Open follow-ups</a></p>
<p style="color:#5d6673;font-size:13px">You get this because reminders are on in Kept. Turn them off on the Follow-ups screen.</p>
</div>`;

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({ from: env.EMAIL_FROM, to, subject: digestSubject(overdue.length, today.length), text: `${textLines.join("\n")}\n\n${env.APP_URL}/followups`, html });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "email failed" };
  }
}
