import { createSupabaseServer } from '@/lib/supabase-server';
import { embedTexts } from '@gravador/ai';
import { NextResponse } from 'next/server';

/** Workspace-wide semantic + keyword search. */
export async function POST(req: Request) {
  const { q, workspaceId } = (await req.json()) as { q: string; workspaceId: string };
  if (!q || !workspaceId) {
    return NextResponse.json({ error: 'missing_input' }, { status: 400 });
  }
  const supabase = await createSupabaseServer();
  const [queryEmbedding] = await embedTexts([q]);
  if (!queryEmbedding) {
    return NextResponse.json({ error: 'embed_failed' }, { status: 500 });
  }

  const [semantic, keyword] = await Promise.all([
    supabase.rpc('match_embeddings', {
      query_embedding: queryEmbedding,
      ws_id: workspaceId,
      match_count: 15,
      min_similarity: 0.55,
    }),
    supabase.rpc('search_segments', { q, ws_id: workspaceId, match_count: 15 }),
  ]);

  return NextResponse.json({
    semantic: semantic.data ?? [],
    keyword: keyword.data ?? [],
  });
}
