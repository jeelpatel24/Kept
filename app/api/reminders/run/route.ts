// The reminder engine (PRD-F17).
// GET  — scheduled run (Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`): digest every opted-in user.
// POST — signed-in user triggers their own digest right now (explicit action, no opt-in needed for self).
import { sendDigestEmail } from "@/lib/email/digest";
import { loadFollowups, sortFollowups } from "@/lib/followups/load";
import { jsonError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;

async function digestUser(userId: string, email: string, displayName: string | null): Promise<{ sent: boolean; error?: string }> {
  const admin = createSupabaseAdminClient();
  const items = sortFollowups(await loadFollowups(admin, { userId }));
  const actionable = items.filter((i) => i.bucket === "overdue" || i.bucket === "today" || i.bucket === "tomorrow");
  if (actionable.length === 0) return { sent: false };
  const r = await sendDigestEmail(email, displayName, actionable);
  return r.ok ? { sent: true } : { sent: false, error: r.error };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return jsonError("CRON_SECRET is not configured", 503);
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return jsonError("Unauthorized", 401);

  const admin = createSupabaseAdminClient();
  const { data: users } = await admin.from("users").select("id, email, display_name").eq("reminders_enabled", true);
  const results: { user: string; sent: boolean; error?: string }[] = [];
  for (const u of users ?? []) {
    const r = await digestUser(u.id, u.email, u.display_name);
    results.push({ user: u.id, ...r });
  }
  return Response.json({ ok: true, users: results.length, sent: results.filter((r) => r.sent).length, failures: results.filter((r) => r.error).length });
}

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Unauthenticated", 401);
  const { data: profile } = await supabase.from("users").select("email, display_name").eq("id", user.id).maybeSingle();
  if (!profile) return jsonError("Profile not found", 404);
  const r = await digestUser(user.id, profile.email, profile.display_name);
  if (r.error) return jsonError(`Digest failed: ${r.error}`, 502);
  return Response.json({ ok: true, sent: r.sent, message: r.sent ? `Sent to ${profile.email}` : "Nothing overdue, due today or tomorrow — no email needed." });
}
