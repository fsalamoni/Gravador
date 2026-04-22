import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { getAccessibleRecording } from '@/lib/recording-access';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * PUT /api/recordings/tags — Update tags on one or more recordings
 * Body: { recordingIds: string[], tags: string[] }
 */
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json()) as { recordingIds?: string[]; tags?: string[] };
  if (!body.recordingIds?.length || !Array.isArray(body.tags)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // Sanitize tags: lowercase, trim, unique, max 20 per recording
  const tags = [
    ...new Set(body.tags.map((t: string) => String(t).trim().toLowerCase()).filter(Boolean)),
  ].slice(0, 20);

  const db = getServerDb();

  // Verify ownership & update
  const BATCH_LIMIT = 490;
  let batch = db.batch();
  let opCount = 0;
  let updated = 0;

  for (const recId of body.recordingIds.slice(0, 100)) {
    const access = await getAccessibleRecording(db, recId, user.uid);
    if (!access.ok) continue;

    batch.update(access.ref, { tags, updatedAt: FieldValue.serverTimestamp() });
    opCount++;
    updated++;

    if (opCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) await batch.commit();

  return NextResponse.json({ ok: true, updated, tags });
}

/**
 * POST /api/recordings/tags/add — Add tags to recordings (merge, don't replace)
 * Body: { recordingIds: string[], tags: string[] }
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json()) as { recordingIds?: string[]; tags?: string[] };
  if (!body.recordingIds?.length || !Array.isArray(body.tags) || !body.tags.length) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const newTags = body.tags.map((t: string) => String(t).trim().toLowerCase()).filter(Boolean);

  const db = getServerDb();
  const BATCH_LIMIT = 490;
  let batch = db.batch();
  let opCount = 0;

  for (const recId of body.recordingIds.slice(0, 100)) {
    const access = await getAccessibleRecording(db, recId, user.uid);
    if (!access.ok) continue;

    const existing = (access.data.tags ?? []) as string[];
    const merged = [...new Set([...existing, ...newTags])].slice(0, 20);

    batch.update(access.ref, { tags: merged, updatedAt: FieldValue.serverTimestamp() });
    opCount++;

    if (opCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) await batch.commit();

  return NextResponse.json({ ok: true });
}
