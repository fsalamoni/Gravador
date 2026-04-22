function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;

  return fallback;
}

export const featureFlags = Object.freeze({
  workspaceDownloads: parseBooleanEnv(process.env.NEXT_PUBLIC_FF_WORKSPACE_DOWNLOADS, true),
  recordingLifecycleV1: parseBooleanEnv(process.env.NEXT_PUBLIC_FF_RECORDING_LIFECYCLE_V1, false),
  audioEditingV1: parseBooleanEnv(process.env.NEXT_PUBLIC_FF_AUDIO_EDITING_V1, false),
  notificationsV1: parseBooleanEnv(process.env.NEXT_PUBLIC_FF_NOTIFICATIONS_V1, false),
  bulkOpsV1: parseBooleanEnv(process.env.NEXT_PUBLIC_FF_BULK_OPS_V1, false),
});

export type FeatureFlags = typeof featureFlags;
