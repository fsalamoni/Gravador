import type { Firestore } from 'firebase-admin/firestore';

interface RecordingAccessData {
  createdBy?: string;
  workspaceId?: string;
  [key: string]: unknown;
}

export type RecordingAccessResult =
  | {
      ok: true;
      ref: FirebaseFirestore.DocumentReference;
      data: RecordingAccessData;
    }
  | {
      ok: false;
      error: 'not_found' | 'forbidden';
    };

export async function canAccessWorkspace(
  db: Firestore,
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const [workspaceDoc, memberDoc] = await Promise.all([
    db.collection('workspaces').doc(workspaceId).get(),
    db.collection('workspaces').doc(workspaceId).collection('members').doc(userId).get(),
  ]);

  const ownerId = workspaceDoc.data()?.ownerId as string | undefined;
  return ownerId === userId || memberDoc.exists;
}

export async function getAccessibleRecording(
  db: Firestore,
  recordingId: string,
  userId: string,
): Promise<RecordingAccessResult> {
  const ref = db.collection('recordings').doc(recordingId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    return { ok: false, error: 'not_found' };
  }

  const data = snapshot.data() as RecordingAccessData;
  if (!data.workspaceId || typeof data.workspaceId !== 'string') {
    return { ok: false, error: 'forbidden' };
  }

  if (data.createdBy === userId) {
    return { ok: true, ref, data };
  }

  const allowed = await canAccessWorkspace(db, data.workspaceId, userId);
  if (!allowed) {
    return { ok: false, error: 'forbidden' };
  }

  return { ok: true, ref, data };
}
