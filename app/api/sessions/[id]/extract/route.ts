// POST /api/sessions/:id/extract — transcript → draft note. Implements: TRD §1, TRD-3.3, PRD-F4.
import { runExtraction } from "@/lib/extract";
import { jsonError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation";

export const maxDuration = 120;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) return jsonError("Invalid id", 400);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Unauthenticated", 401);
  const { data: session } = await supabase.from("sessions").select("id").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!session) return jsonError("Not found", 404);
  const { data: profile } = await supabase.from("users").select("display_name, email").eq("id", user.id).maybeSingle();
  const creatorHint = profile?.display_name ?? (profile?.email ? profile.email.split("@")[0] ?? null : null);

  const outcome = await runExtraction(id, user.id, creatorHint);
  if (!outcome.ok) {
    const status = outcome.kind === "state" ? 409 : outcome.kind === "db" ? 500 : 502;
    return Response.json({ ok: false, error: outcome.error, kind: outcome.kind }, { status });
  }
  return Response.json(outcome);
}
