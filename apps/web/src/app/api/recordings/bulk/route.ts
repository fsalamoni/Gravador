import { getApiSessionUser } from '@/lib/api-session';
import { buildSideBySideMergePlan } from '@/lib/bulk-merge';
import { buildBulkAuditEntry, parseBulkOperationRequest } from '@/lib/bulk-ops';
import type { BulkOperationRequest } from '@/lib/bulk-ops';
import { featureFlags } from '@/lib/feature-flags';
import { getServerDb } from '@/lib/firebase-server';
import { getAccessibleRecording } from '@/lib/recording-access';
import {
  RECORDING_LIFECYCLE_SCHEMA_VERSION,
  getRecordingLifecycleState,
  isAIOutputKind,
} from '@/lib/recording-lifecycle';
import { type DocumentReference, FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export const runtime = 'nodejs';

interface MergeArtifactDoc {
  kind: string;
  artifactStatus: 'active' | 'deleted';
  payload: unknown;
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
  locale: string | null;
  latencyMs: number | null;
  costCents: number;
  artifactVersion: number;
}

function toMergeArtifactDoc(
  raw: Record<string, unknown>,
  fallbackKind: string,
): MergeArtifactDoc | null {
  const kind = typeof raw.kind === 'string' ? raw.kind : fallbackKind;
  if (!isAIOutputKind(kind)) return null;

  return {
    kind,
    artifactStatus: raw.artifactStatus === 'deleted' ? 'deleted' : 'active',
    payload: raw.payload,
    provider: typeof raw.provider === 'string' && raw.provider.trim() ? raw.provider : null,
    model: typeof raw.model === 'string' && raw.model.trim() ? raw.model : null,
    promptVersion:
      typeof raw.promptVersion === 'string' && raw.promptVersion.trim() ? raw.promptVersion : null,
    locale: typeof raw.locale === 'string' && raw.locale.trim() ? raw.locale : null,
    latencyMs: typeof raw.latencyMs === 'number' ? raw.latencyMs : null,
    costCents: typeof raw.costCents === 'number' ? raw.costCents : 0,
    artifactVersion: typeof raw.artifactVersion === 'number' ? raw.artifactVersion : 1,
  };
}

async function listMergeArtifacts(recordingRef: DocumentReference) {
  const artifactsSnap = await recordingRef.collection('ai_outputs').get();
  return artifactsSnap.docs
    .map((doc) => {
      const data = doc.data();
      return toMergeArtifactDoc(data, doc.id);
    })
    .filter((artifact): artifact is MergeArtifactDoc => artifact !== null);
}

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
    execution: {
      mode: 'prepare',
      mergeMode: 'side_by_side',
    },
    createdAt: FieldValue.serverTimestamp(),
    createdBy: user.uid,
  });

  if (parsed.mode !== 'execute') {
    return NextResponse.json({
      ok: true,
      operationId: auditRef.id,
      operation: 'merge',
      mergeMode: 'side_by_side',
      executionMode: 'prepare',
      compareUrl: `/workspace/recordings/${parsed.primaryRecordingId}?mergeWith=${parsed.secondaryRecordingId}`,
    });
  }

  const [primaryArtifacts, secondaryArtifacts] = await Promise.all([
    listMergeArtifacts(primaryAccess.ref),
    listMergeArtifacts(secondaryAccess.ref),
  ]);

  const mergePlan = buildSideBySideMergePlan(primaryArtifacts, secondaryArtifacts);
  const secondaryByKind = new Map(secondaryArtifacts.map((artifact) => [artifact.kind, artifact]));

  const primaryLifecycle = getRecordingLifecycleState(primaryAccess.data.lifecycle);
  const primaryVersionBefore = primaryLifecycle.recordingVersion;
  const primaryVersionAfterIfCopied = primaryVersionBefore + 1;

  let copiedArtifactKinds: string[] = [];
  let primaryVersionAfter = primaryVersionBefore;

  await db.runTransaction(async (tx) => {
    const copiedInAttempt: string[] = [];

    for (const kind of mergePlan.copyFromSecondaryKinds) {
      const sourceArtifact = secondaryByKind.get(kind);
      if (!sourceArtifact) continue;

      const targetRef = primaryAccess.ref.collection('ai_outputs').doc(kind);
      const targetSnap = await tx.get(targetRef);
      if (targetSnap.exists) continue;

      copiedInAttempt.push(kind);
      tx.set(
        targetRef,
        {
          recordingId: parsed.primaryRecordingId,
          kind,
          payload: sourceArtifact.payload ?? null,
          provider: sourceArtifact.provider ?? 'merge',
          model: sourceArtifact.model ?? 'merge',
          promptVersion: sourceArtifact.promptVersion ?? 'merge-side-by-side-v1',
          locale: sourceArtifact.locale,
          latencyMs: sourceArtifact.latencyMs,
          costCents: sourceArtifact.costCents,
          artifactStatus: 'active',
          artifactVersion: 1,
          sourceRecordingVersion: primaryVersionAfterIfCopied,
          deletedAt: null,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: user.uid,
          createdAt: FieldValue.serverTimestamp(),
          mergeSource: {
            schemaVersion: 1,
            operationId: auditRef.id,
            preserveArtifacts: 'side_by_side',
            sourceRecordingId: parsed.secondaryRecordingId,
            sourceArtifactVersion: sourceArtifact.artifactVersion,
          },
        },
        { merge: true },
      );
    }

    const didCopy = copiedInAttempt.length > 0;
    const resolvedPrimaryVersion = didCopy ? primaryVersionAfterIfCopied : primaryVersionBefore;

    tx.set(
      primaryAccess.ref,
      {
        updatedAt: FieldValue.serverTimestamp(),
        lifecycle: didCopy
          ? {
              schemaVersion: RECORDING_LIFECYCLE_SCHEMA_VERSION,
              recordingVersion: resolvedPrimaryVersion,
              retainedVersions: Math.max(primaryLifecycle.retainedVersions, resolvedPrimaryVersion),
              lastEvent: 'version_bumped',
              lastEventAt: FieldValue.serverTimestamp(),
              lastEventBy: user.uid,
            }
          : {
              schemaVersion: RECORDING_LIFECYCLE_SCHEMA_VERSION,
              lastEvent: 'pipeline_updated',
              lastEventAt: FieldValue.serverTimestamp(),
              lastEventBy: user.uid,
            },
        merge: {
          schemaVersion: 1,
          lastOperationId: auditRef.id,
          lastExecutionMode: 'execute',
          preserveArtifacts: 'side_by_side',
          compareRecordingId: parsed.secondaryRecordingId,
          copiedArtifactKinds: copiedInAttempt,
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );

    tx.set(
      secondaryAccess.ref,
      {
        updatedAt: FieldValue.serverTimestamp(),
        merge: {
          schemaVersion: 1,
          lastOperationId: auditRef.id,
          lastExecutionMode: 'execute',
          preserveArtifacts: 'side_by_side',
          mergedIntoRecordingId: parsed.primaryRecordingId,
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );

    tx.set(
      auditRef,
      {
        ...audit,
        status: 'completed',
        primaryRecordingId: parsed.primaryRecordingId,
        secondaryRecordingId: parsed.secondaryRecordingId,
        execution: {
          mode: 'execute',
          mergeMode: 'side_by_side',
          primaryRecordingVersionBefore: primaryVersionBefore,
          primaryRecordingVersionAfter: resolvedPrimaryVersion,
          copiedArtifactKinds: copiedInAttempt,
          copyCandidateKinds: mergePlan.copyFromSecondaryKinds,
          planSummary: mergePlan.summary,
          planRows: mergePlan.rows,
        },
        processedCount: copiedInAttempt.length,
        skippedCount: Math.max(mergePlan.copyFromSecondaryKinds.length - copiedInAttempt.length, 0),
        createdAt: FieldValue.serverTimestamp(),
        createdBy: user.uid,
      },
      { merge: true },
    );

    copiedArtifactKinds = copiedInAttempt;
    primaryVersionAfter = resolvedPrimaryVersion;
  });

  return NextResponse.json({
    ok: true,
    operationId: auditRef.id,
    operation: 'merge',
    mergeMode: 'side_by_side',
    executionMode: 'execute',
    copied: copiedArtifactKinds.length,
    copiedArtifactKinds,
    copyCandidateKinds: mergePlan.copyFromSecondaryKinds,
    primaryRecordingVersionBefore: primaryVersionBefore,
    primaryRecordingVersionAfter: primaryVersionAfter,
    redirectUrl: `/workspace/recordings/${parsed.primaryRecordingId}?mergedFrom=${parsed.secondaryRecordingId}&mergeOperationId=${auditRef.id}`,
  });
}
