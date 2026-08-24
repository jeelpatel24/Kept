// POST /api/sessions/:id/transcribe — run (or retry) transcription. Implements: TRD §1, TRD-3.2.
import { jsonError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runTranscription } from "@/lib/transcribe";
import { uuid } from "@/lib/validation";

export const maxDuration = 60;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) return jsonError("Invalid id", 400);

  // Ownership via RLS-scoped read.
  const supabase = await createSupabaseServerClient();
  const { data: session } = await supabase.from("sessions").select("id, status").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!session) return jsonError("Not found", 404);

  const outcome = await runTranscription(id);
  if (!outcome.ok) return Response.json({ ok: false, error: outcome.error, kind: outcome.kind }, { status: outcome.kind === "state" ? 409 : 502 });
  return Response.json({ ok: true, segmentCount: outcome.segments.length, provider: outcome.provider, cacheHit: outcome.cacheHit });
}
