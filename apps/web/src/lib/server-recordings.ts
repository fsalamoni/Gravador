import { getServerDb } from '@/lib/firebase-server';

type TimestampLike = {
  toDate?: () => Date;
  toMillis?: () => number;
};

export type ServerRecording = {
  id: string;
  title?: string;
  durationMs: number;
  status: string;
  capturedAt?: TimestampLike;
  deletedAt?: TimestampLike | null;
};

function isMissingIndexError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as {
    code?: number | string;
    details?: string;
    message?: string;
  };

  if (candidate.code === 9 || candidate.code === '9') return true;

  const message = [candidate.details, candidate.message].filter(Boolean).join(' ');
  return message.toLowerCase().includes('requires an index');
}

function getTimestampValue(value: TimestampLike | null | undefined) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  return 0;
}

export async function listUserRecordings(userId: string, limit?: number) {
  const db = getServerDb();

  try {
    let query = db
      .collection('recordings')
      .where('createdBy', '==', userId)
      .where('deletedAt', '==', null)
      .orderBy('capturedAt', 'desc');

    if (typeof limit === 'number') {
      query = query.limit(limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ServerRecording[];
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }

    const snapshot = await db.collection('recordings').where('createdBy', '==', userId).get();

    const recordings = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ServerRecording[];

    const visibleRecordings = recordings
      .filter((recording) => recording.deletedAt == null)
      .sort(
        (left, right) => getTimestampValue(right.capturedAt) - getTimestampValue(left.capturedAt),
      );

    return typeof limit === 'number' ? visibleRecordings.slice(0, limit) : visibleRecordings;
  }
}
