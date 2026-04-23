import type { RecordingNotificationEvent } from '@/lib/recording-lifecycle';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export type NotificationQueueSource =
  | 'recording_lifecycle'
  | 'recording_artifact'
  | 'recording_audio_edit';

export async function enqueueNotificationEvent(params: {
  db: Firestore;
  event: RecordingNotificationEvent;
  recordingId: string;
  workspaceId?: string | null;
  actorId?: string | null;
  source: NotificationQueueSource;
  metadata?: Record<string, unknown>;
}) {
  await params.db.collection('notification_queue').add({
    event: params.event,
    source: params.source,
    status: 'pending',
    attempts: 0,
    recordingId: params.recordingId,
    workspaceId: params.workspaceId?.trim() ? params.workspaceId : null,
    actorId: params.actorId?.trim() ? params.actorId : null,
    metadata: params.metadata ?? null,
    lastError: null,
    sentAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}
