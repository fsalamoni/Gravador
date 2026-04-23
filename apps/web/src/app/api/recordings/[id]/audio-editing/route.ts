import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getApiSessionUser } from '@/lib/api-session';
import {
  AUDIO_EDITING_MAX_RETRIES,
  AUDIO_EDITING_SCHEMA_VERSION,
  type AudioEditJobStatus,
  type AudioEditingRequest,
  type AudioVersionRecord,
  getAudioEditRetryDelayMs,
  getFfmpegFilterForPreset,
  getNextAudioVersionNumber,
  getVersionedAudioStoragePath,
  parseAudioEditingRequest,
} from '@/lib/audio-editing';
import { featureFlags } from '@/lib/feature-flags';
import { getServerDb, getServerStorage } from '@/lib/firebase-server';
import { enqueueAudioEditJob } from '@/lib/jobs';
import { enqueueNotificationEvent } from '@/lib/notification-queue';
import { getAccessibleRecording } from '@/lib/recording-access';
import {
  RECORDING_LIFECYCLE_SCHEMA_VERSION,
  getNotificationEventForAudioEditState,
  getRecordingLifecycleState,
  toIsoTimestamp,
} from '@/lib/recording-lifecycle';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Keep FFmpeg bounded at 180s so route maxDuration=300s keeps ~120s headroom for download/upload/Firestore.
const FFMPEG_TIMEOUT_MS = 180_000;

type AudioVersionDoc = {
  versionNumber?: number;
  status?: 'ready' | 'queued' | 'failed';
  storagePath?: string | null;
  storageBucket?: string | null;
  isOriginal?: boolean;
  sourceVersionId?: string | null;
  editPreset?: 'normalize_loudness' | 'trim_silence' | 'denoise' | null;
  ffmpeg?: {
    state?: AudioEditJobStatus;
    error?: string;
    attempt?: number;
    maxAttempts?: number;
    nextAttemptAt?: { toDate?: () => Date } | Date | string | null;
    queuedAt?: { toDate?: () => Date } | Date | string | null;
    startedAt?: { toDate?: () => Date } | Date | string | null;
    completedAt?: { toDate?: () => Date } | Date | string | null;
    failedAt?: { toDate?: () => Date } | Date | string | null;
  } | null;
  createdAt?: { toDate?: () => Date } | Date | string | null;
  updatedAt?: { toDate?: () => Date } | Date | string | null;
};

/**
 * Limits persisted error payload size to keep Firestore documents bounded.
 */
function truncateErrorMessage(message: string): string {
  return message.slice(0, 500);
}

async function runFfmpegCommand(params: {
  inputPath: string;
  outputPath: string;
  preset: 'normalize_loudness' | 'trim_silence' | 'denoise';
}) {
  const filter = getFfmpegFilterForPreset(params.preset);
  const args = [
    '-y',
    '-i',
    params.inputPath,
    '-af',
    filter,
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-vn',
    params.outputPath,
  ];

  const output = await new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, FFMPEG_TIMEOUT_MS);

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        resolve({ code: null, stderr: `${stderr}\nffmpeg timed out` });
        return;
      }
      resolve({ code, stderr });
    });
  });

  if (output.code !== 0) {
    console.error('[audio-edit] ffmpeg execution failed', {
      code: output.code,
      stderr: truncateErrorMessage(output.stderr || 'unknown_error'),
    });
    throw new Error(output.code === null ? 'ffmpeg_timed_out' : 'ffmpeg_failed');
  }
}

async function processQueuedAudioEdit(params: {
  recordingRef: FirebaseFirestore.DocumentReference;
  recordingData: Record<string, unknown>;
  queuedVersionId: string;
  sourceVersionId: string;
  preset: 'normalize_loudness' | 'trim_silence' | 'denoise';
  actorId: string;
  attempt: number;
  maxAttempts: number;
}) {
  const versionsRef = params.recordingRef.collection('audio_versions');
  const queuedRef = versionsRef.doc(params.queuedVersionId);
  const sourceRef = versionsRef.doc(params.sourceVersionId);
  const storage = getServerStorage();
  const startedAt = Date.now();

  let tempDir = '';
  try {
    const sourceSnap = await sourceRef.get();
    if (!sourceSnap.exists) {
      throw new Error('source_version_not_found');
    }
    const sourceData = sourceSnap.data() as AudioVersionDoc;
    const source = serializeVersion(sourceSnap.id, sourceData);
    if (!source.storagePath || source.status !== 'ready') {
      throw new Error('source_version_not_ready');
    }

    await queuedRef.set(
      {
        status: 'queued',
        ffmpeg: {
          pipeline: 'server-side',
          state: 'processing',
          startedAt: FieldValue.serverTimestamp(),
          attempt: params.attempt,
          maxAttempts: params.maxAttempts,
          nextAttemptAt: null,
          error: null,
        },
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: params.actorId,
      },
      { merge: true },
    );

    tempDir = await mkdtemp(join(tmpdir(), 'gravador-audio-edit-'));
    const inputPath = join(tempDir, 'input-audio');
    const outputPath = join(tempDir, `output-${params.queuedVersionId}.m4a`);

    const sourceBucketName =
      source.storageBucket ||
      (typeof params.recordingData.storageBucket === 'string'
        ? params.recordingData.storageBucket
        : null);
    const sourceBucket = sourceBucketName ? storage.bucket(sourceBucketName) : storage.bucket();
    const [sourceUrl] = await sourceBucket.file(source.storagePath).getSignedUrl({
      action: 'read',
      expires: Date.now() + 30 * 60 * 1000,
    });

    const sourceRes = await fetch(sourceUrl);
    if (!sourceRes.ok) {
      throw new Error(`source_download_failed:${sourceRes.status}`);
    }

    const sourceBuffer = Buffer.from(await sourceRes.arrayBuffer());
    await writeFile(inputPath, sourceBuffer);

    await runFfmpegCommand({
      inputPath,
      outputPath,
      preset: params.preset,
    });

    const outputBuffer = await readFile(outputPath);
    const outputStoragePath = getVersionedAudioStoragePath({
      sourcePath: source.storagePath,
      versionId: params.queuedVersionId,
    });
    const outputBucketName =
      sourceBucketName ||
      (typeof params.recordingData.storageBucket === 'string'
        ? params.recordingData.storageBucket
        : null);
    const outputBucket = outputBucketName ? storage.bucket(outputBucketName) : storage.bucket();

    await outputBucket.file(outputStoragePath).save(outputBuffer, {
      resumable: false,
      contentType: 'audio/mp4',
      metadata: {
        metadata: {
          recordingId: params.recordingRef.id,
          audioVersionId: params.queuedVersionId,
          sourceVersionId: params.sourceVersionId,
          preset: params.preset,
        },
      },
    });

    await queuedRef.set(
      {
        status: 'ready',
        storagePath: outputStoragePath,
        storageBucket: outputBucket.name,
        ffmpeg: {
          pipeline: 'server-side',
          state: 'completed',
          completedAt: FieldValue.serverTimestamp(),
          attempt: params.attempt,
          maxAttempts: params.maxAttempts,
          nextAttemptAt: null,
          error: null,
        },
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: params.actorId,
      },
      { merge: true },
    );

    await params.recordingRef.set(
      {
        updatedAt: FieldValue.serverTimestamp(),
        lifecycle: {
          schemaVersion: RECORDING_LIFECYCLE_SCHEMA_VERSION,
          activeAudioVersionId: params.queuedVersionId,
          lastEvent: 'version_bumped',
          lastEventAt: FieldValue.serverTimestamp(),
          lastEventBy: params.actorId,
        },
      },
      { merge: true },
    );

    const processingDurationMs = Date.now() - startedAt;
    console.info('[audio-edit] processing completed', {
      recordingId: params.recordingRef.id,
      versionId: params.queuedVersionId,
      preset: params.preset,
      durationMs: processingDurationMs,
      attempt: params.attempt,
    });
    return {
      ok: true as const,
      durationMs: processingDurationMs,
      error: null,
      canRetry: false as const,
      nextAttemptAt: null,
      nextAttemptDelayMs: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'audio_edit_failed';
    const safeError = truncateErrorMessage(message);
    const canRetry = params.attempt < params.maxAttempts;
    const nextAttemptDelayMs = canRetry ? getAudioEditRetryDelayMs(params.attempt) : null;
    const nextAttemptAt = nextAttemptDelayMs ? new Date(Date.now() + nextAttemptDelayMs) : null;
    await versionsRef.doc(params.queuedVersionId).set(
      {
        status: canRetry ? 'queued' : 'failed',
        ffmpeg: {
          pipeline: 'server-side',
          state: canRetry ? 'retry_scheduled' : 'failed',
          failedAt: FieldValue.serverTimestamp(),
          nextAttemptAt,
          attempt: params.attempt,
          maxAttempts: params.maxAttempts,
          error: safeError,
        },
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: params.actorId,
      },
      { merge: true },
    );
    const processingDurationMs = Date.now() - startedAt;
    console.error('[audio-edit] processing failed', {
      recordingId: params.recordingRef.id,
      versionId: params.queuedVersionId,
      preset: params.preset,
      durationMs: processingDurationMs,
      attempt: params.attempt,
      canRetry,
      error: safeError,
    });
    return {
      ok: false as const,
      durationMs: processingDurationMs,
      error: safeError,
      canRetry,
      nextAttemptAt: nextAttemptAt?.toISOString() ?? null,
      nextAttemptDelayMs,
    };
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch((cleanupError) => {
        console.error('[audio-edit] temp cleanup failed', {
          recordingId: params.recordingRef.id,
          versionId: params.queuedVersionId,
          error: cleanupError instanceof Error ? cleanupError.message : 'unknown_cleanup_error',
        });
      });
    }
  }
}

function serializeVersion(id: string, data: AudioVersionDoc): AudioVersionRecord {
  return {
    id,
    versionNumber: typeof data.versionNumber === 'number' ? data.versionNumber : 1,
    status:
      data.status === 'queued' || data.status === 'failed' || data.status === 'ready'
        ? data.status
        : 'ready',
    processingState:
      data.ffmpeg?.state === 'queued' ||
      data.ffmpeg?.state === 'processing' ||
      data.ffmpeg?.state === 'completed' ||
      data.ffmpeg?.state === 'failed'
        ? data.ffmpeg.state
        : null,
    failureReason: typeof data.ffmpeg?.error === 'string' ? data.ffmpeg.error : null,
    storagePath: typeof data.storagePath === 'string' ? data.storagePath : null,
    storageBucket: typeof data.storageBucket === 'string' ? data.storageBucket : null,
    isOriginal: data.isOriginal === true,
    sourceVersionId: typeof data.sourceVersionId === 'string' ? data.sourceVersionId : null,
    editPreset:
      data.editPreset === 'normalize_loudness' ||
      data.editPreset === 'trim_silence' ||
      data.editPreset === 'denoise'
        ? data.editPreset
        : null,
    createdAt: toIsoTimestamp(data.createdAt),
    updatedAt: toIsoTimestamp(data.updatedAt),
  };
}

async function ensureOriginalVersion(params: {
  recordingRef: FirebaseFirestore.DocumentReference;
  recordingData: Record<string, unknown>;
  activeAudioVersionId: string | null;
  actorId: string;
}) {
  const versionsRef = params.recordingRef.collection('audio_versions');
  if (params.activeAudioVersionId) {
    const currentActive = await versionsRef.doc(params.activeAudioVersionId).get();
    if (currentActive.exists) return;
  }

  const originalId = params.activeAudioVersionId?.trim()
    ? params.activeAudioVersionId
    : params.recordingRef.id;

  await versionsRef.doc(originalId).set(
    {
      versionNumber: 1,
      status: 'ready',
      isOriginal: true,
      sourceVersionId: null,
      editPreset: null,
      storagePath:
        typeof params.recordingData.storagePath === 'string'
          ? params.recordingData.storagePath
          : null,
      storageBucket:
        typeof params.recordingData.storageBucket === 'string'
          ? params.recordingData.storageBucket
          : null,
      retention: {
        keepOriginal: true,
        keepEditedVersions: true,
        manualDeleteOnly: true,
      },
      schemaVersion: AUDIO_EDITING_SCHEMA_VERSION,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: params.actorId,
      updatedBy: params.actorId,
    },
    { merge: true },
  );
}

async function getContext(req: Request, params: Promise<{ id: string }>) {
  if (!featureFlags.audioEditingV1) {
    return { error: NextResponse.json({ error: 'not_found' }, { status: 404 }) };
  }

  const user = await getApiSessionUser(req);
  if (!user) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };

  const { id: recordingId } = await params;
  const db = getServerDb();
  const access = await getAccessibleRecording(db, recordingId, user.uid);
  if (!access.ok) {
    return {
      error: NextResponse.json(
        { error: access.error },
        { status: access.error === 'not_found' ? 404 : 403 },
      ),
    };
  }

  const lifecycle = getRecordingLifecycleState(access.data.lifecycle);
  await ensureOriginalVersion({
    recordingRef: access.ref,
    recordingData: access.data as Record<string, unknown>,
    activeAudioVersionId: lifecycle.activeAudioVersionId,
    actorId: user.uid,
  });

  return { user, access };
}

function canRunAudioJob(req: Request): boolean {
  const expected = process.env.INTERNAL_JOBS_SECRET?.trim();
  if (!expected) return false;
  const provided = req.headers.get('x-gravador-job-secret')?.trim();
  return Boolean(provided && provided === expected);
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getContext(req, params);
  if ('error' in context) return context.error;

  const lifecycle = getRecordingLifecycleState(context.access.data.lifecycle);
  const versionsSnap = await context.access.ref
    .collection('audio_versions')
    .orderBy('versionNumber', 'desc')
    .get();

  return NextResponse.json({
    recordingId: context.access.ref.id,
    activeAudioVersionId: lifecycle.activeAudioVersionId ?? context.access.ref.id,
    retention: {
      keepOriginal: true,
      keepEditedVersions: true,
      manualDeleteOnly: true,
    },
    items: versionsSnap.docs.map((doc) => serializeVersion(doc.id, doc.data() as AudioVersionDoc)),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getContext(req, params);
  if ('error' in context) return context.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  let parsed: AudioEditingRequest;
  try {
    parsed = parseAudioEditingRequest(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_body', issues: error.issues }, { status: 400 });
    }
    throw error;
  }

  const versionsRef = context.access.ref.collection('audio_versions');
  const lifecycle = getRecordingLifecycleState(context.access.data.lifecycle);

  if (parsed.action === 'rollback') {
    const targetRef = versionsRef.doc(parsed.targetVersionId);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      return NextResponse.json({ error: 'target_version_not_found' }, { status: 404 });
    }

    const target = serializeVersion(targetSnap.id, targetSnap.data() as AudioVersionDoc);
    if (target.status !== 'ready') {
      return NextResponse.json({ error: 'target_version_not_ready' }, { status: 400 });
    }

    await context.access.ref.set(
      {
        updatedAt: FieldValue.serverTimestamp(),
        lifecycle: {
          schemaVersion: RECORDING_LIFECYCLE_SCHEMA_VERSION,
          activeAudioVersionId: target.id,
          lastEvent: 'version_bumped',
          lastEventAt: FieldValue.serverTimestamp(),
          lastEventBy: context.user.uid,
        },
      },
      { merge: true },
    );

    return NextResponse.json({
      ok: true,
      action: 'rollback',
      activeAudioVersionId: target.id,
      target,
    });
  }

  const versionsSnap = await versionsRef.orderBy('versionNumber', 'desc').limit(100).get();
  const existing = versionsSnap.docs.map((doc) => {
    const data = doc.data() as AudioVersionDoc;
    return {
      id: doc.id,
      versionNumber: typeof data.versionNumber === 'number' ? data.versionNumber : 1,
    };
  });

  const nextVersionNumber = getNextAudioVersionNumber(existing);
  const sourceVersionId =
    parsed.sourceVersionId ?? lifecycle.activeAudioVersionId ?? context.access.ref.id;
  const queuedRef = versionsRef.doc();

  await queuedRef.set({
    versionNumber: nextVersionNumber,
    status: 'queued',
    isOriginal: false,
    sourceVersionId,
    editPreset: parsed.preset,
    ffmpeg: {
      pipeline: 'server-side',
      state: 'queued',
      queuedAt: FieldValue.serverTimestamp(),
    },
    retention: {
      keepOriginal: true,
      keepEditedVersions: true,
      manualDeleteOnly: true,
    },
    storagePath: null,
    storageBucket: null,
    schemaVersion: AUDIO_EDITING_SCHEMA_VERSION,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: context.user.uid,
    updatedBy: context.user.uid,
  });

  await context.access.ref.set(
    {
      updatedAt: FieldValue.serverTimestamp(),
      retention: {
        keepOriginal: true,
        keepEditedVersions: true,
        manualDeleteOnly: true,
      },
      lifecycle: {
        schemaVersion: RECORDING_LIFECYCLE_SCHEMA_VERSION,
        recordingVersion: FieldValue.increment(1),
        retainedVersions: FieldValue.increment(1),
        activeAudioVersionId: lifecycle.activeAudioVersionId ?? context.access.ref.id,
        lastEvent: 'version_bumped',
        lastEventAt: FieldValue.serverTimestamp(),
        lastEventBy: context.user.uid,
      },
    },
    { merge: true },
  );

  const workspaceId = String(context.access.data.workspaceId ?? '');
  const jobId = await enqueueAudioEditJob(getServerDb(), {
    recordingId: context.access.ref.id,
    workspaceId,
    sourceVersionId,
    queuedVersionId: queuedRef.id,
    preset: parsed.preset,
    actorId: context.user.uid,
  });

  const queueNotificationEvent = featureFlags.notificationsV1
    ? getNotificationEventForAudioEditState('queued')
    : null;

  if (queueNotificationEvent) {
    try {
      await enqueueNotificationEvent({
        db: getServerDb(),
        event: queueNotificationEvent,
        recordingId: context.access.ref.id,
        workspaceId,
        actorId: context.user.uid,
        source: 'recording_audio_edit',
        metadata: {
          action: 'queue_edit',
          preset: parsed.preset,
          queuedVersionId: queuedRef.id,
          sourceVersionId,
          jobId,
        },
      });
    } catch (error) {
      console.error('[recordings:audio-editing] unable to enqueue notification event', {
        recordingId: context.access.ref.id,
        action: 'queue_edit',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    action: 'queue_edit',
    status: 'queued',
    jobId,
    queuedVersionId: queuedRef.id,
    nextVersionNumber,
    sourceVersionId,
    preset: parsed.preset,
    notificationEvent: queueNotificationEvent,
  });
}

type AudioEditProcessRequest = {
  action: 'process_job';
  queuedVersionId: string;
  sourceVersionId: string;
  preset: 'normalize_loudness' | 'trim_silence' | 'denoise';
  actorId?: string;
  attempt?: number;
  maxAttempts?: number;
  jobId?: string;
};

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!featureFlags.audioEditingV1) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (!canRunAudioJob(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as AudioEditProcessRequest | null;
  if (
    !body ||
    body.action !== 'process_job' ||
    !body.queuedVersionId ||
    !body.sourceVersionId ||
    !body.preset
  ) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { id: recordingId } = await params;
  const db = getServerDb();
  const recordingRef = db.collection('recordings').doc(recordingId);
  const recordingSnap = await recordingRef.get();
  if (!recordingSnap.exists) {
    return NextResponse.json({ error: 'recording_not_found' }, { status: 404 });
  }
  const recordingData = (recordingSnap.data() ?? {}) as Record<string, unknown>;
  const workspaceId = String(recordingData.workspaceId ?? '');
  const actorId = body.actorId?.trim() || String(recordingData.createdBy ?? 'system');
  const attempt = Math.max(1, Math.floor(body.attempt ?? 1));
  const maxAttempts = Math.max(1, Math.floor(body.maxAttempts ?? AUDIO_EDITING_MAX_RETRIES));
  const startedAt = Date.now();

  if (body.jobId) {
    await db
      .collection('jobs')
      .doc(body.jobId)
      .set(
        {
          status: 'processing',
          updatedAt: FieldValue.serverTimestamp(),
          payload: {
            queuedVersionId: body.queuedVersionId,
            sourceVersionId: body.sourceVersionId,
            preset: body.preset,
            actorId,
            attempt,
            maxAttempts,
          },
          metrics: {
            startedAt: FieldValue.serverTimestamp(),
            processingLatencyMs: null,
          },
        },
        { merge: true },
      );
  }

  const result = await processQueuedAudioEdit({
    recordingRef,
    recordingData,
    queuedVersionId: body.queuedVersionId,
    sourceVersionId: body.sourceVersionId,
    preset: body.preset,
    actorId,
    attempt,
    maxAttempts,
  });

  const processingDurationMs = Date.now() - startedAt;
  if (body.jobId) {
    await db
      .collection('jobs')
      .doc(body.jobId)
      .set(
        {
          status: result.ok ? 'completed' : result.canRetry ? 'retry_scheduled' : 'failed',
          updatedAt: FieldValue.serverTimestamp(),
          metrics: {
            completedAt: FieldValue.serverTimestamp(),
            processingDurationMs,
            errorCode: result.ok ? null : result.error,
            nextAttemptAt: result.ok ? null : result.nextAttemptAt,
          },
        },
        { merge: true },
      );
  }

  if (!result.ok && result.canRetry) {
    await enqueueAudioEditJob(db, {
      recordingId,
      workspaceId,
      sourceVersionId: body.sourceVersionId,
      queuedVersionId: body.queuedVersionId,
      preset: body.preset,
      actorId,
      source: 'audio-editing-retry',
      maxAttempts,
      attempt: attempt + 1,
      nextAttemptAt: result.nextAttemptAt,
    });
  }

  const processNotificationEvent = featureFlags.notificationsV1
    ? getNotificationEventForAudioEditState(
        result.ok ? 'completed' : result.canRetry ? 'retry_scheduled' : 'failed',
      )
    : null;

  if (processNotificationEvent) {
    try {
      await enqueueNotificationEvent({
        db,
        event: processNotificationEvent,
        recordingId,
        workspaceId,
        actorId,
        source: 'recording_audio_edit',
        metadata: {
          action: 'process_job',
          queuedVersionId: body.queuedVersionId,
          sourceVersionId: body.sourceVersionId,
          preset: body.preset,
          attempt,
          maxAttempts,
          retryScheduled: !result.ok && result.canRetry,
          error: result.ok ? null : result.error,
        },
      });
    } catch (error) {
      console.error('[recordings:audio-editing] unable to enqueue notification event', {
        recordingId,
        action: 'process_job',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({
    ok: result.ok,
    recordingId,
    queuedVersionId: body.queuedVersionId,
    sourceVersionId: body.sourceVersionId,
    preset: body.preset,
    attempt,
    maxAttempts,
    processingDurationMs,
    retryScheduled: !result.ok && result.canRetry,
    nextAttemptAt: result.ok ? null : result.nextAttemptAt,
    error: result.ok ? null : result.error,
    notificationEvent: processNotificationEvent,
  });
}
