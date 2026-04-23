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

import { GET, PATCH } from './route';

function jsonRequest(body: Record<string, unknown>) {
  return new Request('https://test.local/api/recordings/rec-primary/lifecycle', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('recording lifecycle route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiSessionUser.mockResolvedValue({ uid: 'user-1' });
  });

  it('applies archive, trash, and restore transitions with notification mapping', async () => {
    const db = new FakeFirestoreDb();
    mockGetServerDb.mockReturnValue(db as never);

    const recordingRef = db.collection('recordings').doc('rec-primary');
    await recordingRef.set({
      workspaceId: 'ws-1',
      createdBy: 'user-1',
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
    });

    mockGetAccessibleRecording.mockImplementation(async (_db: unknown, recordingId: string) => {
      if (recordingId !== 'rec-primary') return { ok: false, error: 'not_found' };
      return {
        ok: true,
        ref: recordingRef,
        data: db.get(recordingRef.path),
      };
    });

    const archiveResponse = await PATCH(jsonRequest({ action: 'archive' }), {
      params: Promise.resolve({ id: 'rec-primary' }),
    });
    expect(archiveResponse.status).toBe(200);
    const archiveBody = (await archiveResponse.json()) as {
      notificationEvent: string | null;
      lifecycle: { status: string; lastEvent: string };
    };
    expect(archiveBody.notificationEvent).toBe('recording.lifecycle.archived');
    expect(archiveBody.lifecycle.status).toBe('archived');
    expect(archiveBody.lifecycle.lastEvent).toBe('archived');

    const trashResponse = await PATCH(jsonRequest({ action: 'trash' }), {
      params: Promise.resolve({ id: 'rec-primary' }),
    });
    expect(trashResponse.status).toBe(200);
    const trashBody = (await trashResponse.json()) as {
      deletedAt: string | null;
      notificationEvent: string | null;
      lifecycle: { status: string; lastEvent: string };
    };
    expect(trashBody.notificationEvent).toBe('recording.lifecycle.trashed');
    expect(trashBody.lifecycle.status).toBe('trashed');
    expect(trashBody.lifecycle.lastEvent).toBe('trashed');
    expect(trashBody.deletedAt).toEqual(expect.any(String));

    const restoreResponse = await PATCH(jsonRequest({ action: 'restore' }), {
      params: Promise.resolve({ id: 'rec-primary' }),
    });
    expect(restoreResponse.status).toBe(200);
    const restoreBody = (await restoreResponse.json()) as {
      deletedAt: string | null;
      notificationEvent: string | null;
      lifecycle: { status: string; lastEvent: string };
    };

    expect(restoreBody.notificationEvent).toBe('recording.lifecycle.restored');
    expect(restoreBody.lifecycle.status).toBe('active');
    expect(restoreBody.lifecycle.lastEvent).toBe('restored');
    expect(restoreBody.deletedAt).toBeNull();

    const persisted = db.get('recordings/rec-primary') as {
      deletedAt: unknown;
      lifecycle?: { status?: string; lastEvent?: string; lastEventBy?: string | null };
    };
    expect(persisted.deletedAt).toBeNull();
    expect(persisted.lifecycle?.status).toBe('active');
    expect(persisted.lifecycle?.lastEvent).toBe('restored');
    expect(persisted.lifecycle?.lastEventBy).toBe('user-1');
  });

  it('increments version and retainedVersions on bumpVersion', async () => {
    const db = new FakeFirestoreDb();
    mockGetServerDb.mockReturnValue(db as never);

    const recordingRef = db.collection('recordings').doc('rec-primary');
    await recordingRef.set({
      workspaceId: 'ws-1',
      createdBy: 'user-1',
      lifecycle: {
        schemaVersion: 1,
        status: 'active',
        recordingVersion: 2,
        retainedVersions: 2,
        lastEvent: 'created',
      },
      retention: {
        keepOriginal: true,
        keepEditedVersions: true,
        manualDeleteOnly: true,
        purgeAfterDays: null,
      },
    });

    mockGetAccessibleRecording.mockImplementation(async (_db: unknown, recordingId: string) => {
      if (recordingId !== 'rec-primary') return { ok: false, error: 'not_found' };
      return {
        ok: true,
        ref: recordingRef,
        data: db.get(recordingRef.path),
      };
    });

    const response = await PATCH(jsonRequest({ action: 'bumpVersion' }), {
      params: Promise.resolve({ id: 'rec-primary' }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      notificationEvent: string | null;
      lifecycle: {
        status: string;
        lastEvent: string;
        recordingVersion: number;
        retainedVersions: number;
      };
    };

    expect(body.notificationEvent).toBe('recording.lifecycle.version_bumped');
    expect(body.lifecycle.status).toBe('active');
    expect(body.lifecycle.lastEvent).toBe('version_bumped');
    expect(body.lifecycle.recordingVersion).toBe(3);
    expect(body.lifecycle.retainedVersions).toBe(3);

    const persisted = db.get('recordings/rec-primary') as {
      lifecycle?: { recordingVersion?: number; retainedVersions?: number };
    };
    expect(persisted.lifecycle?.recordingVersion).toBe(3);
    expect(persisted.lifecycle?.retainedVersions).toBe(3);
  });

  it('returns expected errors for unauthorized, invalid action, and not found', async () => {
    const db = new FakeFirestoreDb();
    mockGetServerDb.mockReturnValue(db as never);

    mockGetApiSessionUser.mockResolvedValueOnce(null);
    const unauthorized = await GET(
      new Request('https://test.local/api/recordings/rec-1/lifecycle'),
      {
        params: Promise.resolve({ id: 'rec-1' }),
      },
    );
    expect(unauthorized.status).toBe(401);

    mockGetApiSessionUser.mockResolvedValue({ uid: 'user-1' });
    const invalidAction = await PATCH(jsonRequest({ action: 'invalid' }), {
      params: Promise.resolve({ id: 'rec-1' }),
    });
    expect(invalidAction.status).toBe(400);

    mockGetAccessibleRecording.mockResolvedValue({ ok: false, error: 'not_found' });
    const notFound = await PATCH(jsonRequest({ action: 'archive' }), {
      params: Promise.resolve({ id: 'rec-1' }),
    });
    expect(notFound.status).toBe(404);
  });
});
