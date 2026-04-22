import { getApiSessionUser } from '@/lib/api-session';
import { buildBulkAuditEntry, parseBulkOperationRequest } from '@/lib/bulk-ops';
import type { BulkOperationRequest } from '@/lib/bulk-ops';
import { featureFlags } from '@/lib/feature-flags';
import { getServerDb } from '@/lib/firebase-server';
import { getAccessibleRecording } from '@/lib/recording-access';
import { RECORDING_LIFECYCLE_SCHEMA_VERSION } from '@/lib/recording-lifecycle';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!featureFlags.bulkOpsV1) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const user = await getApiSessionUser(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  let parsed: BulkOperationRequest;
  try {
    parsed = parseBulkOperationRequest(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_body', issues: error.issues }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'invalid_recording_id') {
      return NextResponse.json({ error: 'invalid_recording_id' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'primary_and_secondary_must_differ') {
      return NextResponse.json({ error: 'primary_and_secondary_must_differ' }, { status: 400 });
    }
    throw error;
  }

  const db = getServerDb();
  const audit = buildBulkAuditEntry(user.uid, parsed);
  const auditRef = db.collection('recording_bulk_ops').doc();

  if (parsed.operation === 'delete') {
    const updatedIds: string[] = [];
    const skippedIds: string[] = [];
    const uniqueIds = [...new Set(parsed.recordingIds)];
    if (uniqueIds.length !== parsed.recordingIds.length) {
      return NextResponse.json({ error: 'duplicate_recording_ids' }, { status: 400 });
    }

    for (const recordingId of uniqueIds) {
      const access = await getAccessibleRecording(db, recordingId, user.uid);
      if (!access.ok || access.data.createdBy !== user.uid) {
        skippedIds.push(recordingId);
        continue;
      }

      await access.ref.set(
        {
          deletedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          lifecycle: {
            schemaVersion: RECORDING_LIFECYCLE_SCHEMA_VERSION,
            status: 'trashed',
            trashedAt: FieldValue.serverTimestamp(),
            lastEvent: 'trashed',
            lastEventAt: FieldValue.serverTimestamp(),
            lastEventBy: user.uid,
          },
        },
        { merge: true },
      );

      updatedIds.push(recordingId);
    }

    await auditRef.set({
      ...audit,
      status: 'completed',
      processedCount: updatedIds.length,
      skippedCount: skippedIds.length,
      processedIds: updatedIds,
      skippedIds,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: user.uid,
    });

    return NextResponse.json({
      ok: true,
      operationId: auditRef.id,
      operation: 'delete',
      processed: updatedIds.length,
      skipped: skippedIds.length,
      processedIds: updatedIds,
      skippedIds,
    });
  }

  const [primaryAccess, secondaryAccess] = await Promise.all([
    getAccessibleRecording(db, parsed.primaryRecordingId, user.uid),
    getAccessibleRecording(db, parsed.secondaryRecordingId, user.uid),
  ]);

  if (!primaryAccess.ok || !secondaryAccess.ok) {
    return NextResponse.json({ error: 'recording_not_accessible' }, { status: 403 });
  }

  const primaryWorkspaceId = String(primaryAccess.data.workspaceId ?? '');
  const secondaryWorkspaceId = String(secondaryAccess.data.workspaceId ?? '');
  if (!primaryWorkspaceId || primaryWorkspaceId !== secondaryWorkspaceId) {
    return NextResponse.json({ error: 'workspace_mismatch' }, { status: 400 });
  }

  await auditRef.set({
    ...audit,
    status: 'planned',
    primaryRecordingId: parsed.primaryRecordingId,
    secondaryRecordingId: parsed.secondaryRecordingId,
    mergeMode: 'side_by_side',
    createdAt: FieldValue.serverTimestamp(),
    createdBy: user.uid,
  });

  return NextResponse.json({
    ok: true,
    operationId: auditRef.id,
    operation: 'merge',
    mergeMode: 'side_by_side',
    compareUrl: `/workspace/recordings/${parsed.primaryRecordingId}?mergeWith=${parsed.secondaryRecordingId}`,
  });
}
