import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { embedTexts } from '@gravador/ai';
import { NextResponse } from 'next/server';

/** Workspace-wide semantic search. */
export async function POST(req: Request) {
  const { q, workspaceId } = (await req.json()) as { q: string; workspaceId: string };
  if (!q || !workspaceId) {
    return NextResponse.json({ error: 'missing_input' }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Verify user is a member of the requested workspace
  const db = getServerDb();
  const memberDoc = await db
    .collection('workspaces')
    .doc(workspaceId)
    .collection('members')
    .doc(user.uid)
    .get();
  if (!memberDoc.exists) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const [queryEmbedding] = await embedTexts([q]);
  if (!queryEmbedding) {
    return NextResponse.json({ error: 'embed_failed' }, { status: 500 });
  }

  // Semantic search: query each recording's embeddings subcollection
  // For now, use collection group query on embeddings filtered by workspaceId
  const embeddingsRef = db.collectionGroup('embeddings').where('workspaceId', '==', workspaceId);
  const vectorQuery = embeddingsRef.findNearest('embedding', queryEmbedding, {
    limit: 15,
    distanceMeasure: 'COSINE',
  });
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

  // Keyword search: simple text search across transcript_segments
  // Firestore doesn't have full-text search natively, so we do prefix matching
  const segSnap = await db
    .collectionGroup('transcript_segments')
    .orderBy('text')
    .startAt(q)
    .endAt(`${q}\uf8ff`)
    .limit(15)
    .get();

  const keyword = segSnap.docs.map((d) => {
    const data = d.data();
    return {
      recording_id: data.recordingId,
      text: data.text,
      start_ms: data.startMs,
      end_ms: data.endMs,
    };
  });

  return NextResponse.json({ semantic, keyword });
}
