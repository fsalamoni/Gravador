import { describe, expect, it } from 'vitest';
import { getWaveformParityReport } from './waveform-parity';

describe('getWaveformParityReport', () => {
  it('returns null when durations are missing', () => {
    expect(getWaveformParityReport(null, 10_000)).toBeNull();
    expect(getWaveformParityReport(10_000, null)).toBeNull();
  });

  it('returns healthy parity when delta is within threshold', () => {
    const report = getWaveformParityReport(60_000, 62_500);
    expect(report).not.toBeNull();
    expect(report?.durationDeltaMs).toBe(2_500);
    expect(report?.hasWarning).toBe(false);
    expect(report?.warning).toBeNull();
  });

  it('returns warning when delta is above threshold', () => {
    const report = getWaveformParityReport(60_000, 65_500);
    expect(report).not.toBeNull();
    expect(report?.durationDeltaMs).toBe(5_500);
    expect(report?.hasWarning).toBe(true);
    expect(report?.warning).toBe(
      'Waveform duration differs from expected recording duration by more than 3 seconds.',
    );
  });
});
