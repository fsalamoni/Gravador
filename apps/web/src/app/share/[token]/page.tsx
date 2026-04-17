import { getServerDb } from '@/lib/firebase-server';
import { formatDurationMs } from '@gravador/core';
import { notFound } from 'next/navigation';

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getServerDb();

  const shareSnap = await db.collection('shares').where('token', '==', token).limit(1).get();

  if (shareSnap.empty) notFound();
  const share = shareSnap.docs[0]!.data() as {
    recordingId: string;
    revokedAt?: { toDate: () => Date } | null;
    expiresAt?: { toDate: () => Date } | null;
  };

  if (share.revokedAt || (share.expiresAt && share.expiresAt.toDate() < new Date())) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <p className="text-mute">Este link expirou ou foi revogado.</p>
      </main>
    );
  }

  const recDoc = await db.collection('recordings').doc(share.recordingId).get();
  const rec = recDoc.data() as
    | {
        title?: string;
        durationMs: number;
        status: string;
        capturedAt: { toDate: () => Date };
      }
    | undefined;

  if (!rec) notFound();

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold">
        {rec.title ?? rec.capturedAt.toDate().toLocaleString()}
      </h1>
      <div className="text-mute mt-1">{formatDurationMs(rec.durationMs)}</div>
      <p className="text-mute mt-8">
        Compartilhamento público — conteúdo é restrito pelas permissões configuradas pelo dono.
      </p>
    </main>
  );
}
