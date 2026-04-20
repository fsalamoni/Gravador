import { getServerDb } from '@/lib/firebase-server';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

/** Webhook: fires when a new audio file lands. Kicks off the AI job. */
export async function POST(req: Request) {
  const signature = req.headers.get('x-gravador-signature');
  if (signature !== process.env.INTERNAL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const body = (await req.json()) as {
    recordingId: string;
    workspaceId: string;
  };

  const db = getServerDb();
  await db.collection('jobs').add({
    recordingId: body.recordingId,
    workspaceId: body.workspaceId,
    kind: 'full-pipeline',
    status: 'queued',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // TODO: Trigger Cloud Function for AI pipeline processing
  // For now, the AI pipeline will poll the jobs collection
  // or be triggered via a Firestore onCreate trigger

  return NextResponse.json({ ok: true });
}
