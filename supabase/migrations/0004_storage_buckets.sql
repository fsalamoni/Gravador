-- Storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('audio-raw', 'audio-raw', false, 524288000, array['audio/m4a','audio/mp4','audio/aac','audio/mpeg','audio/wav','audio/x-wav','audio/ogg','audio/webm','audio/flac']),
  ('audio-processed', 'audio-processed', false, 524288000, null),
  ('exports', 'exports', false, 52428800, null)
on conflict (id) do nothing;

-- Storage policies: workspace members can read/write objects scoped by path prefix.
-- Convention: first path segment = workspace_id (UUID).
create policy "audio_raw_member_read" on storage.objects for select
  using (
    bucket_id = 'audio-raw'
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id::text = split_part(name, '/', 1)
        and wm.user_id = auth.uid()
    )
  );

create policy "audio_raw_member_write" on storage.objects for insert
  with check (
    bucket_id = 'audio-raw'
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id::text = split_part(name, '/', 1)
        and wm.user_id = auth.uid()
    )
  );

create policy "audio_raw_member_delete" on storage.objects for delete
  using (
    bucket_id = 'audio-raw'
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id::text = split_part(name, '/', 1)
        and wm.user_id = auth.uid()
        and wm.role in ('owner','admin')
    )
  );

create policy "audio_processed_member_read" on storage.objects for select
  using (
    bucket_id = 'audio-processed'
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id::text = split_part(name, '/', 1)
        and wm.user_id = auth.uid()
    )
  );

create policy "exports_member_read" on storage.objects for select
  using (
    bucket_id = 'exports'
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id::text = split_part(name, '/', 1)
        and wm.user_id = auth.uid()
    )
  );
