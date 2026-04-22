import { z } from 'zod';

export type AudioVersionStatus = 'ready' | 'queued' | 'failed';
export type AudioEditPreset = 'normalize_loudness' | 'trim_silence' | 'denoise';
export type AudioEditJobStatus =
  | 'queued'
  | 'processing'
  | 'retry_scheduled'
  | 'completed'
  | 'failed';

export interface AudioVersionRecord {
  id: string;
  versionNumber: number;
  status: AudioVersionStatus;
  processingState: 'queued' | 'processing' | 'completed' | 'failed' | null;
  failureReason: string | null;
  storagePath: string | null;
  storageBucket: string | null;
  isOriginal: boolean;
  sourceVersionId: string | null;
  editPreset: AudioEditPreset | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export const AUDIO_EDITING_SCHEMA_VERSION = 1;
export const AUDIO_EDITING_JOB_KIND = 'audio-editing';
export const AUDIO_EDITING_MAX_RETRIES = 3;
export const AUDIO_EDITING_BASE_RETRY_DELAY_MS = 15_000;
export const AUDIO_EDITING_MAX_RETRY_DELAY_MS = 10 * 60_000;

const queueEditRequestSchema = z.object({
  action: z.literal('queue_edit'),
  preset: z.enum(['normalize_loudness', 'trim_silence', 'denoise']),
  sourceVersionId: z.string().trim().min(1).optional(),
});

const rollbackRequestSchema = z.object({
  action: z.literal('rollback'),
  targetVersionId: z.string().trim().min(1),
});

export const audioEditingRequestSchema = z.discriminatedUnion('action', [
  queueEditRequestSchema,
  rollbackRequestSchema,
]);

export type AudioEditingRequest = z.infer<typeof audioEditingRequestSchema>;

export function parseAudioEditingRequest(input: unknown): AudioEditingRequest {
  return audioEditingRequestSchema.parse(input);
}

export function getNextAudioVersionNumber(existing: Array<{ versionNumber: number }>): number {
  const maxVersion = existing.reduce((max, item) => {
    if (!Number.isFinite(item.versionNumber)) return max;
    return Math.max(max, Math.floor(item.versionNumber));
  }, 0);
  return maxVersion + 1;
}

const FILTER_BY_PRESET: Record<AudioEditPreset, string> = {
  normalize_loudness: 'loudnorm=I=-16:TP=-1.5:LRA=11',
  trim_silence:
    'silenceremove=start_periods=1:start_duration=0.25:start_threshold=-45dB:stop_periods=1:stop_duration=0.25:stop_threshold=-45dB',
  denoise: 'afftdn=nf=-28',
};

export function getFfmpegFilterForPreset(preset: AudioEditPreset): string {
  return FILTER_BY_PRESET[preset];
}

export function getVersionedAudioStoragePath(params: {
  sourcePath: string;
  versionId: string;
}): string {
  const normalized = params.sourcePath.replace(/\\/g, '/').trim();
  const sourceDir =
    normalized.includes('/') && normalized.lastIndexOf('/') > 0
      ? normalized.slice(0, normalized.lastIndexOf('/'))
      : '';
  if (!sourceDir) return `audio_versions/${params.versionId}.m4a`;
  return `${sourceDir}/audio_versions/${params.versionId}.m4a`;
}

export function getAudioEditRetryDelayMs(attempt: number): number {
  const normalizedAttempt = Math.max(1, Math.floor(attempt));
  return Math.min(
    AUDIO_EDITING_MAX_RETRY_DELAY_MS,
    AUDIO_EDITING_BASE_RETRY_DELAY_MS * 2 ** (normalizedAttempt - 1),
  );
}
