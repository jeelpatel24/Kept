// Confirmed commitments → Trello cards. Idempotent via commitments.trello_card_id. Per-item partial failure.
// Implements: PRD-F11, TRD-3.7, spec §4 provenance (card desc links to the exact quote / note).
import "server-only";
import { env } from "@/lib/env";
import { localTimeToUtc } from "@/lib/extract/dates";
import { ExternalCallError } from "@/lib/http";
import type { NoteGraph } from "@/lib/notes/load";
import { formatDueDate, truncate } from "@/lib/format";
import { mintShareLink } from "@/lib/share/links";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { trello } from "@/lib/trello/client";
import type { TrelloConnection } from "@/lib/trello/connection";

export interface DispatchItemResult {
  commitmentId: string;
  ok: boolean;
  cardUrl?: string;
  skipped?: boolean;
  error?: string;
}

/** Due date → Trello `due` (ISO instant): 17:00 local on that day in the note's timezone. */
export function dueInstant(dateIso: string, timeZone: string): string {
  return localTimeToUtc(dateIso, 17, 0, timeZone).toISOString();
}

export async function dispatchToTrello(graph: NoteGraph, conn: TrelloConnection, commitmentIds: string[] | undefined): Promise<{ results: DispatchItemResult[]; created: number; failed: number; skipped: number }> {
  if (!conn.listId) throw new Error("No Trello list selected");
  const db = createSupabaseAdminClient();
  const targets = graph.commitments.filter((c) => c.kind === "commitment" && (!commitmentIds || commitmentIds.includes(c.id)));
  const results: DispatchItemResult[] = [];

  // One share link per dispatch so every card has a working back-link (PRD-F11, US9). Guests may open it.
  let noteUrl: string;
  try {
    noteUrl = (await mintShareLink(graph.note.id)).url;
  } catch {
    noteUrl = `${env.APP_URL}/notes/${graph.note.id}`;
  }
  const labelOf = (id: string | null) => graph.participants.find((p) => p.id === id)?.label ?? "Unassigned";

  for (const c of targets) {
    if (c.trello_card_id) {
      results.push({ commitmentId: c.id, ok: true, skipped: true, cardUrl: c.trello_card_url ?? undefined });
      continue;
    }
    const firstSeq = c.source_segment_ids[0] ?? 0;
    const desc = [
      `**Owner:** ${labelOf(c.owner_participant_id)}`,
      c.due_date ? `**Due:** ${formatDueDate(c.due_date)}` : "**Due:** not set",
      "",
      `> "${c.source_quote}"`,
      "",
      `From the conversation "${graph.note.title}" — [open the note](${noteUrl}#seg-${firstSeq}) to read the exact moment this was said.`,
      "",
      "_Created by Kept_",
    ].join("\n");
    try {
      const card = await trello.createCard(conn.token, {
        idList: conn.listId,
        name: truncate(c.text, 120),
        desc,
        due: c.due_date ? dueInstant(c.due_date, graph.session.timezone) : null,
      });
      await db.from("commitments").update({ trello_card_id: card.id, trello_card_url: card.shortUrl || card.url, dispatched_at: new Date().toISOString() }).eq("id", c.id);
      results.push({ commitmentId: c.id, ok: true, cardUrl: card.shortUrl || card.url });
    } catch (e) {
      const msg = e instanceof ExternalCallError ? (e.kind === "auth" ? "Trello token expired or revoked — reconnect in Settings" : e.kind === "rate_limited" ? "Trello rate-limited — retry in a moment" : e.message) : e instanceof Error ? e.message : "unknown";
      results.push({ commitmentId: c.id, ok: false, error: msg });
      // Successful cards are not rolled back (TRD-3.7). Continue with the rest.
    }
  }
  return {
    results,
    created: results.filter((r) => r.ok && !r.skipped).length,
    failed: results.filter((r) => !r.ok).length,
    skipped: results.filter((r) => r.skipped).length,
  };
}
