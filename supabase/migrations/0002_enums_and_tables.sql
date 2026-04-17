-- Enums
create type recording_status as enum (
  'queued','uploading','transcribing','diarizing','summarizing','embedding','ready','failed'
);
create type ai_output_kind as enum (
  'summary','action_items','mindmap','chapters','quotes','sentiment','flashcards'
);
create type job_status as enum ('queued','running','succeeded','failed','cancelled');
create type locale as enum ('pt-BR','en');
create type plan as enum ('free','pro','team','selfhost');

-- Users mirror (linked to auth.users via trigger)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  locale locale not null default 'pt-BR',
  created_at timestamptz not null default now()
);

-- Keep public.users in sync with auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url, locale)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    coalesce((new.raw_user_meta_data->>'locale')::locale, 'pt-BR')
  )
  on conflict (id) do nothing;

  -- Bootstrap a personal workspace on signup
  insert into public.workspaces (id, slug, name, owner_id, plan)
  values (
    gen_random_uuid(),
    substring(md5(new.id::text), 1, 10),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)) || '''s workspace',
    new.id,
    'free'
  )
  returning id into new.id;
  return new;
end;
$$;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  owner_id uuid not null references public.users(id) on delete cascade,
  plan plan not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  ai_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  parent_id uuid references public.folders(id) on delete set null,
  name text not null,
  color text,
  created_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  color text,
  unique (workspace_id, name)
);

create table public.recordings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references public.users(id),
  folder_id uuid references public.folders(id) on delete set null,
  title text,
  status recording_status not null default 'queued',
  locale locale,
  duration_ms integer not null,
  size_bytes integer not null,
  mime_type text not null,
  storage_path text not null,
  storage_bucket text not null default 'audio-raw',
  waveform_peaks jsonb,
  captured_at timestamptz not null,
  captured_from_device text,
  latitude real,
  longitude real,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recordings_workspace_idx on public.recordings (workspace_id, captured_at desc);
create index recordings_folder_idx on public.recordings (folder_id);
create index recordings_status_idx on public.recordings (status);

create table public.recording_tags (
  recording_id uuid not null references public.recordings(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (recording_id, tag_id)
);

create table public.speakers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  label text not null,
  voice_embedding vector(192),
  created_at timestamptz not null default now()
);

create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null unique references public.recordings(id) on delete cascade,
  provider text not null,
  model text not null,
  detected_locale locale,
  full_text text not null,
  created_at timestamptz not null default now()
);

create table public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.transcripts(id) on delete cascade,
  recording_id uuid not null references public.recordings(id) on delete cascade,
  speaker_id uuid references public.speakers(id),
  start_ms integer not null,
  end_ms integer not null,
  text text not null,
  confidence real
);
create index segments_transcript_idx on public.transcript_segments (transcript_id, start_ms);
create index segments_recording_idx on public.transcript_segments (recording_id, start_ms);
-- Full-text search across segments, language auto-detected by transcript.detected_locale
create index segments_fts_idx on public.transcript_segments using gin (to_tsvector('simple', text));

create table public.ai_outputs (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings(id) on delete cascade,
  kind ai_output_kind not null,
  payload jsonb not null,
  provider text not null,
  model text not null,
  cost_cents integer not null default 0,
  latency_ms integer,
  prompt_version text not null,
  locale locale,
  created_at timestamptz not null default now(),
  unique (recording_id, kind)
);

create table public.embeddings (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  chunk_index integer not null,
  start_segment_id uuid,
  end_segment_id uuid,
  start_ms integer not null,
  end_ms integer not null,
  content text not null,
  embedding vector(1536) not null,
  model text not null,
  created_at timestamptz not null default now()
);
create index embeddings_workspace_idx on public.embeddings (workspace_id);
create index embeddings_vector_idx on public.embeddings
  using hnsw (embedding vector_cosine_ops) with (m = 16, ef_construction = 64);

create table public.action_items (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings(id) on delete cascade,
  text text not null,
  assignee text,
  due_date timestamptz,
  done boolean not null default false,
  source_segment_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.shares (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references public.users(id),
  token text not null unique,
  password_hash text,
  expires_at timestamptz,
  permissions jsonb not null default '{"viewTranscript":true,"viewSummary":true,"viewChat":false}'::jsonb,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('google-drive','dropbox','onedrive','notion','obsidian')),
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, provider, workspace_id)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid references public.recordings(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null,
  status job_status not null default 'queued',
  attempt integer not null default 0,
  trigger_run_id text,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index jobs_status_idx on public.jobs (status);
create index jobs_recording_idx on public.jobs (recording_id);

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null,
  units real not null,
  cost_cents integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- updated_at trigger helper
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.tg_set_updated_at();

create trigger recordings_set_updated_at
  before update on public.recordings
  for each row execute function public.tg_set_updated_at();

-- Auto-add owner as member when workspace is created
create or replace function public.tg_workspace_add_owner()
returns trigger language plpgsql as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do update set role = 'owner';
  return new;
end; $$;

create trigger workspaces_add_owner
  after insert on public.workspaces
  for each row execute function public.tg_workspace_add_owner();
