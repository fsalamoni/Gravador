import { type App, deleteApp, getApps, initializeApp } from 'firebase-admin/app';
import { type Firestore, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetApiSessionUser, mockGetServerDb } = vi.hoisted(() => ({
  mockGetApiSessionUser: vi.fn(),
  mockGetServerDb: vi.fn(),
}));

vi.mock('@/lib/api-session', () => ({
  getApiSessionUser: mockGetApiSessionUser,
}));

vi.mock('@/lib/firebase-server', () => ({
  getServerDb: mockGetServerDb,
}));

import { DELETE, POST, PATCH as patchArtifact } from './[id]/artifacts/[kind]/route';
import { PATCH as patchLifecycle } from './[id]/lifecycle/route';

const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const describeIfEmulator = FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'demo-gravador-web';
const DATABASE_ID = '(default)';
const APP_NAME = `gravador-web-emulator-tests-${PROJECT_ID}`;

let db: Firestore;
let app: App;

function lifecycleRequest(action: string, recordingId = 'rec-emulator') {
  return new Request(`https://test.local/api/recordings/${recordingId}/lifecycle`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action }),
  });
}

function artifactRequest(
  method: 'PATCH' | 'POST' | 'DELETE',
  recordingId = 'rec-emulator',
  kind = 'mindmap',
  body?: Record<string, unknown>,
) {
  return new Request(`https://test.local/api/recordings/${recordingId}/artifacts/${kind}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function clearFirestoreEmulator() {
  if (!FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST is required for emulator route tests');
  }

  const encodedDb = encodeURIComponent(DATABASE_ID);
  const url = `http://${FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/${encodedDb}/documents`;
  const response = await fetch(url, { method: 'DELETE' });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Unable to clear Firestore emulator data (${response.status}): ${body}`);
  }
}

async function seedRecording(options?: {
  recordingId?: string;
  workspaceId?: string;
  ownerId?: string;
  createdBy?: string;
  memberId?: string;
}) {
  const recordingId = options?.recordingId ?? 'rec-emulator';
  const workspaceId = options?.workspaceId ?? 'ws-emulator';
  const ownerId = options?.ownerId ?? 'owner-1';
  const createdBy = options?.createdBy ?? ownerId;

  await db.collection('workspaces').doc(workspaceId).set({
    ownerId,
    createdAt: Timestamp.now(),
  });

  if (options?.memberId) {
    await db
      .collection('workspaces')
      .doc(workspaceId)
      .collection('members')
      .doc(options.memberId)
      .set({
        role: 'member',
        createdAt: Timestamp.now(),
      });
  }

  await db
    .collection('recordings')
    .doc(recordingId)
    .set({
      workspaceId,
      createdBy,
      status: 'ready',
      deletedAt: null,
      lifecycle: {
        schemaVersion: 1,
        status: 'active',
        recordingVersion: 1,
        retainedVersions: 1,
        lastEvent: 'created',
      },
      retention: {
        keepOriginal: true,
        keepEditedVersions: true,
        manualDeleteOnly: true,
        purgeAfterDays: null,
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

  return { recordingId, workspaceId, ownerId, createdBy };
}

async function seedArtifact(recordingId = 'rec-emulator', kind = 'mindmap') {
  await db
    .collection('recordings')
    .doc(recordingId)
    .collection('ai_outputs')
    .doc(kind)
    .set({
      recordingId,
      kind,
      payload: { nodes: 2 },
      provider: 'provider-a',
      model: 'model-a',
      promptVersion: 'v1',
      artifactStatus: 'active',
      artifactVersion: 1,
      sourceRecordingVersion: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
}

describeIfEmulator('recording routes against Firestore Emulator', () => {
  beforeAll(() => {
    const existing = getApps().find((candidate) => candidate.name === APP_NAME);
    app = existing ?? initializeApp({ projectId: PROJECT_ID }, APP_NAME);
    db = getFirestore(app);
  });

  beforeEach(async () => {
    await clearFirestoreEmulator();
    vi.clearAllMocks();
    mockGetServerDb.mockReturnValue(db as never);
    mockGetApiSessionUser.mockResolvedValue({ uid: 'owner-1' });
  });

  it('persists lifecycle transitions and version bump with emulator timestamps', async () => {
    const { recordingId } = await seedRecording();

    const archiveResponse = await patchLifecycle(lifecycleRequest('archive', recordingId), {
      params: Promise.resolve({ id: recordingId }),
    });
    expect(archiveResponse.status).toBe(200);

    const trashResponse = await patchLifecycle(lifecycleRequest('trash', recordingId), {
      params: Promise.resolve({ id: recordingId }),
    });
    expect(trashResponse.status).toBe(200);

    const restoreResponse = await patchLifecycle(lifecycleRequest('restore', recordingId), {
      params: Promise.resolve({ id: recordingId }),
    });
    expect(restoreResponse.status).toBe(200);

    const bumpResponse = await patchLifecycle(lifecycleRequest('bumpVersion', recordingId), {
      params: Promise.resolve({ id: recordingId }),
    });
    expect(bumpResponse.status).toBe(200);

    const body = (await bumpResponse.json()) as {
      lifecycle: {
        status: string;
        recordingVersion: number;
        retainedVersions: number;
        lastEvent: string;
      };
      notificationEvent: string | null;
    };

    expect(body.notificationEvent).toBe('recording.lifecycle.version_bumped');
    expect(body.lifecycle.status).toBe('active');
    expect(body.lifecycle.recordingVersion).toBe(2);
    expect(body.lifecycle.retainedVersions).toBe(2);
    expect(body.lifecycle.lastEvent).toBe('version_bumped');

    const persisted = (await db.collection('recordings').doc(recordingId).get()).data() as {
      deletedAt?: unknown;
      lifecycle?: {
        status?: string;
        lastEvent?: string;
        lastEventBy?: string;
        lastEventAt?: unknown;
      };
    };

    expect(persisted.deletedAt).toBeNull();
    expect(persisted.lifecycle?.status).toBe('active');
    expect(persisted.lifecycle?.lastEvent).toBe('version_bumped');
    expect(persisted.lifecycle?.lastEventBy).toBe('owner-1');
    expect(persisted.lifecycle?.lastEventAt).toBeInstanceOf(Timestamp);
  });

  it('runs artifact delete/restore/update transactions against emulator', async () => {
    const { recordingId } = await seedRecording();
    await seedArtifact(recordingId, 'mindmap');

    const deleteResponse = (await DELETE(artifactRequest('DELETE', recordingId, 'mindmap'), {
      params: Promise.resolve({ id: recordingId, kind: 'mindmap' }),
    })) as Response;
    expect(deleteResponse.status).toBe(200);

    const restoreResponse = (await POST(artifactRequest('POST', recordingId, 'mindmap'), {
      params: Promise.resolve({ id: recordingId, kind: 'mindmap' }),
    })) as Response;
    expect(restoreResponse.status).toBe(200);

    const patchResponse = (await patchArtifact(
      artifactRequest('PATCH', recordingId, 'mindmap', {
        payload: { nodes: 9 },
        provider: 'provider-b',
        model: 'model-b',
        promptVersion: 'v2',
        artifactStatus: 'deleted',
      }),
      {
        params: Promise.resolve({ id: recordingId, kind: 'mindmap' }),
      },
    )) as Response;
    expect(patchResponse.status).toBe(200);

    const patchBody = (await patchResponse.json()) as {
      notificationEvent: string | null;
      item: {
        payload?: unknown;
        provider?: string;
        model?: string;
        promptVersion?: string;
        lifecycle?: {
          artifactStatus?: string;
          artifactVersion?: number;
          deletedAt?: string | null;
        };
      };
    };

    expect(patchBody.notificationEvent).toBe('recording.artifact.updated');
    expect(patchBody.item.payload).toEqual({ nodes: 9 });
    expect(patchBody.item.provider).toBe('provider-b');
    expect(patchBody.item.model).toBe('model-b');
    expect(patchBody.item.promptVersion).toBe('v2');
    expect(patchBody.item.lifecycle?.artifactStatus).toBe('deleted');
    expect(patchBody.item.lifecycle?.artifactVersion).toBe(4);

    const artifact = (
      await db
        .collection('recordings')
        .doc(recordingId)
        .collection('ai_outputs')
        .doc('mindmap')
        .get()
    ).data() as {
      artifactStatus?: string;
      artifactVersion?: number;
      deletedAt?: unknown;
      sourceRecordingVersion?: number;
    };

    expect(artifact.artifactStatus).toBe('deleted');
    expect(artifact.artifactVersion).toBe(4);
    expect(artifact.deletedAt).toBeInstanceOf(Timestamp);
    expect(artifact.sourceRecordingVersion).toBe(1);

    const recording = (await db.collection('recordings').doc(recordingId).get()).data() as {
      lifecycle?: { lastEvent?: string; lastEventBy?: string };
    };

    expect(recording.lifecycle?.lastEvent).toBe('artifact_updated');
    expect(recording.lifecycle?.lastEventBy).toBe('owner-1');
  });

  it('enforces workspace access via recording-access against emulator state', async () => {
    const { recordingId, workspaceId } = await seedRecording({
      recordingId: 'rec-access',
      workspaceId: 'ws-access',
      ownerId: 'owner-1',
      createdBy: 'owner-1',
    });

    mockGetApiSessionUser.mockResolvedValue({ uid: 'intruder-1' });
    const forbiddenResponse = await patchLifecycle(lifecycleRequest('archive', recordingId), {
      params: Promise.resolve({ id: recordingId }),
    });

    expect(forbiddenResponse.status).toBe(403);
    expect(await forbiddenResponse.json()).toMatchObject({ error: 'forbidden' });

    await db
      .collection('workspaces')
      .doc(workspaceId)
      .collection('members')
      .doc('intruder-1')
      .set({ role: 'member', createdAt: Timestamp.now() });

    const allowedResponse = await patchLifecycle(lifecycleRequest('archive', recordingId), {
      params: Promise.resolve({ id: recordingId }),
    });
    expect(allowedResponse.status).toBe(200);

    const allowedBody = (await allowedResponse.json()) as {
      lifecycle: { status: string };
      notificationEvent: string | null;
    };

    expect(allowedBody.notificationEvent).toBe('recording.lifecycle.archived');
    expect(allowedBody.lifecycle.status).toBe('archived');
  });

  it('fails with 404 when artifact document does not exist', async () => {
    const { recordingId } = await seedRecording({ recordingId: 'rec-missing-artifact' });

    const response = (await patchArtifact(
      artifactRequest('PATCH', recordingId, 'mindmap', { payload: { nodes: 3 } }),
      {
        params: Promise.resolve({ id: recordingId, kind: 'mindmap' }),
      },
    )) as Response;

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'not_found' });
  });

  afterAll(async () => {
    if (app) {
      await deleteApp(app);
    }
  });
});
