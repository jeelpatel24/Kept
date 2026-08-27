// Hand-maintained Database types mirroring supabase/migrations (SCHEMA.md §2).
// Keep in sync with MIGRATION_LOG.md.

export type SessionStatus =
  | "recording"
  | "uploaded"
  | "transcribing"
  | "transcribed"
  | "transcription_failed";
export type NoteStatus = "draft" | "confirmed";
export type CommitmentKind = "commitment" | "decision" | "open_question";
export type CommitmentStatus = "open" | "done";
export type DueConfidence = "high" | "low";
export type CorrectionField = "text" | "owner" | "due_date";
export type CorrectionStatus = "pending" | "accepted" | "rejected";
export type LlmTask = "transcribe" | "extract";
export type LlmCallStatus = "ok" | "rate_limited" | "failed";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at: string };

export type UserRow = Timestamps & {
  id: string;
  email: string;
  display_name: string | null;
  trello_token_encrypted: string | null; // bytea comes back as hex string "\\x..."
  trello_board_id: string | null;
  trello_list_id: string | null;
  trello_connected_at: string | null;
  reminders_enabled: boolean;
}

export type SessionRow = Timestamps & {
  id: string;
  user_id: string;
  status: SessionStatus;
  recorded_at: string;
  timezone: string;
  duration_ms: number | null;
  audio_hash: string | null;
  audio_deleted_at: string | null;
  provider_used: string | null;
  error_detail: string | null;
  deleted_at: string | null;
}

export type TranscriptSegmentRow = Timestamps & {
  id: string;
  session_id: string;
  seq: number;
  start_ms: number;
  end_ms: number;
  text: string;
  speaker_label: string | null;
  speaker_confirmed: boolean;
}

export type NoteRow = Timestamps & {
  id: string;
  session_id: string;
  user_id: string;
  title: string;
  summary: string | null;
  status: NoteStatus;
  confirmed_at: string | null;
  extraction_version: string;
  extraction_hash: string | null;
  deleted_at: string | null;
}

export type ParticipantRow = Timestamps & {
  id: string;
  note_id: string;
  label: string;
  is_creator: boolean;
  email: string | null;
}

export type CommitmentRow = Timestamps & {
  id: string;
  note_id: string;
  kind: CommitmentKind;
  text: string;
  owner_participant_id: string | null;
  due_date: string | null;
  due_confidence: DueConfidence | null;
  due_confirmed: boolean;
  source_segment_ids: number[];
  source_quote: string;
  status: CommitmentStatus;
  trello_card_id: string | null;
  trello_card_url: string | null;
  dispatched_at: string | null;
  deleted_at: string | null;
}

export type ShareLinkRow = Timestamps & {
  id: string;
  note_id: string;
  token_hash: string;
  role: "guest";
  expires_at: string;
  revoked_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
}

export type CorrectionRow = Timestamps & {
  id: string;
  note_id: string;
  commitment_id: string | null;
  field: CorrectionField;
  suggested_value: string;
  submitted_by_label: string | null;
  status: CorrectionStatus;
  resolved_at: string | null;
}

export type LlmCallRow = {
  id: string;
  session_id: string | null;
  task: LlmTask;
  provider: string;
  model: string;
  cache_hit: boolean;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
  status: LlmCallStatus;
  created_at: string;
}

export type LlmCacheRow = {
  task: LlmTask;
  input_hash: string;
  provider: string;
  model: string;
  result: unknown;
  created_at: string;
}

type Insert<T, Optional extends keyof T> = Omit<T, Optional> & Partial<Pick<T, Optional>>;

type Table<Row, Ins, Upd = Partial<Ins>> = {
  Row: Row;
  Insert: Ins;
  Update: Upd;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      users: Table<UserRow, Insert<UserRow, "created_at" | "updated_at" | "display_name" | "trello_token_encrypted" | "trello_board_id" | "trello_list_id" | "trello_connected_at" | "reminders_enabled">>;
      sessions: Table<SessionRow, Insert<SessionRow, "id" | "created_at" | "updated_at" | "deleted_at" | "status" | "recorded_at" | "duration_ms" | "audio_hash" | "audio_deleted_at" | "provider_used" | "error_detail">>;
      transcript_segments: Table<TranscriptSegmentRow, Insert<TranscriptSegmentRow, "id" | "created_at" | "updated_at" | "speaker_label" | "speaker_confirmed">>;
      notes: Table<NoteRow, Insert<NoteRow, "id" | "created_at" | "updated_at" | "deleted_at" | "summary" | "status" | "confirmed_at" | "extraction_hash">>;
      participants: Table<ParticipantRow, Insert<ParticipantRow, "id" | "created_at" | "updated_at" | "is_creator" | "email">>;
      commitments: Table<CommitmentRow, Insert<CommitmentRow, "id" | "created_at" | "updated_at" | "deleted_at" | "owner_participant_id" | "due_date" | "due_confidence" | "due_confirmed" | "status" | "trello_card_id" | "trello_card_url" | "dispatched_at">>;
      share_links: Table<ShareLinkRow, Insert<ShareLinkRow, "id" | "created_at" | "updated_at" | "role" | "expires_at" | "revoked_at" | "last_viewed_at" | "view_count">>;
      corrections: Table<CorrectionRow, Insert<CorrectionRow, "id" | "created_at" | "updated_at" | "commitment_id" | "submitted_by_label" | "status" | "resolved_at">>;
      llm_calls: Table<LlmCallRow, Insert<LlmCallRow, "id" | "created_at" | "session_id" | "cache_hit" | "input_tokens" | "output_tokens" | "latency_ms">>;
      llm_cache: Table<LlmCacheRow, Insert<LlmCacheRow, "created_at">>;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
