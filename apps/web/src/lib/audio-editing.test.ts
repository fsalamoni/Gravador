import { describe, expect, it } from 'vitest';
import { getNextAudioVersionNumber, parseAudioEditingRequest } from './audio-editing';

describe('audio editing contracts', () => {
  it('parses queue_edit payload', () => {
    const parsed = parseAudioEditingRequest({
      action: 'queue_edit',
      preset: 'normalize_loudness',
    });
    expect(parsed.action).toBe('queue_edit');
    if (parsed.action === 'queue_edit') {
      expect(parsed.preset).toBe('normalize_loudness');
    }
  });

  it('parses rollback payload', () => {
    const parsed = parseAudioEditingRequest({
      action: 'rollback',
      targetVersionId: 'version-1',
    });
    expect(parsed.action).toBe('rollback');
    if (parsed.action === 'rollback') {
      expect(parsed.targetVersionId).toBe('version-1');
    }
  });

  it('computes next version number from existing versions', () => {
    expect(getNextAudioVersionNumber([])).toBe(1);
    expect(
      getNextAudioVersionNumber([{ versionNumber: 1 }, { versionNumber: 2 }, { versionNumber: 5 }]),
    ).toBe(6);
  });
});
