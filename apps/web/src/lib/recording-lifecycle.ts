import type { AIOutputKind } from '@gravador/core';

export const RECORDING_LIFECYCLE_SCHEMA_VERSION = 1;

export type RecordingLifecycleStatus = 'active' | 'archived' | 'trashed';
export type ArtifactLifecycleStatus = 'active' | 'deleted';

export type RecordingLifecycleEvent =
  | 'created'
  | 'archived'
  | 'unarchived'
  | 'trashed'
  | 'restored'
  | 'version_bumped'
  | 'artifact_created'
  | 'artifact_updated'
  | 'artifact_deleted'
  | 'artifact_restored'
  | 'pipeline_updated';

export type RecordingNotificationEvent =
  | 'recording.lifecycle.archived'
  | 'recording.lifecycle.unarchived'
  | 'recording.lifecycle.trashed'
  | 'recording.lifecycle.restored'
  | 'recording.lifecycle.version_bumped'
  | 'recording.artifact.created'
  | 'recording.artifact.updated'
  | 'recording.artifact.deleted'
  | 'recording.artifact.restored'
  | 'recording.pipeline.updated';

export const AI_OUTPUT_KINDS: readonly AIOutputKind[] = [
  'summary',
  'action_items',
  'mindmap',
  'chapters',
  'quotes',
  'sentiment',
  'flashcards',
] as const;

export interface RecordingRetentionPolicy {
  keepOriginal: boolean;
  keepEditedVersions: boolean;
  manualDeleteOnly: boolean;
  purgeAfterDays: number | null;
}

export interface RecordingLifecycleState {
  schemaVersion: number;
  status: RecordingLifecycleStatus;
  recordingVersion: number;
  retainedVersions: number;
  source: string;
  activeAudioVersionId: string | null;
  archivedAt: string | null;
  trashedAt: string | null;
  lastEvent: RecordingLifecycleEvent;
  lastEventAt: string | null;
  lastEventBy: string | null;
}

export interface ArtifactLifecycleState {
  kind: AIOutputKind;
  artifactStatus: ArtifactLifecycleStatus;
  artifactVersion: number;
  sourceRecordingVersion: number;
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
  updatedBy: string | null;
}

type TimestampLike =
  | { toDate?: () => Date; toMillis?: () => number }
  | Date
  | string
  | null
  | undefined;

export function isAIOutputKind(value: string): value is AIOutputKind {
  return (AI_OUTPUT_KINDS as readonly string[]).includes(value);
}

export function toIsoTimestamp(value: TimestampLike): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

export function getRecordingRetentionPolicy(raw: unknown): RecordingRetentionPolicy {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    keepOriginal: data.keepOriginal !== false,
    keepEditedVersions: data.keepEditedVersions !== false,
    manualDeleteOnly: data.manualDeleteOnly !== false,
    purgeAfterDays: typeof data.purgeAfterDays === 'number' ? data.purgeAfterDays : null,
  };
}

export function getRecordingLifecycleState(raw: unknown): RecordingLifecycleState {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const statusCandidate = data.status;
  const status: RecordingLifecycleStatus =
    statusCandidate === 'archived' || statusCandidate === 'trashed' ? statusCandidate : 'active';

  const lastEventCandidate = data.lastEvent;
  const lastEvent: RecordingLifecycleEvent =
    typeof lastEventCandidate === 'string' &&
    [
      'created',
      'archived',
      'unarchived',
      'trashed',
      'restored',
      'version_bumped',
      'artifact_created',
      'artifact_updated',
      'artifact_deleted',
      'artifact_restored',
      'pipeline_updated',
    ].includes(lastEventCandidate)
      ? (lastEventCandidate as RecordingLifecycleEvent)
      : 'created';

  return {
    schemaVersion:
      typeof data.schemaVersion === 'number'
        ? data.schemaVersion
        : RECORDING_LIFECYCLE_SCHEMA_VERSION,
    status,
    recordingVersion: typeof data.recordingVersion === 'number' ? data.recordingVersion : 1,
    retainedVersions: typeof data.retainedVersions === 'number' ? data.retainedVersions : 1,
    source: typeof data.source === 'string' && data.source.trim() ? data.source : 'unknown',
    activeAudioVersionId:
      typeof data.activeAudioVersionId === 'string' ? data.activeAudioVersionId : null,
    archivedAt: toIsoTimestamp(data.archivedAt as TimestampLike),
    trashedAt: toIsoTimestamp(data.trashedAt as TimestampLike),
    lastEvent,
    lastEventAt: toIsoTimestamp(data.lastEventAt as TimestampLike),
    lastEventBy: typeof data.lastEventBy === 'string' ? data.lastEventBy : null,
  };
}

export function getArtifactLifecycleState(raw: unknown): ArtifactLifecycleState | null {
  if (!raw || typeof raw !== 'object') return null;

  const data = raw as Record<string, unknown>;
  const kind = typeof data.kind === 'string' ? data.kind : '';
  if (!isAIOutputKind(kind)) return null;

  const statusCandidate = data.artifactStatus;
  const artifactStatus: ArtifactLifecycleStatus =
    statusCandidate === 'deleted' ? 'deleted' : 'active';

  return {
    kind,
    artifactStatus,
    artifactVersion: typeof data.artifactVersion === 'number' ? data.artifactVersion : 1,
    sourceRecordingVersion:
      typeof data.sourceRecordingVersion === 'number' ? data.sourceRecordingVersion : 1,
    createdAt: toIsoTimestamp(data.createdAt as TimestampLike),
    updatedAt: toIsoTimestamp(data.updatedAt as TimestampLike),
    deletedAt: toIsoTimestamp(data.deletedAt as TimestampLike),
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : null,
  };
}

export function getDefaultRecordingLifecycle(params: {
  source: string;
  recordingId: string;
  actorId: string | null;
}): Omit<RecordingLifecycleState, 'archivedAt' | 'trashedAt' | 'lastEventAt'> & {
  archivedAt: null;
  trashedAt: null;
  lastEventAt: null;
} {
  return {
    schemaVersion: RECORDING_LIFECYCLE_SCHEMA_VERSION,
    status: 'active',
    recordingVersion: 1,
    retainedVersions: 1,
    source: params.source,
    activeAudioVersionId: params.recordingId,
    archivedAt: null,
    trashedAt: null,
    lastEvent: 'created',
    lastEventAt: null,
    lastEventBy: params.actorId,
  };
}

export function getDefaultRetentionPolicy(): RecordingRetentionPolicy {
  return {
    keepOriginal: true,
    keepEditedVersions: true,
    manualDeleteOnly: true,
    purgeAfterDays: null,
  };
}

const NOTIFICATION_EVENT_BY_LIFECYCLE_EVENT: Record<
  RecordingLifecycleEvent,
  RecordingNotificationEvent | null
> = {
  created: null,
  archived: 'recording.lifecycle.archived',
  unarchived: 'recording.lifecycle.unarchived',
  trashed: 'recording.lifecycle.trashed',
  restored: 'recording.lifecycle.restored',
  version_bumped: 'recording.lifecycle.version_bumped',
  artifact_created: 'recording.artifact.created',
  artifact_updated: 'recording.artifact.updated',
  artifact_deleted: 'recording.artifact.deleted',
  artifact_restored: 'recording.artifact.restored',
  pipeline_updated: 'recording.pipeline.updated',
};

export function getNotificationEventForLifecycleEvent(
  event: RecordingLifecycleEvent,
): RecordingNotificationEvent | null {
  return NOTIFICATION_EVENT_BY_LIFECYCLE_EVENT[event] ?? null;
}
