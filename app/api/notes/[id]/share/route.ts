// POST /api/notes/:id/share — mint a guest link (note must be confirmed: nothing is shared from unconfirmed model output).
// DELETE /api/notes/:id/share — revoke all links for the note.
// Implements: TRD §1 /api/notes/:id/share, TRD-3.6, TRD-5.3, PRD-F8, spec principle 1.
import { jsonError } from "@/lib/http";
import { mintShareLink, revokeShareLinks } from "@/lib/share/links";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) return jsonError("Invalid id", 400);
  const supabase = await createSupabaseServerClient();
  const { data: note } = await supabase.from("notes").select("id, status").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!note) return jsonError("Not found", 404);
  if (note.status !== "confirmed") return jsonError("Confirm the note before sharing it", 409);
  try {
    const link = await mintShareLink(id);
    return Response.json({ url: link.url, expiresAt: link.expiresAt }, { status: 201 });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "could not create link", 500);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) return jsonError("Invalid id", 400);
  const supabase = await createSupabaseServerClient();
  const { data: note } = await supabase.from("notes").select("id").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!note) return jsonError("Not found", 404);
  const revoked = await revokeShareLinks(id);
  return Response.json({ revoked });
}
