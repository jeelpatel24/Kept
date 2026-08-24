// GET /api/sessions/:id — status + transcript (for S3 polling).
// PATCH /api/sessions/:id — recording → uploaded transition (TRD-3.1, SCHEMA §4 state machine).
import { jsonError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateSessionSchema, uuid } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) return jsonError("Invalid id", 400);
  const supabase = await createSupabaseServerClient();

  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, status, recorded_at, timezone, duration_ms, provider_used, error_detail, audio_deleted_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!session) return jsonError("Not found", 404);

  const { data: segments } = await supabase
    .from("transcript_segments")
    .select("seq, start_ms, end_ms, text, speaker_label, speaker_confirmed")
    .eq("session_id", id)
    .order("seq", { ascending: true });

  const { data: note } = await supabase.from("notes").select("id, status").eq("session_id", id).is("deleted_at", null).maybeSingle();

  return Response.json({ session, segments: segments ?? [], note: note ?? null });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) return jsonError("Invalid id", 400);
  const body = updateSessionSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Invalid input", 400, { issues: body.error.issues });

  const supabase = await createSupabaseServerClient();
  const { data: current } = await supabase.from("sessions").select("id, status").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!current) return jsonError("Not found", 404);
  if (current.status !== "recording") return jsonError(`Session is ${current.status}; cannot mark uploaded`, 409);

  const { data, error } = await supabase
    .from("sessions")
    .update({ status: "uploaded", duration_ms: body.data.durationMs })
    .eq("id", id)
    .select("id, status, duration_ms")
    .single();
  if (error || !data) return jsonError(error?.message ?? "update failed", 500);
  return Response.json({ session: data });
}
