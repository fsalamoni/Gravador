import { describe, expect, it } from 'vitest';
import {
  getNotificationEventForAudioEditState,
  getNotificationEventForLifecycleEvent,
} from './recording-lifecycle';

describe('recording lifecycle notification event mapping', () => {
  it('returns lifecycle notification event for transition events', () => {
    expect(getNotificationEventForLifecycleEvent('archived')).toBe('recording.lifecycle.archived');
    expect(getNotificationEventForLifecycleEvent('restored')).toBe('recording.lifecycle.restored');
    expect(getNotificationEventForLifecycleEvent('version_bumped')).toBe(
      'recording.lifecycle.version_bumped',
    );
  });

  it('returns null for non-notification lifecycle events', () => {
    expect(getNotificationEventForLifecycleEvent('created')).toBeNull();
  });

  it('maps audio edit processing states to notification events', () => {
    expect(getNotificationEventForAudioEditState('queued')).toBe('recording.audio_edit.queued');
    expect(getNotificationEventForAudioEditState('processing')).toBe(
      'recording.audio_edit.processing',
    );
    expect(getNotificationEventForAudioEditState('retry_scheduled')).toBe(
      'recording.audio_edit.retry_scheduled',
    );
    expect(getNotificationEventForAudioEditState('completed')).toBe(
      'recording.audio_edit.completed',
    );
    expect(getNotificationEventForAudioEditState('failed')).toBe('recording.audio_edit.failed');
  });
});
