import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { getDb } from '@gravador/db';
import { FieldValue, type Firestore, Timestamp } from 'firebase-admin/firestore';

const AUDIO_EDITING_JOB_KIND = 'audio-editing';
const ACTIVE_JOB_STATUSES = new Set(['queued', 'retry_scheduled']);
const ALLOWED_PRESETS = new Set(['normalize_loudness', 'trim_silence', 'denoise']);
const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_QUERY_SIZE = 50;
const DEFAULT_POLL_INTERVAL_MS = 15_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 15_000;
const RETRY_MAX_DELAY_MS = 10 * 60_000;
const ERROR_SNIPPET_MAX = 500;

type AudioEditPreset = 'normalize_loudness' | 'trim_silence' | 'denoise';

type AudioEditJobPayload = {
  sourceVersionId?: string;
  queuedVersionId?: string;
  preset?: AudioEditPreset;
  actorId?: string;
  attempt?: number;
  maxAttempts?: number;
};

type AudioEditJobScheduling = {
  nextAttemptAt?: unknown;
};

type AudioEditJobDoc = {
  kind?: string;
  status?: string;
  recordingId?: string;
  payload?: AudioEditJobPayload;
  scheduling?: AudioEditJobScheduling;
};

type ClaimedAudioEditJob = {
  id: string;
  recordingId: string;
  payload: {
    sourceVersionId: string;
    queuedVersionId: string;
    preset: AudioEditPreset;
    actorId: string;
    attempt: number;
    maxAttempts: number;
  };
};

export type AudioEditBatchResult = {
  scanned: number;
  claimed: number;
  dispatched: number;
  skipped: number;
  failedDispatch: number;
};

function parseNumeric(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    try {
      return (value as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

function isDue(nextAttemptAt: unknown, now: Date): boolean {
  const dueAt = toDate(nextAttemptAt);
  if (!dueAt) return true;
  return dueAt.getTime() <= now.getTime();
}

function getRetryDelayMs(attempt: number): number {
  const exponent = Math.max(0, attempt - 1);
  const computed = RETRY_BASE_DELAY_MS * 2 ** exponent;
  return Math.min(computed, RETRY_MAX_DELAY_MS);
}

function truncateError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, ERROR_SNIPPET_MAX);
}

function parsePreset(value: unknown): AudioEditPreset | null {
  if (typeof value !== 'string') return null;
  if (!ALLOWED_PRESETS.has(value)) return null;
  return value as AudioEditPreset;
}

function getExecutorBaseUrl(): string {
  const baseUrl =
    process.env.AUDIO_EDIT_EXECUTOR_BASE_URL ??
    process.env.INTERNAL_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    '';
  if (!baseUrl) {
    throw new Error(
      'Missing AUDIO_EDIT_EXECUTOR_BASE_URL (or INTERNAL_APP_URL/NEXT_PUBLIC_APP_URL) for audio-editing runner.',
    );
  }
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

function getJobSecret(): string {
  const secret = process.env.INTERNAL_JOBS_SECRET ?? '';
  if (!secret) {
    throw new Error('Missing INTERNAL_JOBS_SECRET for audio-editing runner.');
  }
  return secret;
}

async function claimJob(
  db: Firestore,
  docRef: FirebaseFirestore.DocumentReference,
  workerId: string,
): Promise<ClaimedAudioEditJob | null> {
  const now = new Date();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) return null;

    const job = (snap.data() ?? {}) as AudioEditJobDoc;
    if (!ACTIVE_JOB_STATUSES.has(job.status ?? '')) {
      return null;
    }

    if (!isDue(job.scheduling?.nextAttemptAt, now)) {
      return null;
    }

    const recordingId = typeof job.recordingId === 'string' ? job.recordingId.trim() : '';
    const sourceVersionId =
      typeof job.payload?.sourceVersionId === 'string' ? job.payload.sourceVersionId.trim() : '';
    const queuedVersionId =
      typeof job.payload?.queuedVersionId === 'string' ? job.payload.queuedVersionId.trim() : '';
    const preset = parsePreset(job.payload?.preset);

    if (!recordingId || !sourceVersionId || !queuedVersionId || !preset) {
      tx.update(docRef, {
        status: 'failed',
        updatedAt: FieldValue.serverTimestamp(),
        'metrics.errorCode': 'invalid_job_payload',
        'metrics.failedAt': FieldValue.serverTimestamp(),
      });
      return null;
    }

    const attempt = Math.max(1, Math.floor(job.payload?.attempt ?? 1));
    const maxAttempts = Math.max(DEFAULT_MAX_ATTEMPTS, Math.floor(job.payload?.maxAttempts ?? 3));

    tx.update(docRef, {
      status: 'processing',
      updatedAt: FieldValue.serverTimestamp(),
      'worker.claimedBy': workerId,
      'worker.lastClaimedAt': FieldValue.serverTimestamp(),
      'metrics.startedAt': FieldValue.serverTimestamp(),
      'metrics.errorCode': null,
    });

    return {
      id: snap.id,
      recordingId,
      payload: {
        sourceVersionId,
        queuedVersionId,
        preset,
        actorId: typeof job.payload?.actorId === 'string' ? job.payload.actorId : 'system',
        attempt,
        maxAttempts,
      },
    };
  });
}

async function dispatchAudioEditJob(
  claimed: ClaimedAudioEditJob,
  executorBaseUrl: string,
  jobSecret: string,
) {
  const endpoint = `${executorBaseUrl}/api/recordings/${claimed.recordingId}/audio-editing`;
  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-gravador-job-secret': jobSecret,
    },
    body: JSON.stringify({
      action: 'process_job',
      queuedVersionId: claimed.payload.queuedVersionId,
      sourceVersionId: claimed.payload.sourceVersionId,
      preset: claimed.payload.preset,
      actorId: claimed.payload.actorId,
      attempt: claimed.payload.attempt,
      maxAttempts: claimed.payload.maxAttempts,
      jobId: claimed.id,
    }),
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    throw new Error(
      `audio_edit_executor_http_${response.status}: ${responseBody.slice(0, ERROR_SNIPPET_MAX)}`,
    );
  }
}

async function markDispatchFailure(
  db: Firestore,
  claimed: ClaimedAudioEditJob,
  error: unknown,
): Promise<void> {
  const canRetry = claimed.payload.attempt < claimed.payload.maxAttempts;
  const errorMessage = truncateError(error);

  if (!canRetry) {
    await db
      .collection('jobs')
      .doc(claimed.id)
      .set(
        {
          status: 'failed',
          updatedAt: FieldValue.serverTimestamp(),
          metrics: {
            failedAt: FieldValue.serverTimestamp(),
            errorCode: 'dispatch_failed',
            lastDispatchError: errorMessage,
            nextAttemptAt: null,
          },
        },
        { merge: true },
      );
    return;
  }

  const nextAttemptAt = new Date(Date.now() + getRetryDelayMs(claimed.payload.attempt));
  await db
    .collection('jobs')
    .doc(claimed.id)
    .set(
      {
        status: 'retry_scheduled',
        updatedAt: FieldValue.serverTimestamp(),
        payload: {
          attempt: claimed.payload.attempt + 1,
          maxAttempts: claimed.payload.maxAttempts,
        },
        scheduling: {
          nextAttemptAt,
        },
        metrics: {
          failedAt: FieldValue.serverTimestamp(),
          errorCode: 'dispatch_failed',
          lastDispatchError: errorMessage,
          nextAttemptAt,
        },
      },
      { merge: true },
    );
}

export async function processAudioEditJobBatch(params?: {
  batchSize?: number;
  queryLimit?: number;
}): Promise<AudioEditBatchResult> {
  const db = getDb();
  const batchSize = Math.max(1, params?.batchSize ?? DEFAULT_BATCH_SIZE);
  const queryLimit = Math.max(batchSize, params?.queryLimit ?? DEFAULT_QUERY_SIZE);
  const workerId = process.env.AUDIO_EDIT_RUNNER_ID || `audio-edit-runner-${randomUUID()}`;
  const executorBaseUrl = getExecutorBaseUrl();
  const jobSecret = getJobSecret();

  const snapshot = await db
    .collection('jobs')
    .where('kind', '==', AUDIO_EDITING_JOB_KIND)
    .limit(queryLimit)
    .get();

  let claimedCount = 0;
  let dispatchedCount = 0;
  let skippedCount = 0;
  let failedDispatchCount = 0;

  for (const doc of snapshot.docs) {
    if (claimedCount >= batchSize) {
      break;
    }

    const claimed = await claimJob(db, doc.ref, workerId);
    if (!claimed) {
      skippedCount++;
      continue;
    }

    claimedCount++;
    try {
      await dispatchAudioEditJob(claimed, executorBaseUrl, jobSecret);
      dispatchedCount++;
    } catch (error) {
      failedDispatchCount++;
      await markDispatchFailure(db, claimed, error);
      console.error('[audio-edit-runner] dispatch failed', {
        jobId: claimed.id,
        recordingId: claimed.recordingId,
        error: truncateError(error),
      });
    }
  }

  return {
    scanned: snapshot.size,
    claimed: claimedCount,
    dispatched: dispatchedCount,
    skipped: skippedCount,
    failedDispatch: failedDispatchCount,
  };
}

type RunnerCliOptions = {
  once: boolean;
  batchSize: number;
  queryLimit: number;
  intervalMs: number;
};

function parseCliOptions(argv: string[]): RunnerCliOptions {
  const once = argv.includes('--once');

  const readArg = (name: string): string | undefined => {
    const prefixed = argv.find((value) => value.startsWith(`${name}=`));
    if (prefixed) {
      return prefixed.split('=').slice(1).join('=');
    }
    const index = argv.indexOf(name);
    if (index >= 0 && index + 1 < argv.length) {
      return argv[index + 1];
    }
    return undefined;
  };

  const batchSize = parseNumeric(
    readArg('--batch-size') ?? process.env.AUDIO_EDIT_JOB_BATCH_SIZE,
    DEFAULT_BATCH_SIZE,
  );
  const queryLimit = parseNumeric(
    readArg('--query-limit') ?? process.env.AUDIO_EDIT_JOB_QUERY_LIMIT,
    DEFAULT_QUERY_SIZE,
  );
  const intervalMs = parseNumeric(
    readArg('--interval-ms') ?? process.env.AUDIO_EDIT_JOB_POLL_INTERVAL_MS,
    DEFAULT_POLL_INTERVAL_MS,
  );

  return {
    once,
    batchSize,
    queryLimit,
    intervalMs,
  };
}

async function runAudioEditRunner(options: RunnerCliOptions): Promise<void> {
  console.log('[audio-edit-runner] starting', {
    once: options.once,
    batchSize: options.batchSize,
    queryLimit: options.queryLimit,
    intervalMs: options.intervalMs,
  });

  for (;;) {
    const startedAt = Date.now();
    const result = await processAudioEditJobBatch({
      batchSize: options.batchSize,
      queryLimit: options.queryLimit,
    });

    console.log('[audio-edit-runner] batch completed', result);

    if (options.once) {
      return;
    }

    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(500, options.intervalMs - elapsed);
    await sleep(remaining);
  }
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  await runAudioEditRunner(options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('[audio-edit-runner] fatal error', error);
    process.exitCode = 1;
  });
}
