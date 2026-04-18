import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { embedTexts } from '@gravador/ai';
import { NextResponse } from 'next/server';

type VectorQueryOptionsCompat = {
  limit: number;
  distanceMeasure: 'COSINE' | 'EUCLIDEAN' | 'DOT_PRODUCT';
};

/** User-scoped semantic + keyword search across all recordings. */
export async function POST(req: Request) {
  const { q } = (await req.json()) as { q: string };
  if (!q) {
    return NextResponse.json({ error: 'missing_input' }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getServerDb();

  // Get all recordings belonging to this user
  const userRecordings = await db
    .collection('recordings')
    .where('createdBy', '==', user.uid)
    .where('deletedAt', '==', null)
    .select()
    .get();
  const recordingIds = userRecordings.docs.map((d) => d.id);

  if (recordingIds.length === 0) {
    return NextResponse.json({ semantic: [], keyword: [] });
  }

  const [queryEmbedding] = await embedTexts([q]);
  if (!queryEmbedding) {
    return NextResponse.json({ error: 'embed_failed' }, { status: 500 });
  }

  // Semantic search: query embeddings filtered by user's recordings
  // Firestore 'in' filter supports up to 30 values
  const batchIds = recordingIds.slice(0, 30);
  const embeddingsRef = db.collectionGroup('embeddings').where('recordingId', 'in', batchIds);
  const findNearestOpts = {
    limit: 15,
    distanceMeasure: 'COSINE' as const,
    distanceResultField: '_distance',
  };
  const vectorQuery = embeddingsRef.findNearest(
    'embedding',
    queryEmbedding,
    findNearestOpts as unknown as VectorQueryOptionsCompat,
  );
  const embSnap = await vectorQuery.get();

  const semantic = embSnap.docs.map((d) => {
    const data = d.data();
    return {
      recording_id: data.recordingId,
      content: data.content,
      start_ms: data.startMs,
      end_ms: data.endMs,
      similarity: 1 - (data._distance ?? 0),
    };
  });

  // Keyword search: prefix match on user's recordings only
  const keywordResults: Array<{
    recording_id: string;
    text: string;
    start_ms: number;
    end_ms: number;
  }> = [];

  // Query segments per recording (limited to first 10 recordings for perf)
  for (const recId of recordingIds.slice(0, 10)) {
    const segSnap = await db
      .collection('recordings')
      .doc(recId)
      .collection('transcript_segments')
      .orderBy('text')
      .startAt(q)
      .endAt(`${q}\uf8ff`)
      .limit(5)
      .get();

    for (const d of segSnap.docs) {
      const data = d.data();
      keywordResults.push({
        recording_id: data.recordingId ?? recId,
        text: data.text,
        start_ms: data.startMs,
        end_ms: data.endMs,
      });
    }
    if (keywordResults.length >= 15) break;
  }

  return NextResponse.json({ semantic, keyword: keywordResults.slice(0, 15) });
}
