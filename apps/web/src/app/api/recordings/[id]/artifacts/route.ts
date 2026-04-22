import { getApiSessionUser } from '@/lib/api-session';
import { getServerDb } from '@/lib/firebase-server';
import { getAccessibleRecording } from '@/lib/recording-access';
import {
  RECORDING_LIFECYCLE_SCHEMA_VERSION,
  getArtifactLifecycleState,
  getNotificationEventForLifecycleEvent,
  getRecordingLifecycleState,
  isAIOutputKind,
} from '@/lib/recording-lifecycle';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type CreateArtifactBody = {
  kind?: string;
  payload?: unknown;
  provider?: string;
  model?: string;
  promptVersion?: string;
  locale?: string;
  latencyMs?: number;
  costCents?: number;
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiSessionUser(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id: recordingId } = await params;
  const db = getServerDb();
  const access = await getAccessibleRecording(db, recordingId, user.uid);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.error === 'not_found' ? 404 : 403 },
    );
  }

  const artifactsSnap = await access.ref.collection('ai_outputs').orderBy('kind').get();

  const items = artifactsSnap.docs.map((doc) => {
    const data = doc.data();
    const lifecycle = getArtifactLifecycleState(data);

    return {
      id: doc.id,
      kind: data.kind,
      provider: data.provider ?? null,
      model: data.model ?? null,
      promptVersion: data.promptVersion ?? null,
      hasPayload: Object.prototype.hasOwnProperty.call(data, 'payload'),
      payload: data.payload,
      lifecycle,
    };
  });

  return NextResponse.json({
    recordingId,
    recordingLifecycle: getRecordingLifecycleState(access.data.lifecycle),
    items,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiSessionUser(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id: recordingId } = await params;
  const body = (await req.json()) as CreateArtifactBody;

  if (!body.kind || !isAIOutputKind(body.kind)) {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 });
  }
  if (!Object.prototype.hasOwnProperty.call(body, 'payload')) {
    return NextResponse.json({ error: 'missing_payload' }, { status: 400 });
  }

  const db = getServerDb();
  const access = await getAccessibleRecording(db, recordingId, user.uid);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.error === 'not_found' ? 404 : 403 },
    );
  }

  const recordingLifecycle = getRecordingLifecycleState(access.data.lifecycle);
  const artifactRef = access.ref.collection('ai_outputs').doc(body.kind);

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(artifactRef);
    const existingData = existing.data() ?? {};
    const nextVersion =
      typeof existingData.artifactVersion === 'number' ? existingData.artifactVersion + 1 : 1;

    tx.set(
      artifactRef,
      {
        recordingId,
        kind: body.kind,
        payload: body.payload,
        provider:
          (typeof body.provider === 'string' && body.provider.trim()) ||
          existingData.provider ||
          'manual',
        model:
          (typeof body.model === 'string' && body.model.trim()) || existingData.model || 'manual',
        promptVersion:
          (typeof body.promptVersion === 'string' && body.promptVersion.trim()) ||
          existingData.promptVersion ||
          'manual-v1',
        latencyMs:
          typeof body.latencyMs === 'number' ? body.latencyMs : (existingData.latencyMs ?? null),
        costCents:
          typeof body.costCents === 'number' ? body.costCents : (existingData.costCents ?? 0),
        locale:
          (typeof body.locale === 'string' && body.locale.trim()) || existingData.locale || null,
        artifactVersion: nextVersion,
        artifactStatus: 'active',
        sourceRecordingVersion: recordingLifecycle.recordingVersion,
        deletedAt: null,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: user.uid,
        createdAt: existingData.createdAt ?? FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    tx.set(
      access.ref,
      {
        updatedAt: FieldValue.serverTimestamp(),
        lifecycle: {
          schemaVersion: RECORDING_LIFECYCLE_SCHEMA_VERSION,
          lastEvent: 'artifact_created',
          lastEventAt: FieldValue.serverTimestamp(),
          lastEventBy: user.uid,
        },
      },
      { merge: true },
    );
  });

  const updated = await artifactRef.get();
  const data = updated.data() ?? {};

  return NextResponse.json({
    ok: true,
    item: {
      id: updated.id,
      kind: data.kind,
      provider: data.provider ?? null,
      model: data.model ?? null,
      promptVersion: data.promptVersion ?? null,
      payload: data.payload,
      lifecycle: getArtifactLifecycleState(data),
    },
    notificationEvent: getNotificationEventForLifecycleEvent('artifact_created'),
  });
}
