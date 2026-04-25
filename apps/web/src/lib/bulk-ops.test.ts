import { describe, expect, it } from 'vitest';
import { buildBulkDeleteConfirmationPhrase } from './bulk-delete-confirmation';
import { buildBulkAuditEntry, parseBulkOperationRequest } from './bulk-ops';

describe('bulk ops schema contracts', () => {
  it('parses delete payload and builds audit entry', () => {
    const parsed = parseBulkOperationRequest({
      schemaVersion: 1,
      operation: 'delete',
      recordingIds: ['rec-a', 'rec-b'],
      confirmation: {
        expectedCount: 2,
        phrase: buildBulkDeleteConfirmationPhrase(2),
      },
      reason: 'cleanup',
    });

    const audit = buildBulkAuditEntry('user-1', parsed);
    expect(audit.operation).toBe('delete');
    expect(audit.mergeMode).toBeNull();
    expect(audit.recordingIds).toEqual(['rec-a', 'rec-b']);
    expect(audit.preserveArtifacts).toBeNull();
  });

  it('parses merge payload and keeps side-by-side artifacts contract', () => {
    const parsed = parseBulkOperationRequest({
      schemaVersion: 1,
      operation: 'merge',
      primaryRecordingId: 'rec-a',
      secondaryRecordingId: 'rec-b',
      preserveArtifacts: 'side_by_side',
    });

    expect(parsed.operation).toBe('merge');
    if (parsed.operation !== 'merge') {
      throw new Error('expected merge operation');
    }
    expect(parsed.mode).toBe('prepare');

    const audit = buildBulkAuditEntry('user-1', parsed);
    expect(audit.operation).toBe('merge');
    expect(audit.mergeMode).toBe('prepare');
    expect(audit.recordingIds).toEqual(['rec-a', 'rec-b']);
    expect(audit.preserveArtifacts).toBe('side_by_side');
  });

  it('parses merge execution mode explicitly', () => {
    const parsed = parseBulkOperationRequest({
      schemaVersion: 1,
      operation: 'merge',
      mode: 'execute',
      primaryRecordingId: 'rec-a',
      secondaryRecordingId: 'rec-b',
      preserveArtifacts: 'side_by_side',
    });

    expect(parsed.operation).toBe('merge');
    if (parsed.operation !== 'merge') {
      throw new Error('expected merge operation');
    }
    expect(parsed.mode).toBe('execute');
  });

  it('rejects merge payload with duplicated recording ids', () => {
    expect(() =>
      parseBulkOperationRequest({
        schemaVersion: 1,
        operation: 'merge',
        primaryRecordingId: 'rec-a',
        secondaryRecordingId: 'rec-a',
        preserveArtifacts: 'side_by_side',
      }),
    ).toThrow();
  });

  it('rejects payloads with unsafe recording id path segments', () => {
    expect(() =>
      parseBulkOperationRequest({
        schemaVersion: 1,
        operation: 'delete',
        recordingIds: ['rec-a', '../etc/passwd'],
        confirmation: {
          expectedCount: 2,
          phrase: buildBulkDeleteConfirmationPhrase(2),
        },
      }),
    ).toThrow();
  });

  it('rejects delete payload when confirmation count mismatches selected ids', () => {
    expect(() =>
      parseBulkOperationRequest({
        schemaVersion: 1,
        operation: 'delete',
        recordingIds: ['rec-a', 'rec-b'],
        confirmation: {
          expectedCount: 3,
          phrase: buildBulkDeleteConfirmationPhrase(3),
        },
      }),
    ).toThrow();
  });

  it('rejects delete payload when confirmation phrase is invalid', () => {
    expect(() =>
      parseBulkOperationRequest({
        schemaVersion: 1,
        operation: 'delete',
        recordingIds: ['rec-a', 'rec-b'],
        confirmation: {
          expectedCount: 2,
          phrase: 'CONFIRM 2',
        },
      }),
    ).toThrow();
  });
});
