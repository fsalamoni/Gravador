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

import { DELETE } from './[id]/artifacts/[kind]/route';
import { PATCH as patchLifecycle } from './[id]/lifecycle/route';

const RUN_MANAGED_FIRESTORE_E2E = process.env.RUN_MANAGED_FIRESTORE_E2E === 'true';
const describeIfManaged = RUN_MANAGED_FIRESTORE_E2E ? describe : describe.skip;

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? '';
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID ?? 'anotes';
const APP_NAME = `gravador-web-managed-routes-${PROJECT_ID || 'missing'}-${DATABASE_ID}`;

let db: Firestore;
let app: App;

function lifecycleRequest(action: string, recordingId: string) {
  return new Request(`https://test.local/api/recordings/${recordingId}/lifecycle`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action }),
  });
}

function artifactRequest(method: 'DELETE', recordingId: string, kind = 'mindmap') {
  return new Request(`https://test.local/api/recordings/${recordingId}/artifacts/${kind}`, {
    method,
    headers: { 'content-type': 'application/json' },
  });
}

async function seedManagedRecording(params: {
  recordingId: string;
  workspaceId: string;
  ownerId: string;
}) {
  await db.collection('workspaces').doc(params.workspaceId).set({
    ownerId: params.ownerId,
    createdAt: Timestamp.now(),
  });

  await db
    .collection('recordings')
    .doc(params.recordingId)
    .set({
      workspaceId: params.workspaceId,
      createdBy: params.ownerId,
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

  await db
    .collection('recordings')
    .doc(params.recordingId)
    .collection('ai_outputs')
    .doc('mindmap')
    .set({
      recordingId: params.recordingId,
      kind: 'mindmap',
      payload: { nodes: 3 },
      provider: 'provider-managed',
      model: 'model-managed',
      promptVersion: 'v1',
      artifactStatus: 'active',
      artifactVersion: 1,
      sourceRecordingVersion: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
}

async function cleanupManagedRecording(params: { recordingId: string; workspaceId: string }) {
  const artifactRef = db
    .collection('recordings')
    .doc(params.recordingId)
    .collection('ai_outputs')
    .doc('mindmap');

  await Promise.allSettled([
    artifactRef.delete(),
    db.collection('recordings').doc(params.recordingId).delete(),
    db.collection('workspaces').doc(params.workspaceId).delete(),
  ]);
}

describeIfManaged('recording routes against managed Firestore', () => {
  beforeAll(() => {
    if (!PROJECT_ID) {
      throw new Error('FIREBASE_PROJECT_ID is required when RUN_MANAGED_FIRESTORE_E2E=true');
    }

    const existing = getApps().find((candidate) => candidate.name === APP_NAME);
    app = existing ?? initializeApp({ projectId: PROJECT_ID }, APP_NAME);
    db = getFirestore(app, DATABASE_ID);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerDb.mockReturnValue(db as never);
    mockGetApiSessionUser.mockResolvedValue({ uid: 'owner-managed-e2e' });
  });

  it('applies lifecycle and artifact mutations with managed Firestore semantics', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const recordingId = `managed-e2e-rec-${suffix}`;
    const workspaceId = `managed-e2e-ws-${suffix}`;
    const ownerId = 'owner-managed-e2e';

    await seedManagedRecording({ recordingId, workspaceId, ownerId });

    try {
      const archiveResponse = await patchLifecycle(lifecycleRequest('archive', recordingId), {
        params: Promise.resolve({ id: recordingId }),
      });
      expect(archiveResponse.status).toBe(200);

      const archiveBody = (await archiveResponse.json()) as {
        lifecycle: { status: string };
        notificationEvent: string | null;
      };
      expect(archiveBody.lifecycle.status).toBe('archived');
      expect(archiveBody.notificationEvent).toBe('recording.lifecycle.archived');

      const bumpResponse = await patchLifecycle(lifecycleRequest('bumpVersion', recordingId), {
        params: Promise.resolve({ id: recordingId }),
      });
      expect(bumpResponse.status).toBe(200);

      const bumpBody = (await bumpResponse.json()) as {
        lifecycle: { recordingVersion: number; retainedVersions: number; lastEvent: string };
      };
      expect(bumpBody.lifecycle.recordingVersion).toBe(2);
      expect(bumpBody.lifecycle.retainedVersions).toBe(2);
      expect(bumpBody.lifecycle.lastEvent).toBe('version_bumped');

      const artifactDeleteResponse = (await DELETE(artifactRequest('DELETE', recordingId), {
        params: Promise.resolve({ id: recordingId, kind: 'mindmap' }),
      })) as Response;
      expect(artifactDeleteResponse.status).toBe(200);

      const artifactData = (
        await db
          .collection('recordings')
          .doc(recordingId)
          .collection('ai_outputs')
          .doc('mindmap')
          .get()
      ).data() as {
        artifactStatus?: string;
        artifactVersion?: number;
      };

      expect(artifactData.artifactStatus).toBe('deleted');
      expect(artifactData.artifactVersion).toBe(2);

      const recordingData = (await db.collection('recordings').doc(recordingId).get()).data() as {
        lifecycle?: { status?: string; lastEvent?: string; recordingVersion?: number };
      };

      expect(recordingData.lifecycle?.status).toBe('archived');
      expect(recordingData.lifecycle?.lastEvent).toBe('artifact_deleted');
      expect(recordingData.lifecycle?.recordingVersion).toBe(2);
    } finally {
      await cleanupManagedRecording({ recordingId, workspaceId });
    }
  });

  afterAll(async () => {
    if (app) {
      await deleteApp(app);
    }
  });
});
