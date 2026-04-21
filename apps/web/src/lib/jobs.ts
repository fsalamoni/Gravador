import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export async function enqueueFullPipelineJob(
  db: Firestore,
  params: { recordingId: string; workspaceId: string; source?: string },
) {
  await db.collection('jobs').add({
    recordingId: params.recordingId,
    workspaceId: params.workspaceId,
    kind: 'full-pipeline',
    status: 'queued',
    source: params.source ?? null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}
