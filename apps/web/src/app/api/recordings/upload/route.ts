import { getApiSessionUser } from '@/lib/api-session';
import { getServerDb, getServerStorage } from '@/lib/firebase-server';
import { canAccessWorkspace } from '@/lib/recording-access';
import { getDefaultRecordingLifecycle, getDefaultRetentionPolicy } from '@/lib/recording-lifecycle';
import { shortId } from '@gravador/core';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 524 * 1024 * 1024;

function parseDurationMs(raw: FormDataEntryValue | null): number {
  if (typeof raw !== 'string') return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function isFileEntry(value: FormDataEntryValue | null): value is File {
  return typeof File !== 'undefined' && value instanceof File;
}

export async function POST(req: Request) {
  const user = await getApiSessionUser(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const workspaceId = String(form.get('workspaceId') ?? '').trim();
  const durationMs = parseDurationMs(form.get('durationMs'));
  const mimeHint = String(form.get('mimeType') ?? '')
    .trim()
    .toLowerCase();
  const audioEntry = form.get('audio');

  if (!workspaceId) {
    return NextResponse.json({ error: 'missing_workspace_id' }, { status: 400 });
  }

  if (!isFileEntry(audioEntry)) {
    return NextResponse.json({ error: 'missing_audio_file' }, { status: 400 });
  }

  if (audioEntry.size <= 0) {
    return NextResponse.json({ error: 'empty_audio_file' }, { status: 400 });
  }

  if (audioEntry.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'audio_too_large' }, { status: 413 });
  }

  const mimeType = (audioEntry.type || mimeHint || 'audio/mp4').toLowerCase();
  if (!mimeType.startsWith('audio/')) {
    return NextResponse.json({ error: 'invalid_audio_mime_type' }, { status: 400 });
  }

  const db = getServerDb();
  const canUpload = await canAccessWorkspace(db, workspaceId, user.uid);
  if (!canUpload) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const recordingSeedId = shortId();
  const storagePath = `anotes/audio-raw/${workspaceId}/${recordingSeedId}.m4a`;
  const storageBuffer = Buffer.from(await audioEntry.arrayBuffer());

  const bucket = getServerStorage().bucket();
  await bucket.file(storagePath).save(storageBuffer, {
    resumable: false,
    contentType: mimeType,
    metadata: {
      metadata: {
        source: 'web-recorder',
        workspaceId,
        createdBy: user.uid,
      },
    },
  });

  const lifecycle = getDefaultRecordingLifecycle({
    source: 'web',
    recordingId: recordingSeedId,
    actorId: user.uid,
  });

  const recordingRef = db.collection('recordings').doc();
  await recordingRef.set({
    workspaceId,
    createdBy: user.uid,
    status: 'uploaded',
    durationMs,
    sizeBytes: audioEntry.size,
    mimeType,
    storagePath,
    storageBucket: 'default',
    capturedAt: new Date(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    deletedAt: null,
    pipelineResults: {},
    lifecycle: {
      ...lifecycle,
      lastEventAt: FieldValue.serverTimestamp(),
    },
    retention: getDefaultRetentionPolicy(),
  });

  return NextResponse.json({ ok: true, recordingId: recordingRef.id, storagePath });
}
