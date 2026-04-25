import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetApiSessionUser,
  mockGetServerDb,
  mockFeatureFlags,
  mockSendEmailNotificationTest,
  mockSendWhatsAppNotificationTest,
  mockSendRecordingToEmailIntegration,
  mockSendRecordingToWhatsAppWebhook,
  mockSyncRecordingToStorageIntegration,
} = vi.hoisted(() => ({
  mockGetApiSessionUser: vi.fn(),
  mockGetServerDb: vi.fn(),
  mockFeatureFlags: { notificationsV1: true },
  mockSendEmailNotificationTest: vi.fn(),
  mockSendWhatsAppNotificationTest: vi.fn(),
  mockSendRecordingToEmailIntegration: vi.fn(),
  mockSendRecordingToWhatsAppWebhook: vi.fn(),
  mockSyncRecordingToStorageIntegration: vi.fn(),
}));

vi.mock('@/lib/api-session', () => ({
  getApiSessionUser: mockGetApiSessionUser,
}));

vi.mock('@/lib/firebase-server', () => ({
  getServerDb: mockGetServerDb,
}));

vi.mock('@/lib/feature-flags', () => ({
  featureFlags: mockFeatureFlags,
}));

vi.mock('@/lib/integration-sync', () => ({
  sendEmailNotificationTest: mockSendEmailNotificationTest,
  sendWhatsAppNotificationTest: mockSendWhatsAppNotificationTest,
  sendRecordingToEmailIntegration: mockSendRecordingToEmailIntegration,
  sendRecordingToWhatsAppWebhook: mockSendRecordingToWhatsAppWebhook,
  syncRecordingToStorageIntegration: mockSyncRecordingToStorageIntegration,
}));

import { POST } from './route';

type IntegrationDoc = {
  id: string;
  data: Record<string, unknown>;
};

function createFakeDb(options?: { integrationDocs?: IntegrationDoc[] }) {
  const integrationDocs = options?.integrationDocs ?? [];
  const writes: Array<{
    path: string;
    payload: Record<string, unknown>;
    options?: { merge?: boolean };
  }> = [];

  const db = {
    writes,
    collection(name: string) {
      if (name === 'users') {
        return {
          doc(userId: string) {
            return {
              collection(subName: string) {
                if (subName !== 'integrations') {
                  throw new Error(`Unsupported sub-collection: ${subName}`);
                }
                return {
                  async get() {
                    return {
                      docs: integrationDocs.map((entry) => ({
                        id: entry.id,
                        data: () => entry.data,
                      })),
                    };
                  },
                  doc(integrationId: string) {
                    return {
                      async set(
                        payload: Record<string, unknown>,
                        setOptions?: { merge?: boolean },
                      ) {
                        writes.push({
                          path: `users/${userId}/integrations/${integrationId}`,
                          payload,
                          options: setOptions,
                        });
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (name === 'recordings') {
        const query = {
          where() {
            return query;
          },
          orderBy() {
            return query;
          },
          limit() {
            return query;
          },
          async get() {
            return { docs: [] };
          },
        };
        return query;
      }

      throw new Error(`Unsupported collection: ${name}`);
    },
  };

  return db;
}

function syncRequest(body: Record<string, unknown>) {
  return new Request('https://test.local/api/integrations/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/integrations/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiSessionUser.mockResolvedValue({ uid: 'user-1' });
    mockFeatureFlags.notificationsV1 = true;

    mockSendEmailNotificationTest.mockResolvedValue({
      integrationId: 'email',
      recordingId: null,
      target: 'qa@example.com',
    });
    mockSendWhatsAppNotificationTest.mockResolvedValue({
      integrationId: 'whatsapp',
      recordingId: 'test',
      target: '+5511999999999',
    });
    mockSendRecordingToEmailIntegration.mockResolvedValue({
      integrationId: 'email',
      recordingId: 'rec-1',
      target: 'qa@example.com',
    });
    mockSendRecordingToWhatsAppWebhook.mockResolvedValue({
      integrationId: 'whatsapp',
      recordingId: 'rec-1',
      target: '+5511999999999',
    });
    mockSyncRecordingToStorageIntegration.mockResolvedValue({
      integrationId: 'dropbox',
      recordingId: 'rec-1',
      folderPath: '/Gravador',
      uploadedFiles: ['audio.m4a'],
    });

    mockGetServerDb.mockReturnValue(createFakeDb() as never);
  });

  it('returns 401 when there is no authenticated user', async () => {
    mockGetApiSessionUser.mockResolvedValue(null);

    const response = await POST(syncRequest({ integrationId: 'email', mode: 'test' }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: 'unauthorized' });
  });

  it('rejects unsupported integration ids', async () => {
    const response = await POST(
      syncRequest({ integrationId: 'google-calendar', recordingId: 'rec-1' }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_integration_id' });
  });

  it('rejects invalid limit values', async () => {
    const response = await POST(
      syncRequest({ integrationId: 'email', recordingId: 'rec-1', limit: 0 }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_limit' });
  });

  it('returns 400 when test mode targets only storage integrations', async () => {
    const response = await POST(syncRequest({ integrationId: 'dropbox', mode: 'test' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'test_mode_unsupported' });
  });

  it('skips storage integrations when mode=test resolves connected integrations automatically', async () => {
    const db = createFakeDb({
      integrationDocs: [
        { id: 'dropbox', data: { status: 'connected' } },
        { id: 'email', data: { status: 'connected' } },
        { id: 'whatsapp', data: { status: 'disconnected' } },
      ],
    });
    mockGetServerDb.mockReturnValue(db as never);

    const response = await POST(syncRequest({ mode: 'test' }));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      integrations: string[];
      skippedIntegrations: string[];
      results: Array<{ integrationId: string }>;
      failures: unknown[];
    };

    expect(body.status).toBe('ok');
    expect(body.integrations).toEqual(['email']);
    expect(body.skippedIntegrations).toEqual(['dropbox']);
    expect(body.results).toEqual([expect.objectContaining({ integrationId: 'email' })]);
    expect(body.failures).toEqual([]);
    expect(mockSendEmailNotificationTest).toHaveBeenCalledTimes(1);
    expect(mockSyncRecordingToStorageIntegration).not.toHaveBeenCalled();
  });

  it('returns partial result with structured failure code and persists sync error metadata', async () => {
    const db = createFakeDb();
    mockGetServerDb.mockReturnValue(db as never);
    mockSendRecordingToEmailIntegration.mockRejectedValue(
      new Error('Canal de e-mail não configurado no ambiente.'),
    );

    const response = await POST(
      syncRequest({ integrationId: 'email', recordingId: 'rec-1', mode: 'send' }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      failures: Array<{ integrationId: string; errorCode: string; message: string }>;
    };

    expect(body.status).toBe('partial');
    expect(body.failures).toEqual([
      expect.objectContaining({
        integrationId: 'email',
        errorCode: 'not_configured',
      }),
    ]);
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0]).toMatchObject({
      path: 'users/user-1/integrations/email',
      payload: expect.objectContaining({
        lastSyncStatus: 'failed',
        lastSyncError: expect.stringContaining('not_configured:'),
      }),
      options: { merge: true },
    });
  });
});
