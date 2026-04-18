import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { formatDurationMs } from '@gravador/core';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function RecordingsListPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const db = getServerDb();

  const snapshot = await db
    .collection('recordings')
    .where('createdBy', '==', user.uid)
    .where('deletedAt', '==', null)
    .orderBy('capturedAt', 'desc')
    .get();

  const recordings = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Array<{
    id: string;
    title?: string;
    durationMs: number;
    status: string;
    capturedAt: { toDate: () => Date };
  }>;

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-6">Gravações</h1>
      <div className="card divide-y divide-border">
        {recordings.map((r) => (
          <Link
            key={r.id}
            href={`/workspace/recordings/${r.id}`}
            className="flex items-center justify-between p-4 hover:bg-surfaceAlt"
          >
            <div>
              <div className="font-medium">{r.title ?? r.capturedAt.toDate().toLocaleString()}</div>
              <div className="text-mute text-sm mt-0.5">{r.status}</div>
            </div>
            <div className="text-mute text-sm font-mono">{formatDurationMs(r.durationMs)}</div>
          </Link>
        ))}
        {recordings.length === 0 && (
          <p className="p-8 text-mute text-center">Nenhuma gravação ainda.</p>
        )}
      </div>
    </div>
  );
}
