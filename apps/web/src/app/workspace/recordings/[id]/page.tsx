import { getEditVersionParityReport } from '@/lib/edit-version-parity';
import { getServerDb, getServerStorage, getSessionUser } from '@/lib/firebase-server';
import { getAccessibleRecording } from '@/lib/recording-access';
import {
  getArtifactLifecycleState,
  getRecordingLifecycleState,
  toIsoTimestamp,
} from '@/lib/recording-lifecycle';
import { getTimelineParityReport } from '@/lib/timeline-parity';
import { ArrowLeft, Clock3, FileAudio, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { LifecyclePanel } from './lifecycle-panel';
import { PipelinePanel } from './pipeline-panel';
import { Player } from './player';
import { RecordingTabs } from './tabs';

export default async function RecordingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mergeWith?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const db = getServerDb();

  const access = await getAccessibleRecording(db, id, user.uid);
  if (!access.ok) notFound();

  const recording = { id: access.ref.id, ...access.data } as {
    id: string;
    title?: string;
    capturedAt: { toDate: () => Date };
    status: string;
    durationMs: number;
    storagePath: string;
    storageBucket: string;
    deletedAt?: { toDate?: () => Date } | null;
    lifecycle?: unknown;
    pipelineResults?: Record<string, 'ok' | 'failed'>;
  };

  const lifecycle = getRecordingLifecycleState(recording.lifecycle);

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
  const artifactRows = outputsSnap.docs
    .map((d) => {
      const data = d.data();
      const lifecycleData = getArtifactLifecycleState(data);
      if (!lifecycleData) return null;

      return {
        kind: data.kind as string,
        payload: data.payload,
        artifactStatus: lifecycleData.artifactStatus,
        artifactVersion: lifecycleData.artifactVersion,
        sourceRecordingVersion: lifecycleData.sourceRecordingVersion,
        updatedAt: lifecycleData.updatedAt,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const outputs = artifactRows
    .filter((artifact) => artifact.artifactStatus !== 'deleted')
    .map((artifact) => ({ kind: artifact.kind, payload: artifact.payload }));

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

  const timelineParity = getTimelineParityReport(recording.durationMs, segments);
  const editVersionParity = getEditVersionParityReport(
    lifecycle.recordingVersion,
    artifactRows.map((artifact) => ({
      kind: artifact.kind,
      artifactStatus: artifact.artifactStatus,
      sourceRecordingVersion: artifact.sourceRecordingVersion,
    })),
  );

  const mergeWithId = typeof query.mergeWith === 'string' ? query.mergeWith : null;
  const mergeComparison =
    mergeWithId && mergeWithId !== id
      ? await (async () => {
          const compareAccess = await getAccessibleRecording(db, mergeWithId, user.uid);
          if (!compareAccess.ok) return null;

          const compareArtifactsSnap = await compareAccess.ref
            .collection('ai_outputs')
            .orderBy('kind')
            .get();

          const compareArtifacts = compareArtifactsSnap.docs
            .map((doc) => {
              const data = doc.data();
              const parsed = getArtifactLifecycleState(data);
              if (!parsed) return null;
              return {
                kind: parsed.kind,
                artifactStatus: parsed.artifactStatus,
                artifactVersion: parsed.artifactVersion,
                sourceRecordingVersion: parsed.sourceRecordingVersion,
                updatedAt: parsed.updatedAt,
              };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

          const currentByKind = new Map<string, (typeof artifactRows)[number]>(
            artifactRows.map((artifact) => [artifact.kind, artifact]),
          );
          const compareByKind = new Map<string, (typeof compareArtifacts)[number]>(
            compareArtifacts.map((artifact) => [artifact.kind, artifact]),
          );
          const kinds = [...new Set([...currentByKind.keys(), ...compareByKind.keys()])].sort();

          return {
            compareRecordingId: mergeWithId,
            rows: kinds.map((kind) => ({
              kind,
              current: currentByKind.get(kind) ?? null,
              compare: compareByKind.get(kind) ?? null,
            })),
          };
        })()
      : null;

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
        <Player src={audioUrl} expectedDurationMs={recording.durationMs} />
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-text">Timeline and waveform parity</h2>
          <span className="text-xs uppercase tracking-[0.2em] text-mute">Phase 2 checks</span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-[20px] border border-border bg-bg/55 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-mute">Segments</div>
            <div className="mt-2 text-2xl font-semibold text-text">
              {timelineParity.segmentCount}
            </div>
          </div>
          <div className="rounded-[20px] border border-border bg-bg/55 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-mute">First Start</div>
            <div className="mt-2 text-2xl font-semibold text-text">
              {timelineParity.firstStartMs === null
                ? 'n/a'
                : `${Math.round(timelineParity.firstStartMs / 1000)}s`}
            </div>
          </div>
          <div className="rounded-[20px] border border-border bg-bg/55 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-mute">Last End</div>
            <div className="mt-2 text-2xl font-semibold text-text">
              {timelineParity.lastEndMs === null
                ? 'n/a'
                : `${Math.round(timelineParity.lastEndMs / 1000)}s`}
            </div>
          </div>
          <div className="rounded-[20px] border border-border bg-bg/55 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-mute">Duration Delta</div>
            <div className="mt-2 text-2xl font-semibold text-text">
              {timelineParity.durationDeltaMs === null
                ? 'n/a'
                : `${Math.round(timelineParity.durationDeltaMs / 1000)}s`}
            </div>
          </div>
        </div>

        {timelineParity.warnings.length > 0 ? (
          <div className="mt-4 rounded-[20px] border border-warning/45 bg-warning/10 px-4 py-3 text-sm text-warning">
            <p className="font-medium">Parity alerts</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {timelineParity.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mt-4 rounded-[20px] border border-ok/35 bg-ok/10 px-4 py-3 text-sm text-ok">
            Timeline and waveform parity checks look healthy.
          </div>
        )}

        <div className="mt-4 rounded-[20px] border border-border bg-bg/55 px-4 py-3 text-sm">
          <p className="font-medium text-text">
            Edit/version parity • recording v{editVersionParity.recordingVersion}
          </p>
          <p className="mt-1 text-mute">
            {editVersionParity.activeArtifactCount} artifact(s) ativos,{' '}
            {editVersionParity.staleArtifactCount} desatualizados,{' '}
            {editVersionParity.futureArtifactCount} futuros.
          </p>
          {editVersionParity.warnings.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-warning">
              {editVersionParity.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      {mergeComparison ? (
        <section className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-text">Merge artifact comparison</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-mute">Side-by-side</span>
          </div>
          <p className="mt-2 text-sm text-mute">
            Comparando gravação atual com <code>{mergeComparison.compareRecordingId}</code>. O merge
            preserva artefatos sem sobrescrever payloads.
          </p>
          <div className="mt-4 space-y-2">
            {mergeComparison.rows.map((row) => (
              <div
                key={row.kind}
                className="grid gap-2 rounded-[16px] border border-border bg-bg/55 p-3 md:grid-cols-3"
              >
                <div className="text-sm font-medium text-text">{row.kind}</div>
                <div className="rounded-[12px] border border-border bg-bg/70 p-2 text-xs text-mute">
                  {row.current ? (
                    <>
                      <p className="font-medium text-text">Atual</p>
                      <p>
                        {row.current.artifactStatus} • v{row.current.artifactVersion} • src v
                        {row.current.sourceRecordingVersion}
                      </p>
                    </>
                  ) : (
                    <p>Sem artefato</p>
                  )}
                </div>
                <div className="rounded-[12px] border border-border bg-bg/70 p-2 text-xs text-mute">
                  {row.compare ? (
                    <>
                      <p className="font-medium text-text">Merge candidate</p>
                      <p>
                        {row.compare.artifactStatus} • v{row.compare.artifactVersion} • src v
                        {row.compare.sourceRecordingVersion}
                      </p>
                    </>
                  ) : (
                    <p>Sem artefato</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <LifecyclePanel
        recordingId={id}
        deletedAt={toIsoTimestamp(recording.deletedAt)}
        initialLifecycle={lifecycle}
        initialArtifacts={artifactRows.map((artifact) => ({
          kind: artifact.kind,
          artifactStatus: artifact.artifactStatus,
          artifactVersion: artifact.artifactVersion,
          updatedAt: artifact.updatedAt,
        }))}
      />

      <section className="card p-5 sm:p-6">
        <PipelinePanel
          recordingId={id}
          hasTranscript={!!transcript}
          initialPipelineResults={recording.pipelineResults ?? {}}
        />
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
