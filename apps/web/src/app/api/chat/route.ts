import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { getAccessibleRecording } from '@/lib/recording-access';
import { chatWithRecording, embedTexts } from '@gravador/ai';
import { detectLocale } from '@gravador/i18n';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

type VectorQueryOptionsCompat = {
  limit: number;
  distanceMeasure: 'COSINE' | 'EUCLIDEAN' | 'DOT_PRODUCT';
};

export async function POST(req: Request) {
  const { recordingId, messages } = (await req.json()) as {
    recordingId: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
  if (!recordingId || !messages?.length) {
    return NextResponse.json({ error: 'missing_input' }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getServerDb();
  const access = await getAccessibleRecording(db, recordingId, user.uid);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.error === 'not_found' ? 404 : 403 },
    );
  }
  const rec = access.data as { workspaceId: string; locale?: string };

  const query = messages[messages.length - 1]!.content;
  const [queryEmbedding] = await embedTexts([query]);
  if (!queryEmbedding) {
    return NextResponse.json({ error: 'embed_failed' }, { status: 500 });
  }

  // Vector search using Firestore findNearest
  const embeddingsRef = access.ref.collection('embeddings');
  const findNearestOpts = {
    limit: 6,
    distanceMeasure: 'COSINE' as const,
    distanceResultField: '_distance',
  };
  const vectorQuery = embeddingsRef.findNearest(
    'embedding',
    queryEmbedding,
    findNearestOpts as unknown as VectorQueryOptionsCompat,
  );
  const embSnap = await vectorQuery.get();

  const context = embSnap.docs.map((d) => {
    const data = d.data();
    return {
      content: data.content as string,
      startMs: data.startMs as number,
      endMs: data.endMs as number,
      similarity: 1 - (data._distance ?? 0),
    };
  });

  const locale = detectLocale(rec.locale ?? 'pt-BR');

  // Load workspace AI settings for per-agent model config
  const wsDoc = await db.collection('workspaces').doc(rec.workspaceId).get();
  const aiSettings = (wsDoc.data()?.aiSettings ?? {}) as {
    chatProvider?: string;
    chatModel?: string;
    byokKeys?: Record<string, string>;
    ollamaUrl?: string;
    agentModels?: Record<string, { provider?: string; model?: string }>;
  };
  const chatAgent = aiSettings.agentModels?.chat;
  const provider = (chatAgent?.provider ?? aiSettings.chatProvider) as
    | 'anthropic'
    | 'openai'
    | 'google'
    | 'ollama'
    | 'openrouter'
    | undefined;
  const model = chatAgent?.model ?? aiSettings.chatModel;

  const keys = { ...(aiSettings.byokKeys ?? {}) };
  if (aiSettings.ollamaUrl) keys.ollamaBaseUrl = aiSettings.ollamaUrl;

  const result = chatWithRecording({
    messages,
    context,
    locale,
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
    keys,
  });

  return result.toDataStreamResponse();
}
