// POST /api/sessions/:id/audio — multipart chunk upload (index, chunk). Progressive, 30s chunks.
// Implements: TRD §1 /api/sessions/:id/audio, TRD-3.1. Ownership checked via RLS-scoped read before service-role write.
import { z } from "zod";
import { MAX_CHUNKS, MAX_CHUNK_BYTES, putChunk } from "@/lib/audio/storage";
import { jsonError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation";

const ALLOWED_MIME = ["audio/webm", "audio/ogg", "audio/mp4", "audio/wav"];
const chunkMeta = z.object({ index: z.coerce.number().int().min(0).max(MAX_CHUNKS - 1) });

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) return jsonError("Invalid id", 400);

  const supabase = await createSupabaseServerClient();
  const { data: session } = await supabase.from("sessions").select("id, status").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!session) return jsonError("Not found", 404);
  if (session.status !== "recording") return jsonError(`Session is ${session.status}; uploads closed`, 409);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Expected multipart form data", 400);
  }
  const meta = chunkMeta.safeParse({ index: form.get("index") });
  if (!meta.success) return jsonError("Invalid chunk index", 400);
  const chunk = form.get("chunk");
  if (!(chunk instanceof Blob)) return jsonError("Missing chunk", 400);
  if (chunk.size === 0) return jsonError("Empty chunk", 400);
  if (chunk.size > MAX_CHUNK_BYTES) return jsonError("Chunk too large", 413);
  const baseMime = (chunk.type || "audio/webm").split(";")[0] ?? "audio/webm";
  if (!ALLOWED_MIME.includes(baseMime)) return jsonError(`Unsupported audio type ${baseMime}`, 415);

  try {
    await putChunk(id, meta.data.index, new Uint8Array(await chunk.arrayBuffer()), baseMime);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "upload failed", 502);
  }
  return Response.json({ ok: true, index: meta.data.index });
}
