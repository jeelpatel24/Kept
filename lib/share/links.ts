// Mint / resolve share links against share_links. Implements: TRD-3.6, TRD-5.3, SCHEMA share_links.
import "server-only";
import { env } from "@/lib/env";
import { DEFAULT_SHARE_TTL_SECONDS, shareTokenHash, signShareToken, verifyShareToken, type SharePayload } from "@/lib/share/token";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface MintedLink {
  token: string;
  url: string;
  expiresAt: string;
}

/** Mints a guest link for a note. Caller must already have verified the creator owns the note. */
export async function mintShareLink(noteId: string, scope?: "cal", ttlSeconds = DEFAULT_SHARE_TTL_SECONDS): Promise<MintedLink> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload: SharePayload = { n: noteId, r: "guest", exp, ...(scope ? { s: scope } : {}) };
  const token = signShareToken(payload, env.SHARE_TOKEN_SECRET);
  const db = createSupabaseAdminClient();
  const expiresAt = new Date(exp * 1000).toISOString();
  const { error } = await db.from("share_links").insert({ note_id: noteId, token_hash: shareTokenHash(token), role: "guest", expires_at: expiresAt });
  if (error) throw new Error(`could not store share link: ${error.message}`);
  const url = scope === "cal" ? `${env.APP_URL}/api/notes/${noteId}/calendar.ics?t=${token}` : `${env.APP_URL}/s/${token}`;
  return { token, url, expiresAt };
}

export type ResolveLink = { ok: true; noteId: string; linkId: string; scope: "cal" | undefined } | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "revoked" | "unknown" };

/** Verifies signature + expiry, then checks the DB row (revocation). Optionally bumps view stats. */
export async function resolveShareToken(token: string, opts: { touch?: boolean; requireScope?: "cal" | "note" } = {}): Promise<ResolveLink> {
  const v = verifyShareToken(token, env.SHARE_TOKEN_SECRET);
  if (!v.ok) return { ok: false, reason: v.reason };
  const scope = v.payload.s;
  if (opts.requireScope === "note" && scope === "cal") return { ok: false, reason: "bad_signature" };
  const db = createSupabaseAdminClient();
  const { data: row } = await db.from("share_links").select("id, note_id, revoked_at, view_count").eq("token_hash", shareTokenHash(token)).maybeSingle();
  if (!row) return { ok: false, reason: "unknown" };
  if (row.revoked_at) return { ok: false, reason: "revoked" };
  if (row.note_id !== v.payload.n) return { ok: false, reason: "bad_signature" };
  if (opts.touch) {
    await db.from("share_links").update({ last_viewed_at: new Date().toISOString(), view_count: row.view_count + 1 }).eq("id", row.id);
  }
  return { ok: true, noteId: row.note_id, linkId: row.id, scope };
}

export async function revokeShareLinks(noteId: string): Promise<number> {
  const db = createSupabaseAdminClient();
  const { data } = await db.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("note_id", noteId).is("revoked_at", null).select("id");
  return data?.length ?? 0;
}
