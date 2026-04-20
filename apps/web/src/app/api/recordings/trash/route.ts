import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * POST /api/recordings/trash — soft-delete a recording (set deletedAt)
 * Body: { recordingId: string }
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { recordingId } = (await req.json()) as { recordingId?: string };
  if (!recordingId || typeof recordingId !== 'string') {
    return NextResponse.json({ error: 'missing_recording_id' }, { status: 400 });
  }

  const db = getServerDb();
  const ref = db.collection('recordings').doc(recordingId);
  const doc = await ref.get();
  if (!doc.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const data = doc.data()!;
  if (data.createdBy !== user.uid) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await ref.update({
    deletedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ ok: true });
}

/**
 * GET /api/recordings/trash — list trashed recordings
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getServerDb();
  const snap = await db
    .collection('recordings')
    .where('createdBy', '==', user.uid)
    .where('deletedAt', '!=', null)
    .orderBy('deletedAt', 'desc')
    .limit(100)
    .get();

  const items = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title ?? null,
      durationMs: data.durationMs,
      status: data.status,
      deletedAt: data.deletedAt?.toDate?.()?.toISOString() ?? null,
      capturedAt: data.capturedAt?.toDate?.()?.toISOString() ?? null,
    };
  });

  return NextResponse.json({ items });
}

/**
 * PUT /api/recordings/trash — restore a recording (clear deletedAt)
 * Body: { recordingId: string }
 */
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { recordingId } = (await req.json()) as { recordingId?: string };
  if (!recordingId || typeof recordingId !== 'string') {
    return NextResponse.json({ error: 'missing_recording_id' }, { status: 400 });
  }

  const db = getServerDb();
  const ref = db.collection('recordings').doc(recordingId);
  const doc = await ref.get();
  if (!doc.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const data = doc.data()!;
  if (data.createdBy !== user.uid) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await ref.update({ deletedAt: null, updatedAt: FieldValue.serverTimestamp() });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/recordings/trash — permanently delete a recording
 * Body: { recordingId: string }
 */
export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { recordingId } = (await req.json()) as { recordingId?: string };
  if (!recordingId || typeof recordingId !== 'string') {
    return NextResponse.json({ error: 'missing_recording_id' }, { status: 400 });
  }

  const db = getServerDb();
  const ref = db.collection('recordings').doc(recordingId);
  const doc = await ref.get();
  if (!doc.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const data = doc.data()!;
  if (data.createdBy !== user.uid) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Must be already soft-deleted
  if (!data.deletedAt) {
    return NextResponse.json({ error: 'not_trashed' }, { status: 400 });
  }

  // Delete subcollections
  const subcollections = [
    'transcripts',
    'transcript_segments',
    'ai_outputs',
    'action_items',
    'embeddings',
  ];
  for (const sub of subcollections) {
    const subSnap = await ref.collection(sub).get();
    if (!subSnap.empty) {
      const batch = db.batch();
      let count = 0;
      for (const sdoc of subSnap.docs) {
        batch.delete(sdoc.ref);
        count++;
        if (count >= 490) {
          await batch.commit();
          count = 0;
        }
      }
      if (count > 0) await batch.commit();
    }
  }

  await ref.delete();
  return NextResponse.json({ ok: true });
}
