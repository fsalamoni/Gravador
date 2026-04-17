import { createSupabaseServer } from '@/lib/supabase-server';
import { chatWithRecording, embedTexts } from '@gravador/ai';
import { detectLocale } from '@gravador/i18n';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const { recordingId, messages } = (await req.json()) as {
    recordingId: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
  if (!recordingId || !messages?.length) {
    return NextResponse.json({ error: 'missing_input' }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: rec, error: recErr } = await supabase
    .from('recordings')
    .select('workspace_id, locale')
    .eq('id', recordingId)
    .single();
  if (recErr || !rec) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const query = messages[messages.length - 1]!.content;
  const [queryEmbedding] = await embedTexts([query]);
  if (!queryEmbedding) {
    return NextResponse.json({ error: 'embed_failed' }, { status: 500 });
  }

  const { data: chunks } = await supabase.rpc('match_embeddings', {
    query_embedding: queryEmbedding,
    ws_id: rec.workspace_id,
    match_count: 6,
    min_similarity: 0.5,
  });

  const context = (chunks ?? [])
    .filter((c: { recording_id: string }) => c.recording_id === recordingId)
    .map((c: { content: string; start_ms: number; end_ms: number; similarity: number }) => ({
      content: c.content,
      startMs: c.start_ms,
      endMs: c.end_ms,
      similarity: c.similarity,
    }));

  const locale = detectLocale(rec.locale ?? 'pt-BR');

  const result = chatWithRecording({
    messages,
    context,
    locale,
  });

  return result.toDataStreamResponse();
}
