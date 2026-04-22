import { describe, expect, it } from 'vitest';
import { getNotificationEventForLifecycleEvent } from './recording-lifecycle';

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
});
