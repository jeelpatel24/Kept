"use client";
// S7: one button → authorize → board picker → list picker → saved as default. Disconnect actually revokes. Shows expiry.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Status = {
  connected: boolean;
  authorizeUrl: string;
  boardId?: string | null;
  listId?: string | null;
  connectedAt?: string | null;
  expiresAt?: string | null;
  boards?: { id: string; name: string }[];
  lists?: { id: string; name: string }[];
  error?: string;
};

export function TrelloSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [boardId, setBoardId] = useState<string>("");
  const [listId, setListId] = useState<string>("");
  const [lists, setLists] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/trello/connect?boards=1&expiry=1", { cache: "no-store" });
    const s = (await res.json()) as Status;
    setStatus(s);
    if (s.error) setErr(s.error);
    if (s.boardId) setBoardId(s.boardId);
    if (s.listId) setListId(s.listId);
    if (s.boardId) {
      const lr = await fetch(`/api/trello/connect?lists=${encodeURIComponent(s.boardId)}`, { cache: "no-store" });
      const ls = (await lr.json()) as Status;
      setLists(ls.lists ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onBoardChange(id: string) {
    setBoardId(id);
    setListId("");
    setLists([]);
    if (!id) return;
    const lr = await fetch(`/api/trello/connect?lists=${encodeURIComponent(id)}`, { cache: "no-store" });
    const ls = (await lr.json()) as Status;
    setLists(ls.lists ?? []);
    if (ls.error) setErr(ls.error);
  }

  async function save() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/trello/connect", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ boardId, listId }) });
    setBusy(false);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error ?? "Could not save");
      return;
    }
    setMsg("Saved. New cards will go to this list.");
    await load();
  }

  async function disconnect() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/trello/connect", { method: "DELETE" });
    setBusy(false);
    const body = (await res.json().catch(() => ({}))) as { revokedAtTrello?: boolean };
    setMsg(body.revokedAtTrello ? "Disconnected and token revoked at Trello." : "Disconnected. (Trello didn’t confirm the revoke — you can also remove Kept under Trello → Settings → Applications.)");
    setBoardId("");
    setListId("");
    setLists([]);
    await load();
  }

  return (
    <main className="mx-auto max-w-md px-5 pb-16 pt-6">
      <Link href="/" className="text-ink-muted underline-offset-4 hover:underline">
        ← Home
      </Link>
      <h1 className="mt-2 text-3xl font-extrabold">Trello</h1>
      <p className="mt-1 text-ink-muted">Confirmed commitments become cards on one board and list you pick once.</p>

      {err ? (
        <p role="alert" className="mt-4 rounded-xl bg-danger-bg p-3 text-danger">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p role="status" className="mt-4 rounded-xl bg-ok-bg p-3 text-ok">
          {msg}
        </p>
      ) : null}

      {!status ? (
        <p className="mt-6 text-ink-muted">Loading…</p>
      ) : !status.connected ? (
        <a href={status.authorizeUrl} className="btn-primary mt-6 w-full text-lg">
          Connect Trello
        </a>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <div className="card flex items-center gap-3">
            <span aria-hidden className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ok text-lg font-bold text-white">✓</span>
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold">Connected</p>
              <p className="meta">
                {status.expiresAt ? `Token expires ${new Date(status.expiresAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}` : "Token expires in 30 days"} · encrypted
              </p>
            </div>
            <button type="button" className="btn-danger !min-h-[44px] px-3 text-sm" onClick={disconnect} disabled={busy}>
              Revoke
            </button>
          </div>

          <label htmlFor="board" className="label">
            Board
          </label>
          <select id="board" value={boardId} onChange={(e) => void onBoardChange(e.target.value)} className="tap rounded-[14px] border border-line bg-white px-3 shadow-[inset_0_2px_4px_rgba(27,36,48,0.06)]">
            <option value="">Choose a board…</option>
            {(status.boards ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <label htmlFor="list" className="label">
            List
          </label>
          <select id="list" value={listId} onChange={(e) => setListId(e.target.value)} disabled={!boardId} className="tap rounded-[14px] border border-line bg-white px-3 shadow-[inset_0_2px_4px_rgba(27,36,48,0.06)] disabled:opacity-50">
            <option value="">{boardId ? "Choose a list…" : "Pick a board first"}</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          <button type="button" className="btn-primary" onClick={save} disabled={busy || !boardId || !listId}>
            {busy ? "Saving…" : "Save as default"}
          </button>

          <a href={status.authorizeUrl} className="btn-quiet">
            Reconnect (refresh token)
          </a>
        </div>
      )}
    </main>
  );
}
