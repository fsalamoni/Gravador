import { getApiSessionUser } from '@/lib/api-session';
import { getServerDb } from '@/lib/firebase-server';
import { getAccessibleRecording } from '@/lib/recording-access';
import {
  RECORDING_LIFECYCLE_SCHEMA_VERSION,
  getRecordingLifecycleState,
  getRecordingRetentionPolicy,
  toIsoTimestamp,
} from '@/lib/recording-lifecycle';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type LifecycleAction = 'archive' | 'unarchive' | 'trash' | 'restore' | 'bumpVersion';

function isLifecycleAction(value: string): value is LifecycleAction {
  return ['archive', 'unarchive', 'trash', 'restore', 'bumpVersion'].includes(value);
}

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

  return NextResponse.json({
    recordingId,
    deletedAt: toIsoTimestamp(
      access.data.deletedAt as { toDate?: () => Date } | Date | string | null | undefined,
    ),
    status: access.data.status,
    lifecycle: getRecordingLifecycleState(access.data.lifecycle),
    retention: getRecordingRetentionPolicy(access.data.retention),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiSessionUser(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id: recordingId } = await params;
  const body = (await req.json()) as { action?: string };
  if (!body.action || !isLifecycleAction(body.action)) {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  }

  const db = getServerDb();
  const access = await getAccessibleRecording(db, recordingId, user.uid);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.error === 'not_found' ? 404 : 403 },
    );
  }

  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    'lifecycle.schemaVersion': RECORDING_LIFECYCLE_SCHEMA_VERSION,
    'lifecycle.lastEventAt': FieldValue.serverTimestamp(),
    'lifecycle.lastEventBy': user.uid,
  };

  switch (body.action) {
    case 'archive': {
      updates['lifecycle.status'] = 'archived';
      updates['lifecycle.archivedAt'] = FieldValue.serverTimestamp();
      updates['lifecycle.lastEvent'] = 'archived';
      break;
    }
    case 'unarchive': {
      updates['lifecycle.status'] = 'active';
      updates['lifecycle.archivedAt'] = null;
      updates['lifecycle.lastEvent'] = 'unarchived';
      break;
    }
    case 'trash': {
      updates.deletedAt = FieldValue.serverTimestamp();
      updates['lifecycle.status'] = 'trashed';
      updates['lifecycle.trashedAt'] = FieldValue.serverTimestamp();
      updates['lifecycle.lastEvent'] = 'trashed';
      break;
    }
    case 'restore': {
      updates.deletedAt = null;
      updates['lifecycle.status'] = 'active';
      updates['lifecycle.trashedAt'] = null;
      updates['lifecycle.lastEvent'] = 'restored';
      break;
    }
    case 'bumpVersion': {
      updates['lifecycle.recordingVersion'] = FieldValue.increment(1);
      updates['lifecycle.retainedVersions'] = FieldValue.increment(1);
      updates['lifecycle.lastEvent'] = 'version_bumped';
      break;
    }
  }

  await access.ref.set(updates, { merge: true });

  const refreshed = await access.ref.get();
  const data = refreshed.data() ?? {};

  return NextResponse.json({
    ok: true,
    recordingId,
    deletedAt: toIsoTimestamp(
      data.deletedAt as { toDate?: () => Date } | Date | string | null | undefined,
    ),
    lifecycle: getRecordingLifecycleState(data.lifecycle),
    retention: getRecordingRetentionPolicy(data.retention),
  });
}
