import { z } from 'zod';
import { isValidBulkDeleteConfirmationPhrase } from './bulk-delete-confirmation';

export const BULK_OPS_REQUEST_SCHEMA_VERSION = 1;
export const BULK_MERGE_DEFAULT_MODE = 'prepare';

export type BulkMergeMode = 'prepare' | 'execute';

const recordingIdSchema = z.string().trim().min(1);
const bulkDeleteConfirmationSchema = z.object({
  expectedCount: z.number().int().min(1).max(50),
  phrase: z.string().trim().min(1).max(64),
});

const bulkDeleteRequestSchema = z.object({
  schemaVersion: z.literal(BULK_OPS_REQUEST_SCHEMA_VERSION),
  operation: z.literal('delete'),
  recordingIds: z.array(recordingIdSchema).min(1).max(50),
  confirmation: bulkDeleteConfirmationSchema,
  reason: z.string().trim().max(280).optional(),
});

const bulkMergeRequestSchema = z.object({
  schemaVersion: z.literal(BULK_OPS_REQUEST_SCHEMA_VERSION),
  operation: z.literal('merge'),
  mode: z.enum(['prepare', 'execute']).default(BULK_MERGE_DEFAULT_MODE),
  primaryRecordingId: recordingIdSchema,
  secondaryRecordingId: recordingIdSchema,
  preserveArtifacts: z.literal('side_by_side'),
  reason: z.string().trim().max(280).optional(),
});

export const bulkOperationRequestSchema = z.discriminatedUnion('operation', [
  bulkDeleteRequestSchema,
  bulkMergeRequestSchema,
]);

export type BulkOperationRequest = z.infer<typeof bulkOperationRequestSchema>;

export interface BulkAuditEntry {
  schemaVersion: number;
  operation: BulkOperationRequest['operation'];
  mergeMode: BulkMergeMode | null;
  actorId: string;
  reason: string | null;
  recordingIds: string[];
  preserveArtifacts: 'side_by_side' | null;
}

export function parseBulkOperationRequest(input: unknown): BulkOperationRequest {
  const parsed = bulkOperationRequestSchema.parse(input);
  const idsToValidate =
    parsed.operation === 'merge'
      ? [parsed.primaryRecordingId, parsed.secondaryRecordingId]
      : parsed.recordingIds;
  for (const recordingId of idsToValidate) {
    if (recordingId.includes('/') || recordingId.includes('\\') || recordingId.includes('..')) {
      throw new Error('invalid_recording_id');
    }
  }
  if (parsed.operation === 'merge' && parsed.primaryRecordingId === parsed.secondaryRecordingId) {
    throw new Error('primary_and_secondary_must_differ');
  }
  if (parsed.operation === 'delete') {
    if (parsed.confirmation.expectedCount !== parsed.recordingIds.length) {
      throw new Error('delete_confirmation_count_mismatch');
    }
    if (
      !isValidBulkDeleteConfirmationPhrase(
        parsed.confirmation.phrase,
        parsed.confirmation.expectedCount,
      )
    ) {
      throw new Error('delete_confirmation_phrase_mismatch');
    }
  }
  return parsed;
}

export function buildBulkAuditEntry(
  actorId: string,
  request: BulkOperationRequest,
): BulkAuditEntry {
  if (request.operation === 'merge') {
    return {
      schemaVersion: BULK_OPS_REQUEST_SCHEMA_VERSION,
      operation: 'merge',
      mergeMode: request.mode,
      actorId,
      reason: request.reason ?? null,
      recordingIds: [request.primaryRecordingId, request.secondaryRecordingId],
      preserveArtifacts: request.preserveArtifacts,
    };
  }

  return {
    schemaVersion: BULK_OPS_REQUEST_SCHEMA_VERSION,
    operation: 'delete',
    mergeMode: null,
    actorId,
    reason: request.reason ?? null,
    recordingIds: request.recordingIds,
    preserveArtifacts: null,
  };
}
