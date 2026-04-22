import { z } from 'zod';

export type AudioVersionStatus = 'ready' | 'queued' | 'failed';
export type AudioEditPreset = 'normalize_loudness' | 'trim_silence' | 'denoise';

export interface AudioVersionRecord {
  id: string;
  versionNumber: number;
  status: AudioVersionStatus;
  storagePath: string | null;
  storageBucket: string | null;
  isOriginal: boolean;
  sourceVersionId: string | null;
  editPreset: AudioEditPreset | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export const AUDIO_EDITING_SCHEMA_VERSION = 1;

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
