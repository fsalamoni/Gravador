import { getServerDb, getSessionUser } from '@/lib/firebase-server';
import {
  type IntegrationId,
  type StorageSyncResult,
  type WhatsAppSendResult,
  sendRecordingToWhatsAppWebhook,
  syncRecordingToStorageIntegration,
} from '@/lib/integration-sync';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type SyncBody = {
  integrationId?: IntegrationId;
  recordingId?: string;
  limit?: number;
};

const STORAGE_INTEGRATIONS: IntegrationId[] = ['google-drive', 'onedrive', 'dropbox'];

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as SyncBody;
  const db = getServerDb();
  const recordingIds = await resolveRecordingIds(db, user.uid, body.recordingId, body.limit);
  if (recordingIds.length === 0) {
    return NextResponse.json({ error: 'no_recordings_found' }, { status: 404 });
  }

  const requestedIntegrations = body.integrationId
    ? [body.integrationId]
    : await resolveConnectedIntegrations(db, user.uid);
  if (requestedIntegrations.length === 0) {
    return NextResponse.json({ error: 'no_connected_integrations' }, { status: 400 });
  }

  const results: Array<StorageSyncResult | WhatsAppSendResult> = [];
  const failures: Array<{ integrationId: string; message: string }> = [];

  for (const integrationId of requestedIntegrations) {
    try {
      if (integrationId === 'whatsapp') {
        for (const recordingId of recordingIds) {
          results.push(await sendRecordingToWhatsAppWebhook({ db, userId: user.uid, recordingId }));
        }
        continue;
      }

      if (
        integrationId === 'google-drive' ||
        integrationId === 'onedrive' ||
        integrationId === 'dropbox'
      ) {
        for (const recordingId of recordingIds) {
          results.push(
            await syncRecordingToStorageIntegration({
              db,
              userId: user.uid,
              integrationId,
              recordingId,
            }),
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado ao sincronizar.';
      failures.push({ integrationId, message });
      await db.collection('users').doc(user.uid).collection('integrations').doc(integrationId).set(
        {
          lastSyncedAt: new Date().toISOString(),
          lastSyncStatus: 'failed',
          lastSyncError: message,
        },
        { merge: true },
      );
    }
  }

  return NextResponse.json({
    status: failures.length ? 'partial' : 'ok',
    syncedRecordings: recordingIds.length,
    integrations: requestedIntegrations,
    results,
    failures,
  });
}

async function resolveRecordingIds(
  db: ReturnType<typeof getServerDb>,
  userId: string,
  recordingId?: string,
  limit = 5,
) {
  if (recordingId) return [recordingId];
  const cap = Math.min(Math.max(limit, 1), 10);
  const snap = await db
    .collection('recordings')
    .where('createdBy', '==', userId)
    .orderBy('capturedAt', 'desc')
    .limit(cap)
    .get();
  return snap.docs.filter((doc) => doc.data().deletedAt == null).map((doc) => doc.id);
}

async function resolveConnectedIntegrations(db: ReturnType<typeof getServerDb>, userId: string) {
  const snap = await db.collection('users').doc(userId).collection('integrations').get();
  return snap.docs
    .filter(
      (doc) =>
        doc.data().status === 'connected' &&
        (STORAGE_INTEGRATIONS.includes(doc.id as IntegrationId) || doc.id === 'whatsapp'),
    )
    .map((doc) => doc.id as IntegrationId);
}
