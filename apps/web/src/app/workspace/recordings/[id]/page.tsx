import { getServerDb, getServerStorage } from '@/lib/firebase-server';
import { notFound } from 'next/navigation';
import { Player } from './player';
import { RecordingTabs } from './tabs';

export default async function RecordingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getServerDb();

  const recDoc = await db.collection('recordings').doc(id).get();
  if (!recDoc.exists) notFound();
  const recording = { id: recDoc.id, ...recDoc.data() } as {
    id: string;
    title?: string;
    capturedAt: { toDate: () => Date };
    status: string;
    durationMs: number;
    storagePath: string;
    storageBucket: string;
  };

  const [transcriptSnap, segmentsSnap, outputsSnap] = await Promise.all([
    db.collection('recordings').doc(id).collection('transcripts').limit(1).get(),
    db.collection('recordings').doc(id).collection('transcript_segments').orderBy('startMs').get(),
    db.collection('recordings').doc(id).collection('ai_outputs').get(),
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
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold">
        {recording.title ?? recording.capturedAt.toDate().toLocaleString()}
      </h1>
      <div className="text-mute mt-1">
        {recording.status} · {Math.round(recording.durationMs / 1000)}s
      </div>

      <div className="mt-6 card p-4">
        <Player src={audioUrl} />
      </div>

      <div className="mt-6">
        <RecordingTabs
          recordingId={id}
          transcript={transcript}
          segments={segments}
          outputs={outputs}
        />
      </div>
    </div>
  );
}
