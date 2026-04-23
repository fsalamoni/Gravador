import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeFirestoreDb } from '@/test-utils/fake-firestore';

const { mockGetApiSessionUser, mockGetServerDb, mockGetAccessibleRecording } = vi.hoisted(() => ({
  mockGetApiSessionUser: vi.fn(),
  mockGetServerDb: vi.fn(),
  mockGetAccessibleRecording: vi.fn(),
}));

vi.mock('@/lib/api-session', () => ({
  getApiSessionUser: mockGetApiSessionUser,
}));

vi.mock('@/lib/firebase-server', () => ({
  getServerDb: mockGetServerDb,
}));

vi.mock('@/lib/recording-access', () => ({
  getAccessibleRecording: mockGetAccessibleRecording,
}));

import { DELETE, PATCH, POST } from './route';

function jsonRequest(method: 'PATCH' | 'POST' | 'DELETE', body?: Record<string, unknown>) {
  return new Request('https://test.local/api/recordings/rec-primary/artifacts/mindmap', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('recording artifact kind route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiSessionUser.mockResolvedValue({ uid: 'user-1' });
  });

  it('deletes and restores artifact while updating lifecycle metadata', async () => {
    const db = new FakeFirestoreDb();
    mockGetServerDb.mockReturnValue(db as never);

    const recordingRef = db.collection('recordings').doc('rec-primary');
    const artifactRef = recordingRef.collection('ai_outputs').doc('mindmap');

    await recordingRef.set({
      workspaceId: 'ws-1',
      createdBy: 'user-1',
      lifecycle: {
        schemaVersion: 1,
        status: 'active',
        recordingVersion: 4,
        retainedVersions: 4,
        lastEvent: 'created',
      },
    });

    await artifactRef.set({
      recordingId: 'rec-primary',
      kind: 'mindmap',
      payload: { nodes: 4 },
      provider: 'model-a',
      model: 'x-large',
      promptVersion: 'v1',
      artifactStatus: 'active',
      artifactVersion: 2,
      sourceRecordingVersion: 4,
    });

    mockGetAccessibleRecording.mockImplementation(async (_db: unknown, recordingId: string) => {
      if (recordingId !== 'rec-primary') return { ok: false, error: 'not_found' };
      return {
        ok: true,
        ref: recordingRef,
        data: db.get(recordingRef.path),
      };
    });

    const deleteResponse = (await DELETE(jsonRequest('DELETE'), {
      params: Promise.resolve({ id: 'rec-primary', kind: 'mindmap' }),
    })) as Response;

    expect(deleteResponse.status).toBe(200);
    const deleteBody = (await deleteResponse.json()) as {
      notificationEvent: string | null;
    };
    expect(deleteBody.notificationEvent).toBe('recording.artifact.deleted');

    const deletedArtifact = db.get('recordings/rec-primary/ai_outputs/mindmap') as {
      artifactStatus?: string;
      artifactVersion?: number;
      deletedAt?: unknown;
    };
    expect(deletedArtifact.artifactStatus).toBe('deleted');
    expect(deletedArtifact.artifactVersion).toBe(3);
    expect(deletedArtifact.deletedAt).toBeInstanceOf(Date);

    const afterDeleteRecording = db.get('recordings/rec-primary') as {
      lifecycle?: { lastEvent?: string; lastEventBy?: string | null };
    };
    expect(afterDeleteRecording.lifecycle?.lastEvent).toBe('artifact_deleted');
    expect(afterDeleteRecording.lifecycle?.lastEventBy).toBe('user-1');

    const restoreResponse = (await POST(jsonRequest('POST'), {
      params: Promise.resolve({ id: 'rec-primary', kind: 'mindmap' }),
    })) as Response;

    expect(restoreResponse.status).toBe(200);
    const restoreBody = (await restoreResponse.json()) as {
      item: { artifactStatus?: string; artifactVersion?: number; deletedAt?: unknown };
      notificationEvent: string | null;
    };

    expect(restoreBody.notificationEvent).toBe('recording.artifact.restored');
    expect(restoreBody.item.artifactStatus).toBe('active');
    expect(restoreBody.item.artifactVersion).toBe(4);
    expect(restoreBody.item.deletedAt).toBeNull();

    const afterRestoreRecording = db.get('recordings/rec-primary') as {
      lifecycle?: { lastEvent?: string; lastEventBy?: string | null };
    };
    expect(afterRestoreRecording.lifecycle?.lastEvent).toBe('artifact_restored');
    expect(afterRestoreRecording.lifecycle?.lastEventBy).toBe('user-1');
  });

  it('patches artifact payload and status with version bump', async () => {
    const db = new FakeFirestoreDb();
    mockGetServerDb.mockReturnValue(db as never);

    const recordingRef = db.collection('recordings').doc('rec-primary');
    const artifactRef = recordingRef.collection('ai_outputs').doc('mindmap');

    await recordingRef.set({
      workspaceId: 'ws-1',
      createdBy: 'user-1',
      lifecycle: {
        schemaVersion: 1,
        status: 'active',
        recordingVersion: 5,
        retainedVersions: 5,
        lastEvent: 'created',
      },
    });

    await artifactRef.set({
      recordingId: 'rec-primary',
      kind: 'mindmap',
      payload: { nodes: 1 },
      provider: 'model-a',
      model: 'x-small',
      promptVersion: 'v1',
      locale: 'pt-BR',
      artifactStatus: 'active',
      artifactVersion: 1,
      sourceRecordingVersion: 5,
    });

    mockGetAccessibleRecording.mockImplementation(async (_db: unknown, recordingId: string) => {
      if (recordingId !== 'rec-primary') return { ok: false, error: 'not_found' };
      return {
        ok: true,
        ref: recordingRef,
        data: db.get(recordingRef.path),
      };
    });

    const response = (await PATCH(
      jsonRequest('PATCH', {
        payload: { nodes: 7 },
        provider: 'model-b',
        model: 'x-large',
        promptVersion: 'v2',
        locale: 'en-US',
        latencyMs: 420,
        costCents: 3,
        artifactStatus: 'deleted',
      }),
      {
        params: Promise.resolve({ id: 'rec-primary', kind: 'mindmap' }),
      },
    )) as Response;

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
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
        } | null;
      };
    };

    expect(body.notificationEvent).toBe('recording.artifact.updated');
    expect(body.item.payload).toEqual({ nodes: 7 });
    expect(body.item.provider).toBe('model-b');
    expect(body.item.model).toBe('x-large');
    expect(body.item.promptVersion).toBe('v2');
    expect(body.item.lifecycle?.artifactStatus).toBe('deleted');
    expect(body.item.lifecycle?.artifactVersion).toBe(2);
    expect(body.item.lifecycle?.deletedAt).toEqual(expect.any(String));

    const persistedArtifact = db.get('recordings/rec-primary/ai_outputs/mindmap') as {
      locale?: string;
      latencyMs?: number;
      costCents?: number;
      sourceRecordingVersion?: number;
    };
    expect(persistedArtifact.locale).toBe('en-US');
    expect(persistedArtifact.latencyMs).toBe(420);
    expect(persistedArtifact.costCents).toBe(3);
    expect(persistedArtifact.sourceRecordingVersion).toBe(5);

    const persistedRecording = db.get('recordings/rec-primary') as {
      lifecycle?: { lastEvent?: string; lastEventBy?: string | null };
    };
    expect(persistedRecording.lifecycle?.lastEvent).toBe('artifact_updated');
    expect(persistedRecording.lifecycle?.lastEventBy).toBe('user-1');
  });

  it('returns empty_update for patch without changes', async () => {
    const db = new FakeFirestoreDb();
    mockGetServerDb.mockReturnValue(db as never);

    const recordingRef = db.collection('recordings').doc('rec-primary');
    await recordingRef.set({ workspaceId: 'ws-1', createdBy: 'user-1' });

    mockGetAccessibleRecording.mockResolvedValue({
      ok: true,
      ref: recordingRef,
      data: db.get(recordingRef.path),
    });

    const response = (await PATCH(jsonRequest('PATCH', {}), {
      params: Promise.resolve({ id: 'rec-primary', kind: 'mindmap' }),
    })) as Response;

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'empty_update' });
  });
});
