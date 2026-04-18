import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import { formatDurationMs } from '@gravador/core';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function WorkspaceHome() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const db = getServerDb();

  const snapshot = await db
    .collection('recordings')
    .where('createdBy', '==', user.uid)
    .where('deletedAt', '==', null)
    .orderBy('capturedAt', 'desc')
    .limit(12)
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
      <h1 className="text-3xl font-semibold mb-6">Início</h1>

      <section className="mb-10">
        <h2 className="text-lg text-mute mb-3">Gravações recentes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {recordings.map((r) => (
            <Link
              key={r.id}
              href={`/workspace/recordings/${r.id}`}
              className="card p-5 hover:border-accent transition block"
            >
              <div className="font-medium truncate">
                {r.title ?? r.capturedAt.toDate().toLocaleString()}
              </div>
              <div className="text-mute text-sm mt-2 flex justify-between">
                <span>{formatDurationMs(r.durationMs)}</span>
                <span>{r.status}</span>
              </div>
            </Link>
          ))}
          {recordings.length === 0 && (
            <div className="text-mute col-span-full">
              Sem gravações ainda. Abra o app no celular e grave algo.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
