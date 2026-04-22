import {
  AUDIO_EDITING_JOB_KIND,
  AUDIO_EDITING_MAX_RETRIES,
  type AudioEditPreset,
} from '@/lib/audio-editing';
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

export async function enqueueAudioEditJob(
  db: Firestore,
  params: {
    recordingId: string;
    workspaceId: string;
    sourceVersionId: string;
    queuedVersionId: string;
    preset: AudioEditPreset;
    actorId: string;
    source?: string;
    maxAttempts?: number;
    attempt?: number;
    nextAttemptAt?: string | Date | null;
  },
) {
  const ref = await db.collection('jobs').add({
    recordingId: params.recordingId,
    workspaceId: params.workspaceId,
    kind: AUDIO_EDITING_JOB_KIND,
    status: 'queued',
    source: params.source ?? 'audio-editing-api',
    payload: {
      sourceVersionId: params.sourceVersionId,
      queuedVersionId: params.queuedVersionId,
      preset: params.preset,
      actorId: params.actorId,
      attempt: params.attempt ?? 0,
      maxAttempts: params.maxAttempts ?? AUDIO_EDITING_MAX_RETRIES,
    },
    metrics: {
      queuedAt: FieldValue.serverTimestamp(),
      processingLatencyMs: null,
      processingDurationMs: null,
    },
    scheduling: {
      nextAttemptAt: params.nextAttemptAt ?? null,
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}
