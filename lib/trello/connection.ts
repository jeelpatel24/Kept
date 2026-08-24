// Load/decrypt the current user's Trello connection. Token never leaves the server. Implements: TRD-3.7, TRD-5.2.
import "server-only";
import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret, fromBytea, toBytea } from "@/lib/trello/crypto";

export interface TrelloConnection {
  token: string;
  boardId: string | null;
  listId: string | null;
  connectedAt: string | null;
}

export async function getTrelloConnection(userId: string): Promise<TrelloConnection | null> {
  const db = createSupabaseAdminClient();
  const { data } = await db.from("users").select("trello_token_encrypted, trello_board_id, trello_list_id, trello_connected_at").eq("id", userId).maybeSingle();
  if (!data?.trello_token_encrypted) return null;
  let token: string;
  try {
    token = decryptSecret(fromBytea(data.trello_token_encrypted), env.ENCRYPTION_KEY);
  } catch {
    return null; // key rotated or corrupt → treat as disconnected; user reconnects
  }
  return { token, boardId: data.trello_board_id, listId: data.trello_list_id, connectedAt: data.trello_connected_at };
}

export async function saveTrelloToken(userId: string, token: string): Promise<void> {
  const db = createSupabaseAdminClient();
  const { error } = await db
    .from("users")
    .update({ trello_token_encrypted: toBytea(encryptSecret(token, env.ENCRYPTION_KEY)), trello_connected_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw new Error(`could not save token: ${error.message}`);
}

export async function saveTrelloSelection(userId: string, boardId: string, listId: string): Promise<void> {
  const db = createSupabaseAdminClient();
  const { error } = await db.from("users").update({ trello_board_id: boardId, trello_list_id: listId }).eq("id", userId);
  if (error) throw new Error(`could not save selection: ${error.message}`);
}

export async function clearTrelloConnection(userId: string): Promise<void> {
  const db = createSupabaseAdminClient();
  await db.from("users").update({ trello_token_encrypted: null, trello_board_id: null, trello_list_id: null, trello_connected_at: null }).eq("id", userId);
}
