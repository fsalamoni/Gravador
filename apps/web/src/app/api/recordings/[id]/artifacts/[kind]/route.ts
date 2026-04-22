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

type Params = { id: string; kind: string };

type UpdateArtifactBody = {
  payload?: unknown;
  provider?: string;
  model?: string;
  promptVersion?: string;
  locale?: string;
  latencyMs?: number | null;
  costCents?: number;
  artifactStatus?: 'active' | 'deleted';
};

async function getArtifactContext(req: Request, params: Promise<Params>) {
  const user = await getApiSessionUser(req);
  if (!user) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };

  const { id: recordingId, kind } = await params;
  if (!isAIOutputKind(kind)) {
    return { error: NextResponse.json({ error: 'invalid_kind' }, { status: 400 }) };
  }

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

  const artifactRef = access.ref.collection('ai_outputs').doc(kind);
  return { user, db, access, artifactRef, kind, recordingId };
}

export async function GET(req: Request, { params }: { params: Promise<Params> }) {
  const context = await getArtifactContext(req, params);
  if ('error' in context) return context.error;

  const artifactDoc = await context.artifactRef.get();
  if (!artifactDoc.exists) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const data = artifactDoc.data() ?? {};

  return NextResponse.json({
    id: artifactDoc.id,
    kind: data.kind,
    provider: data.provider ?? null,
    model: data.model ?? null,
    promptVersion: data.promptVersion ?? null,
    payload: data.payload,
    lifecycle: getArtifactLifecycleState(data),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<Params> }) {
  const context = await getArtifactContext(req, params);
  if ('error' in context) return context.error;

  const body = (await req.json()) as UpdateArtifactBody;
  const hasChanges =
    Object.prototype.hasOwnProperty.call(body, 'payload') ||
    typeof body.provider === 'string' ||
    typeof body.model === 'string' ||
    typeof body.promptVersion === 'string' ||
    typeof body.locale === 'string' ||
    typeof body.costCents === 'number' ||
    typeof body.latencyMs === 'number' ||
    body.latencyMs === null ||
    body.artifactStatus === 'active' ||
    body.artifactStatus === 'deleted';

  if (!hasChanges) {
    return NextResponse.json({ error: 'empty_update' }, { status: 400 });
  }

  const recordingLifecycle = getRecordingLifecycleState(context.access.data.lifecycle);

  try {
    await context.db.runTransaction(async (tx) => {
      const artifactSnap = await tx.get(context.artifactRef);
      if (!artifactSnap.exists) {
        throw new Error('artifact_not_found');
      }

      const current = artifactSnap.data() ?? {};
      const nextVersion =
        typeof current.artifactVersion === 'number' ? current.artifactVersion + 1 : 1;

      const artifactStatus =
        body.artifactStatus ?? (current.artifactStatus === 'deleted' ? 'deleted' : 'active');

      tx.set(
        context.artifactRef,
        {
          payload: Object.prototype.hasOwnProperty.call(body, 'payload')
            ? body.payload
            : current.payload,
          provider:
            (typeof body.provider === 'string' && body.provider.trim()) ||
            current.provider ||
            'manual',
          model: (typeof body.model === 'string' && body.model.trim()) || current.model || 'manual',
          promptVersion:
            (typeof body.promptVersion === 'string' && body.promptVersion.trim()) ||
            current.promptVersion ||
            'manual-v1',
          locale: (typeof body.locale === 'string' && body.locale.trim()) || current.locale || null,
          latencyMs:
            typeof body.latencyMs === 'number'
              ? body.latencyMs
              : body.latencyMs === null
                ? null
                : (current.latencyMs ?? null),
          costCents: typeof body.costCents === 'number' ? body.costCents : (current.costCents ?? 0),
          artifactStatus,
          artifactVersion: nextVersion,
          sourceRecordingVersion: recordingLifecycle.recordingVersion,
          deletedAt: artifactStatus === 'deleted' ? FieldValue.serverTimestamp() : null,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: context.user.uid,
        },
        { merge: true },
      );

      tx.set(
        context.access.ref,
        {
          updatedAt: FieldValue.serverTimestamp(),
          lifecycle: {
            schemaVersion: RECORDING_LIFECYCLE_SCHEMA_VERSION,
            lastEvent: 'artifact_updated',
            lastEventAt: FieldValue.serverTimestamp(),
            lastEventBy: context.user.uid,
          },
        },
        { merge: true },
      );
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'artifact_not_found') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    throw error;
  }

  const updated = await context.artifactRef.get();
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
    notificationEvent: getNotificationEventForLifecycleEvent('artifact_updated'),
  });
}

export async function POST(req: Request, { params }: { params: Promise<Params> }) {
  const context = await getArtifactContext(req, params);
  if ('error' in context) return context.error;

  try {
    await context.db.runTransaction(async (tx) => {
      const artifactSnap = await tx.get(context.artifactRef);
      if (!artifactSnap.exists) {
        throw new Error('artifact_not_found');
      }

      const current = artifactSnap.data() ?? {};
      const nextVersion =
        typeof current.artifactVersion === 'number' ? current.artifactVersion + 1 : 1;

      tx.set(
        context.artifactRef,
        {
          artifactStatus: 'active',
          artifactVersion: nextVersion,
          deletedAt: null,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: context.user.uid,
        },
        { merge: true },
      );

      tx.set(
        context.access.ref,
        {
          updatedAt: FieldValue.serverTimestamp(),
          lifecycle: {
            schemaVersion: RECORDING_LIFECYCLE_SCHEMA_VERSION,
            lastEvent: 'artifact_restored',
            lastEventAt: FieldValue.serverTimestamp(),
            lastEventBy: context.user.uid,
          },
        },
        { merge: true },
      );
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'artifact_not_found') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    throw error;
  }

  const updated = await context.artifactRef.get();
  return NextResponse.json({
    ok: true,
    item: updated.data() ?? {},
    notificationEvent: getNotificationEventForLifecycleEvent('artifact_restored'),
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<Params> }) {
  const context = await getArtifactContext(req, params);
  if ('error' in context) return context.error;

  try {
    await context.db.runTransaction(async (tx) => {
      const artifactSnap = await tx.get(context.artifactRef);
      if (!artifactSnap.exists) {
        throw new Error('artifact_not_found');
      }

      const current = artifactSnap.data() ?? {};
      const nextVersion =
        typeof current.artifactVersion === 'number' ? current.artifactVersion + 1 : 1;

      tx.set(
        context.artifactRef,
        {
          artifactStatus: 'deleted',
          artifactVersion: nextVersion,
          deletedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: context.user.uid,
        },
        { merge: true },
      );

      tx.set(
        context.access.ref,
        {
          updatedAt: FieldValue.serverTimestamp(),
          lifecycle: {
            schemaVersion: RECORDING_LIFECYCLE_SCHEMA_VERSION,
            lastEvent: 'artifact_deleted',
            lastEventAt: FieldValue.serverTimestamp(),
            lastEventBy: context.user.uid,
          },
        },
        { merge: true },
      );
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'artifact_not_found') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    throw error;
  }

  return NextResponse.json({
    ok: true,
    notificationEvent: getNotificationEventForLifecycleEvent('artifact_deleted'),
  });
}
