// Share email via Resend. Plain and short. Send failure never blocks note creation (TRD-3.9).
// Implements: PRD-F13, TRD-3.9.
import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { formatDueDate } from "@/lib/format";

export interface ShareEmailInput {
  to: string;
  noteTitle: string;
  creatorLabel: string;
  recipientLabel: string | null;
  items: { text: string; dueDate: string | null }[];
  url: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

export async function sendShareEmail(input: ShareEmailInput): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  if (!env.RESEND_API_KEY) return { ok: false, error: "Email is not configured (RESEND_API_KEY missing)" };
  const resend = new Resend(env.RESEND_API_KEY);

  const greeting = input.recipientLabel ? `Hi ${input.recipientLabel},` : "Hi,";
  const itemsText = input.items.length ? input.items.map((i) => `• ${i.text}${i.dueDate ? ` — by ${formatDueDate(i.dueDate)}` : ""}`).join("\n") : "Nothing is on you from this one.";
  const text = `${greeting}

${input.creatorLabel} shared the notes from your conversation: "${input.noteTitle}".

Your items:
${itemsText}

Open the shared note (no account needed) — you can suggest a correction if something's off:
${input.url}

— Kept`;

  const itemsHtml = input.items.length
    ? `<ul>${input.items.map((i) => `<li>${escapeHtml(i.text)}${i.dueDate ? ` — <strong>by ${escapeHtml(formatDueDate(i.dueDate))}</strong>` : ""}</li>`).join("")}</ul>`
    : "<p>Nothing is on you from this one.</p>";
  const html = `<div style="font-family:Inter,system-ui,sans-serif;font-size:16px;color:#111;max-width:560px">
<p>${escapeHtml(greeting)}</p>
<p>${escapeHtml(input.creatorLabel)} shared the notes from your conversation: <strong>${escapeHtml(input.noteTitle)}</strong>.</p>
<p><strong>Your items</strong></p>${itemsHtml}
<p><a href="${escapeHtml(input.url)}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600">Open the shared note</a></p>
<p style="color:#5a5a5a;font-size:14px">No account needed. If something's off, tap “Something wrong?” on the note to suggest a correction.</p>
<p style="color:#5a5a5a;font-size:14px">— Kept</p></div>`;

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15_000);
    const { data, error } = await resend.emails.send({ from: env.EMAIL_FROM, to: input.to, subject: `Notes from your conversation: ${input.noteTitle}`, text, html });
    clearTimeout(t);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "email failed" };
  }
}
