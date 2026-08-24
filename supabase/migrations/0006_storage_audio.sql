-- 0006_storage_audio.sql
-- Implements: TRD §1 "Supabase Storage (audio, deleted post-transcription)" · TRD-3.1 · TRD-4.6 · TRD-5.5
-- Private bucket. Uploads and deletes go through the service-role Route Handler only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio', 'audio', false, 10485760, array['audio/webm','audio/ogg','audio/mp4','audio/wav'])
on conflict (id) do nothing;
