// /api/trello/connect — GET status (+boards/lists), POST token exchange, PATCH board/list selection, DELETE revoke.
// Implements: TRD §1 /api/trello/connect, TRD-3.7, TRD-5.2, PRD-F10, UX-BRIEF S7.
import { env } from "@/lib/env";
import { ExternalCallError, jsonError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { trello, trelloAuthorizeUrl } from "@/lib/trello/client";
import { clearTrelloConnection, getTrelloConnection, saveTrelloSelection, saveTrelloToken } from "@/lib/trello/connection";
import { trelloConnectSchema, trelloSelectSchema } from "@/lib/validation";

async function currentUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Unauthenticated", 401);
  const url = new URL(request.url);
  const conn = await getTrelloConnection(userId);
  const authorizeUrl = trelloAuthorizeUrl(`${env.APP_URL}/settings/trello/callback`);
  if (!conn) return Response.json({ connected: false, authorizeUrl });

  const out: Record<string, unknown> = { connected: true, authorizeUrl, boardId: conn.boardId, listId: conn.listId, connectedAt: conn.connectedAt };
  try {
    if (url.searchParams.has("boards")) out.boards = await trello.boards(conn.token);
    const listsFor = url.searchParams.get("lists");
    if (listsFor) out.lists = await trello.lists(conn.token, listsFor);
    if (url.searchParams.has("expiry")) out.expiresAt = (await trello.tokenInfo(conn.token)).dateExpires;
  } catch (e) {
    if (e instanceof ExternalCallError && e.kind === "auth") {
      return Response.json({ connected: false, authorizeUrl, error: "Trello rejected the saved token (expired or revoked). Reconnect." });
    }
    out.error = e instanceof Error ? e.message : "Trello request failed";
  }
  return Response.json(out);
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Unauthenticated", 401);
  const body = trelloConnectSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Invalid token", 400);
  try {
    const me = await trello.me(body.data.token); // proves the token is live before we store it
    await saveTrelloToken(userId, body.data.token);
    return Response.json({ connected: true, member: { username: me.username, fullName: me.fullName } });
  } catch (e) {
    if (e instanceof ExternalCallError && e.kind === "auth") return jsonError("Trello did not accept that token", 401);
    return jsonError(e instanceof Error ? e.message : "Trello request failed", 502);
  }
}

export async function PATCH(request: Request) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Unauthenticated", 401);
  const body = trelloSelectSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Invalid selection", 400);
  const conn = await getTrelloConnection(userId);
  if (!conn) return jsonError("Trello is not connected", 409);
  try {
    const lists = await trello.lists(conn.token, body.data.boardId);
    if (!lists.some((l) => l.id === body.data.listId)) return jsonError("That list is not on that board", 400);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Could not verify board", 502);
  }
  await saveTrelloSelection(userId, body.data.boardId, body.data.listId);
  return Response.json({ ok: true });
}

export async function DELETE() {
  const userId = await currentUserId();
  if (!userId) return jsonError("Unauthenticated", 401);
  const conn = await getTrelloConnection(userId);
  let revokedAtTrello = false;
  if (conn) {
    try {
      revokedAtTrello = await trello.revoke(conn.token);
    } catch {
      revokedAtTrello = false;
    }
  }
  await clearTrelloConnection(userId); // always clear locally, even if Trello's revoke call failed
  return Response.json({ ok: true, revokedAtTrello });
}
