// Shared Zod schemas for Route Handler boundaries (TRD-5.4, docs/ENGINEERING.md §3 "validate at the boundary").
import { z } from "zod";

export const uuid = z.string().uuid();
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
export const ianaTimezone = z
  .string()
  .min(1)
  .max(64)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Invalid IANA timezone");

export const createSessionSchema = z.object({
  timezone: ianaTimezone,
  recordedAt: z.string().datetime().optional(),
});

export const updateSessionSchema = z.object({
  status: z.enum(["uploaded"]),
  durationMs: z.number().int().min(0).max(21 * 60 * 1000),
  chunkCount: z.number().int().min(1).max(64),
});

export const commitmentPatchSchema = z.object({
  id: uuid,
  text: z.string().min(1).max(2000).optional(),
  ownerParticipantId: uuid.nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  dueConfirmed: z.boolean().optional(),
  status: z.enum(["open", "done"]).optional(),
  deleted: z.boolean().optional(),
});

export const participantPatchSchema = z.object({
  id: uuid,
  label: z.string().min(1).max(80).optional(),
  email: z.string().email().nullable().optional(),
});

export const segmentPatchSchema = z.object({
  seq: z.number().int().min(0),
  speakerLabel: z.string().min(1).max(80).nullable(),
});

export const correctionResolveSchema = z.object({
  id: uuid,
  action: z.enum(["accept", "reject"]),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  commitments: z.array(commitmentPatchSchema).max(200).optional(),
  participants: z.array(participantPatchSchema).max(10).optional(),
  newParticipants: z.array(z.object({ label: z.string().min(1).max(80) })).max(4).optional(),
  segments: z.array(segmentPatchSchema).max(2000).optional(),
  corrections: z.array(correctionResolveSchema).max(200).optional(),
  /** Transition draft → confirmed. Server re-validates gating (TRD-3.5). */
  confirm: z.boolean().optional(),
});

export const guestCorrectionSchema = z.object({
  commitmentId: uuid.nullable(),
  field: z.enum(["text", "owner", "due_date"]),
  suggestedValue: z.string().min(1).max(2000),
  submittedByLabel: z.string().max(80).optional(),
});

export const trelloConnectSchema = z.object({
  token: z.string().min(16).max(256).regex(/^[a-zA-Z0-9]+$/),
});

export const trelloSelectSchema = z.object({
  boardId: z.string().min(1).max(64),
  listId: z.string().min(1).max(64),
});

export const trelloDispatchSchema = z.object({
  noteId: uuid,
  /** Optional subset; defaults to all confirmed, undispatched commitments. */
  commitmentIds: z.array(uuid).max(200).optional(),
});

export const emailShareSchema = z.object({
  to: z.string().email(),
  participantId: uuid.optional(),
});

export const REMINDER_OFFSETS_MINUTES = [30, 60, 240, 1440] as const;
export const calendarQuerySchema = z.object({
  commitmentId: uuid.optional(),
  participantId: uuid.optional(),
  reminder: z.coerce.number().int().refine((n) => (REMINDER_OFFSETS_MINUTES as readonly number[]).includes(n)).optional(),
  t: z.string().optional(),
});
