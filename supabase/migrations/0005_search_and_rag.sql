-- Semantic search across a workspace
create or replace function public.match_embeddings(
  query_embedding vector(1536),
  ws_id uuid,
  match_count int default 10,
  min_similarity real default 0.6
)
returns table (
  id uuid,
  recording_id uuid,
  content text,
  start_ms int,
  end_ms int,
  similarity real
)
language sql stable
as $$
  select
    e.id,
    e.recording_id,
    e.content,
    e.start_ms,
    e.end_ms,
    (1 - (e.embedding <=> query_embedding))::real as similarity
  from public.embeddings e
  where e.workspace_id = ws_id
    and public.is_workspace_member(e.workspace_id)
    and (1 - (e.embedding <=> query_embedding)) >= min_similarity
  order by e.embedding <=> query_embedding asc
  limit match_count;
$$;

-- Keyword search across segments in a workspace
create or replace function public.search_segments(
  q text,
  ws_id uuid,
  match_count int default 30
)
returns table (
  recording_id uuid,
  segment_id uuid,
  start_ms int,
  end_ms int,
  text text,
  rank real
)
language sql stable
as $$
  select
    ts.recording_id,
    ts.id as segment_id,
    ts.start_ms,
    ts.end_ms,
    ts.text,
    ts_rank(to_tsvector('simple', ts.text), plainto_tsquery('simple', q))::real as rank
  from public.transcript_segments ts
  join public.recordings r on r.id = ts.recording_id
  where r.workspace_id = ws_id
    and public.is_workspace_member(r.workspace_id)
    and to_tsvector('simple', ts.text) @@ plainto_tsquery('simple', q)
  order by rank desc
  limit match_count;
$$;
