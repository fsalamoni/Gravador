import { getServerDb } from '@/lib/firebase-server';
import { formatDurationMs } from '@gravador/core';
import { notFound } from 'next/navigation';

interface ShareData {
  recordingId: string;
  revokedAt?: { toDate: () => Date } | null;
  expiresAt?: { toDate: () => Date } | null;
  passwordHash?: string | null;
  permissions?: {
    viewTranscript?: boolean;
    viewSummary?: boolean;
    viewChat?: boolean;
  };
}

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getServerDb();

  const shareSnap = await db.collection('shares').where('token', '==', token).limit(1).get();

  if (shareSnap.empty) notFound();
  const share = shareSnap.docs[0]!.data() as ShareData;

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

  const perms = share.permissions ?? { viewTranscript: true, viewSummary: true, viewChat: false };

  // Fetch transcript if permitted
  let transcript: { full_text: string } | null = null;
  if (perms.viewTranscript) {
    const txSnap = await db
      .collection('recordings')
      .doc(share.recordingId)
      .collection('transcripts')
      .limit(1)
      .get();
    if (!txSnap.empty) {
      transcript = txSnap.docs[0]!.data() as { full_text: string };
    }
  }

  // Fetch summary if permitted
  let summary: { tldr?: string; bullets?: string[]; full?: string } | null = null;
  if (perms.viewSummary) {
    const outSnap = await db
      .collection('recordings')
      .doc(share.recordingId)
      .collection('outputs')
      .where('kind', '==', 'summary')
      .limit(1)
      .get();
    if (!outSnap.empty) {
      summary = outSnap.docs[0]!.data().payload as { tldr?: string; bullets?: string[]; full?: string };
    }
  }

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-text">
          {rec.title ?? rec.capturedAt.toDate().toLocaleString()}
        </h1>
        <div className="text-mute mt-1">{formatDurationMs(rec.durationMs)}</div>
      </div>

      {summary && (
        <section className="space-y-4">
          {summary.tldr && (
            <div className="rounded-[24px] border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">TL;DR</h2>
              <p className="mt-2 text-text leading-relaxed">{summary.tldr}</p>
            </div>
          )}
          {summary.bullets && summary.bullets.length > 0 && (
            <div className="rounded-[24px] border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">Key points</h2>
              <ul className="mt-2 list-disc pl-5 space-y-1 text-text">
                {summary.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {transcript && (
        <section className="rounded-[24px] border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-accent mb-3">Transcript</h2>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-text/90">
            {transcript.full_text}
          </div>
        </section>
      )}

      <p className="text-xs text-mute text-center">
        Compartilhamento público — conteúdo é restrito pelas permissões configuradas pelo dono.
      </p>
    </main>
  );
}
