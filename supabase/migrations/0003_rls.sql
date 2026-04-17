-- Helper: is the current auth.uid() a member of the given workspace?
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(ws uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid() and role in ('owner','admin')
  );
$$;

-- Enable RLS
alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.folders enable row level security;
alter table public.tags enable row level security;
alter table public.recordings enable row level security;
alter table public.recording_tags enable row level security;
alter table public.speakers enable row level security;
alter table public.transcripts enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.ai_outputs enable row level security;
alter table public.embeddings enable row level security;
alter table public.action_items enable row level security;
alter table public.shares enable row level security;
alter table public.integrations enable row level security;
alter table public.jobs enable row level security;
alter table public.usage_events enable row level security;

-- users: read own; update own
create policy "users_select_self" on public.users for select using (id = auth.uid());
create policy "users_update_self" on public.users for update using (id = auth.uid());

-- workspaces: member can read; only admin+ can update; owner can delete
create policy "workspaces_member_read" on public.workspaces for select
  using (public.is_workspace_member(id));
create policy "workspaces_admin_update" on public.workspaces for update
  using (public.is_workspace_admin(id));
create policy "workspaces_owner_delete" on public.workspaces for delete
  using (owner_id = auth.uid());
create policy "workspaces_owner_insert" on public.workspaces for insert
  with check (owner_id = auth.uid());

-- workspace_members: members can read; admins can write
create policy "members_select" on public.workspace_members for select
  using (public.is_workspace_member(workspace_id));
create policy "members_admin_write" on public.workspace_members for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- Generic pattern: workspace_id scoping
create policy "folders_member" on public.folders for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "tags_member" on public.tags for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "recordings_member" on public.recordings for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "recording_tags_member" on public.recording_tags for all
  using (exists (
    select 1 from public.recordings r
    where r.id = recording_id and public.is_workspace_member(r.workspace_id)
  ))
  with check (exists (
    select 1 from public.recordings r
    where r.id = recording_id and public.is_workspace_member(r.workspace_id)
  ));

create policy "speakers_member" on public.speakers for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "transcripts_member" on public.transcripts for all
  using (exists (
    select 1 from public.recordings r
    where r.id = recording_id and public.is_workspace_member(r.workspace_id)
  ))
  with check (exists (
    select 1 from public.recordings r
    where r.id = recording_id and public.is_workspace_member(r.workspace_id)
  ));

create policy "segments_member" on public.transcript_segments for all
  using (exists (
    select 1 from public.recordings r
    where r.id = recording_id and public.is_workspace_member(r.workspace_id)
  ))
  with check (exists (
    select 1 from public.recordings r
    where r.id = recording_id and public.is_workspace_member(r.workspace_id)
  ));

create policy "ai_outputs_member" on public.ai_outputs for all
  using (exists (
    select 1 from public.recordings r
    where r.id = recording_id and public.is_workspace_member(r.workspace_id)
  ))
  with check (exists (
    select 1 from public.recordings r
    where r.id = recording_id and public.is_workspace_member(r.workspace_id)
  ));

create policy "embeddings_member" on public.embeddings for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "action_items_member" on public.action_items for all
  using (exists (
    select 1 from public.recordings r
    where r.id = recording_id and public.is_workspace_member(r.workspace_id)
  ))
  with check (exists (
    select 1 from public.recordings r
    where r.id = recording_id and public.is_workspace_member(r.workspace_id)
  ));

create policy "shares_member" on public.shares for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- Integrations: only the owning user (within their workspace) can read
create policy "integrations_owner" on public.integrations for all
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

create policy "jobs_member_read" on public.jobs for select
  using (public.is_workspace_member(workspace_id));

create policy "usage_member_read" on public.usage_events for select
  using (public.is_workspace_member(workspace_id));
