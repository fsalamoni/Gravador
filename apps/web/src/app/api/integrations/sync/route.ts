import { getApiSessionUser } from '@/lib/api-session';
import { featureFlags } from '@/lib/feature-flags';
import { getServerDb } from '@/lib/firebase-server';
import {
  type EmailSendResult,
  type IntegrationId,
  type StorageSyncResult,
  type WhatsAppSendResult,
  sendEmailNotificationTest,
  sendRecordingToEmailIntegration,
  sendRecordingToWhatsAppWebhook,
  sendWhatsAppNotificationTest,
  syncRecordingToStorageIntegration,
} from '@/lib/integration-sync';
import { toNotificationDeliveryError } from '@/lib/notification-delivery';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type SyncBody = {
  integrationId?: IntegrationId;
  recordingId?: string;
  limit?: number;
  mode?: 'test' | 'send';
};

const STORAGE_INTEGRATIONS: IntegrationId[] = ['google-drive', 'onedrive', 'dropbox'];

export async function POST(req: Request) {
  const user = await getApiSessionUser(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as SyncBody;
  const mode = body.mode === 'test' ? 'test' : 'send';
  const db = getServerDb();
  const recordingIds =
    mode === 'test' ? [] : await resolveRecordingIds(db, user.uid, body.recordingId, body.limit);
  if (mode !== 'test' && recordingIds.length === 0) {
    return NextResponse.json({ error: 'no_recordings_found' }, { status: 404 });
  }

  const requestedIntegrations = body.integrationId
    ? [body.integrationId]
    : await resolveConnectedIntegrations(db, user.uid);
  if (requestedIntegrations.length === 0) {
    return NextResponse.json({ error: 'no_connected_integrations' }, { status: 400 });
  }

  const results: Array<StorageSyncResult | WhatsAppSendResult | EmailSendResult> = [];
  const failures: Array<{ integrationId: string; message: string }> = [];

  for (const integrationId of requestedIntegrations) {
    try {
      if (integrationId === 'whatsapp') {
        if (!featureFlags.notificationsV1) {
          results.push({
            integrationId: 'whatsapp',
            recordingId: mode === 'test' ? 'test' : (recordingIds[0] ?? 'disabled'),
            target: null,
          });
          continue;
        }
        if (mode === 'test') {
          results.push(await sendWhatsAppNotificationTest({ db, userId: user.uid }));
        } else {
          for (const recordingId of recordingIds) {
            results.push(
              await sendRecordingToWhatsAppWebhook({ db, userId: user.uid, recordingId }),
            );
          }
        }
        continue;
      }

      if (integrationId === 'email') {
        if (!featureFlags.notificationsV1) {
          results.push({
            integrationId: 'email',
            recordingId: mode === 'test' ? null : (recordingIds[0] ?? null),
            target: null,
          });
          continue;
        }
        if (mode === 'test') {
          results.push(await sendEmailNotificationTest({ db, userId: user.uid }));
        } else {
          for (const recordingId of recordingIds) {
            results.push(
              await sendRecordingToEmailIntegration({ db, userId: user.uid, recordingId }),
            );
          }
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
      const parsedError = toNotificationDeliveryError(error);
      const message = parsedError.message;
      failures.push({ integrationId, message });
      await db
        .collection('users')
        .doc(user.uid)
        .collection('integrations')
        .doc(integrationId)
        .set(
          {
            lastSyncedAt: new Date().toISOString(),
            lastSyncStatus: 'failed',
            lastSyncError: `${parsedError.code}: ${message}`,
          },
          { merge: true },
        );
    }
  }

  return NextResponse.json({
    status: failures.length ? 'partial' : 'ok',
    mode,
    notificationsEnabled: featureFlags.notificationsV1,
    syncedRecordings: mode === 'test' ? 0 : recordingIds.length,
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
  // Keep the batch intentionally small to avoid long-running provider sync requests and API quotas.
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
        (STORAGE_INTEGRATIONS.includes(doc.id as IntegrationId) ||
          doc.id === 'whatsapp' ||
          doc.id === 'email'),
    )
    .map((doc) => doc.id as IntegrationId);
}
