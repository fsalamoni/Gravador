import { getServerDb, getSessionUser } from '@/lib/firebase-server';
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
  const recDoc = await db.collection('recordings').doc(recordingId).get();
  if (!recDoc.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const rec = recDoc.data() as { workspaceId: string; createdBy: string; locale?: string };

  // Verify user owns this recording or is a workspace member
  if (rec.createdBy !== user.uid) {
    const memberDoc = await db
      .collection('workspaces')
      .doc(rec.workspaceId)
      .collection('members')
      .doc(user.uid)
      .get();
    if (!memberDoc.exists) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const query = messages[messages.length - 1]!.content;
  const [queryEmbedding] = await embedTexts([query]);
  if (!queryEmbedding) {
    return NextResponse.json({ error: 'embed_failed' }, { status: 500 });
  }

  // Vector search using Firestore findNearest
  const embeddingsRef = db.collection('recordings').doc(recordingId).collection('embeddings');
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

  const result = chatWithRecording({
    messages,
    context,
    locale,
  });

  return result.toDataStreamResponse();
}
