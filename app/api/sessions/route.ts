// POST /api/sessions — create a recording session (status: recording).
// Implements: TRD §1 /api/sessions, TRD-3.1, SCHEMA sessions. Requires creator auth (middleware).
import { jsonError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSessionSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Unauthenticated", 401);

  const body = createSessionSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Invalid input", 400, { issues: body.error.issues });

  // Ensure the public.users mirror row exists (trigger normally handles this; be defensive for pre-existing auth users).
  await supabase.from("users").upsert({ id: user.id, email: user.email ?? "" }, { onConflict: "id", ignoreDuplicates: true });

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      status: "recording",
      timezone: body.data.timezone,
      recorded_at: body.data.recordedAt ?? new Date().toISOString(),
    })
    .select("id, status, recorded_at, timezone")
    .single();
  if (error || !data) return jsonError(`Could not create session: ${error?.message ?? "unknown"}`, 500);

  return Response.json({ session: data }, { status: 201 });
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Unauthenticated", 401);
  const { data, error } = await supabase
    .from("sessions")
    .select("id, status, recorded_at, timezone, duration_ms, error_detail")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return jsonError(error.message, 500);
  return Response.json({ sessions: data });
}
