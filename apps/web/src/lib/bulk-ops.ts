import { z } from 'zod';

export const BULK_OPS_REQUEST_SCHEMA_VERSION = 1;

const recordingIdSchema = z.string().trim().min(1);

const bulkDeleteRequestSchema = z.object({
  schemaVersion: z.literal(BULK_OPS_REQUEST_SCHEMA_VERSION),
  operation: z.literal('delete'),
  recordingIds: z.array(recordingIdSchema).min(1).max(50),
  reason: z.string().trim().max(280).optional(),
});

const bulkMergeRequestSchema = z.object({
  schemaVersion: z.literal(BULK_OPS_REQUEST_SCHEMA_VERSION),
  operation: z.literal('merge'),
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
      actorId,
      reason: request.reason ?? null,
      recordingIds: [request.primaryRecordingId, request.secondaryRecordingId],
      preserveArtifacts: request.preserveArtifacts,
    };
  }

  return {
    schemaVersion: BULK_OPS_REQUEST_SCHEMA_VERSION,
    operation: 'delete',
    actorId,
    reason: request.reason ?? null,
    recordingIds: request.recordingIds,
    preserveArtifacts: null,
  };
}
