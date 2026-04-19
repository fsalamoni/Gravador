import { getServerDb, getServerStorage, getSessionUser } from '@/lib/firebase-server';
import { ArrowLeft, Clock3, FileAudio, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Player } from './player';
import { RecordingTabs } from './tabs';

export default async function RecordingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const { id } = await params;
  const db = getServerDb();

  const recDoc = await db.collection('recordings').doc(id).get();
  if (!recDoc.exists) notFound();
  const recData = recDoc.data()!;

  // Authorization: must be creator or workspace member
  if (recData.createdBy !== user.uid) {
    const memberDoc = await db
      .collection('workspaces')
      .doc(recData.workspaceId as string)
      .collection('members')
      .doc(user.uid)
      .get();
    if (!memberDoc.exists) notFound();
  }

  const recording = { id: recDoc.id, ...recData } as {
    id: string;
    title?: string;
    capturedAt: { toDate: () => Date };
    status: string;
    durationMs: number;
    storagePath: string;
    storageBucket: string;
  };

  const [transcriptSnap, segmentsSnap, outputsSnap, actionItemsSnap] = await Promise.all([
    db.collection('recordings').doc(id).collection('transcripts').limit(1).get(),
    db.collection('recordings').doc(id).collection('transcript_segments').orderBy('startMs').get(),
    db.collection('recordings').doc(id).collection('ai_outputs').get(),
    db.collection('recordings').doc(id).collection('action_items').orderBy('createdAt').get(),
  ]);

  const transcript = transcriptSnap.docs[0]
    ? (() => {
        const d = transcriptSnap.docs[0].data();
        return {
          full_text: d.fullText as string,
          detected_locale: (d.detectedLocale as string) ?? null,
        };
      })()
    : null;
  const segments = segmentsSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      start_ms: data.startMs as number,
      end_ms: data.endMs as number,
      text: data.text as string,
      speaker_id: (data.speakerId as string) ?? null,
    };
  });
  const outputs = outputsSnap.docs.map((d) => {
    const data = d.data();
    return { kind: data.kind as string, payload: data.payload };
  });

  const actionItems = actionItemsSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      text: data.text as string,
      assignee: (data.assignee as string) ?? null,
      dueDate: (data.dueDate as string) ?? null,
      done: (data.done as boolean) ?? false,
    };
  });

  // Get a signed URL for the audio file
  let audioUrl = '';
  try {
    const storage = getServerStorage();
    const bucket = storage.bucket();
    const [url] = await bucket.file(recording.storagePath).getSignedUrl({
      action: 'read',
      expires: Date.now() + 3600 * 1000,
    });
    audioUrl = url;
  } catch {
    // Audio may not be uploaded yet
  }

  return (
    <div className="space-y-5">
      <section className="card px-6 py-7 sm:px-7">
        <Link
          href="/workspace/recordings"
          className="inline-flex items-center gap-2 text-sm text-mute transition hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para gravações
        </Link>

        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="eyebrow">Recording detail</span>
            <h1 className="display-title mt-5 text-5xl leading-[0.96]">
              {recording.title ?? recording.capturedAt.toDate().toLocaleString()}
            </h1>
            <p className="mt-4 max-w-3xl leading-8 text-mute">
              Áudio, transcript, resumo, capítulos, ações e chat reunidos na mesma superfície para
              revisão rápida.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-border bg-bg/55 p-4">
              <FileAudio className="h-5 w-5 text-accent" />
              <div className="mt-3 text-2xl font-semibold text-text">{recording.status}</div>
              <div className="mt-1 text-sm text-mute">Status atual</div>
            </div>
            <div className="rounded-[24px] border border-border bg-bg/55 p-4">
              <Clock3 className="h-5 w-5 text-accentSoft" />
              <div className="mt-3 text-2xl font-semibold text-text">
                {Math.round(recording.durationMs / 1000)}s
              </div>
              <div className="mt-1 text-sm text-mute">Duração</div>
            </div>
            <div className="rounded-[24px] border border-border bg-bg/55 p-4">
              <Sparkles className="h-5 w-5 text-ok" />
              <div className="mt-3 text-2xl font-semibold text-text">AI</div>
              <div className="mt-1 text-sm text-mute">Outputs vinculados</div>
            </div>
          </div>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <Player src={audioUrl} />
      </section>

      <section className="card p-5 sm:p-6">
        <RecordingTabs
          recordingId={id}
          transcript={transcript}
          segments={segments}
          outputs={outputs}
          actionItems={actionItems}
        />
      </section>
    </div>
  );
}
