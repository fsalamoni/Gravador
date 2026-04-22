import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { getAccessibleRecording } from '@/lib/recording-access';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * POST /api/recordings/reprocess — Queue recordings for AI reprocessing
 * Body: { recordingIds: string[], pipelines?: string[] }
 * pipelines defaults to all: ['summarize','actionItems','mindmap','chapters','embed']
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json()) as { recordingIds?: string[]; pipelines?: string[] };
  if (!body.recordingIds?.length) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const allPipelines = ['summarize', 'actionItems', 'mindmap', 'chapters', 'embed'];
  const pipelines = body.pipelines?.filter((p: string) => allPipelines.includes(p)) ?? allPipelines;

  const db = getServerDb();
  let queued = 0;

  for (const recId of body.recordingIds.slice(0, 50)) {
    const access = await getAccessibleRecording(db, recId, user.uid);
    if (!access.ok) continue;

    // Mark recording for reprocessing
    await access.ref.update({
      'pipeline.status': 'pending',
      'pipeline.requestedPipelines': pipelines,
      'pipeline.requestedAt': FieldValue.serverTimestamp(),
      'pipeline.requestedBy': user.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    queued++;
  }

  return NextResponse.json({ ok: true, queued, pipelines });
}
