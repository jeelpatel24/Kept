// Trello REST client (key + user token). All calls timeout + typed failures (TRD-4.4). Implements: TRD-3.7.
import "server-only";
import { env } from "@/lib/env";
import { ExternalCallError, fetchWithTimeout } from "@/lib/http";

const BASE = "https://api.trello.com/1";

function auth(token: string) {
  return `key=${encodeURIComponent(env.TRELLO_API_KEY)}&token=${encodeURIComponent(token)}`;
}

async function trelloJson<T>(path: string, init: RequestInit & { token: string; retries?: number }): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetchWithTimeout(`${BASE}${path}${sep}${auth(init.token)}`, { ...init, timeoutMs: 20_000, retries: init.retries ?? 1, provider: "trello" });
  if (!res.ok) throw new ExternalCallError("http", `trello ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status, "trello");
  return (await res.json()) as T;
}

export interface TrelloMember {
  id: string;
  username: string;
  fullName: string;
}
export interface TrelloBoard {
  id: string;
  name: string;
  url: string;
  closed: boolean;
}
export interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
}
export interface TrelloCard {
  id: string;
  url: string;
  shortUrl: string;
  name: string;
}
export interface TrelloTokenInfo {
  dateExpires: string | null;
}

export const trello = {
  me: (token: string) => trelloJson<TrelloMember>("/members/me?fields=id,username,fullName", { token }),
  tokenInfo: (token: string) => trelloJson<TrelloTokenInfo>(`/tokens/${encodeURIComponent(token)}?fields=dateExpires`, { token }),
  boards: (token: string) => trelloJson<TrelloBoard[]>("/members/me/boards?filter=open&fields=id,name,url,closed", { token }),
  lists: (token: string, boardId: string) => trelloJson<TrelloList[]>(`/boards/${encodeURIComponent(boardId)}/lists?filter=open&fields=id,name,closed`, { token }),
  createCard: (token: string, input: { idList: string; name: string; desc: string; due: string | null }) =>
    trelloJson<TrelloCard>("/cards", {
      token,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idList: input.idList, name: input.name, desc: input.desc, due: input.due, pos: "top" }),
      retries: 0, // never double-create on a timeout; idempotency is handled by trello_card_id (TRD-3.7)
    }),
  revoke: async (token: string) => {
    const res = await fetchWithTimeout(`${BASE}/tokens/${encodeURIComponent(token)}?${auth(token)}`, { method: "DELETE", timeoutMs: 15_000, retries: 0, provider: "trello" });
    return res.ok || res.status === 404;
  },
};

export function trelloAuthorizeUrl(returnUrl: string): string {
  const q = new URLSearchParams({
    expiration: "30days",
    name: "Kept",
    scope: "read,write",
    response_type: "token",
    key: env.TRELLO_API_KEY,
    return_url: returnUrl,
  });
  return `https://trello.com/1/authorize?${q.toString()}`;
}
