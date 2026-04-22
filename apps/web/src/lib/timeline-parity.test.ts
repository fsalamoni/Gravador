import { describe, expect, it } from 'vitest';
import { getTimelineParityReport } from './timeline-parity';

describe('getTimelineParityReport', () => {
  it('returns a missing-segments warning when transcript data is empty', () => {
    const report = getTimelineParityReport(12_000, []);

    expect(report.segmentCount).toBe(0);
    expect(report.firstStartMs).toBeNull();
    expect(report.lastEndMs).toBeNull();
    expect(report.durationDeltaMs).toBeNull();
    expect(report.warnings).toEqual([
      'Transcript segments are missing, so timeline parity cannot be verified yet.',
    ]);
  });

  it('computes baseline metrics without warnings for healthy segments', () => {
    const report = getTimelineParityReport(10_000, [
      { start_ms: 5_200, end_ms: 9_800 },
      { start_ms: 0, end_ms: 2_000 },
      { start_ms: 2_100, end_ms: 5_000 },
    ]);

    expect(report.segmentCount).toBe(3);
    expect(report.firstStartMs).toBe(0);
    expect(report.lastEndMs).toBe(9_800);
    expect(report.durationDeltaMs).toBe(200);
    expect(report.invalidCount).toBe(0);
    expect(report.overlapCount).toBe(0);
    expect(report.gapCount).toBe(0);
    expect(report.warnings).toEqual([]);
  });

  it('flags invalid, overlapping, and gapped transcript transitions', () => {
    const report = getTimelineParityReport(10_000, [
      { start_ms: 2_000, end_ms: 1_000 },
      { start_ms: 900, end_ms: 3_500 },
      { start_ms: 7_600, end_ms: 8_200 },
    ]);

    expect(report.invalidCount).toBe(1);
    expect(report.overlapCount).toBe(1);
    expect(report.gapCount).toBe(1);
    expect(report.warnings).toContain(
      'Detected 1 transcript segment(s) with invalid start/end boundaries.',
    );
    expect(report.warnings).toContain('Detected 1 overlapping transcript segment transition(s).');
    expect(report.warnings).toContain(
      'Detected 1 gap(s) greater than 2.5s between transcript segments.',
    );
  });

  it('warns when transcript starts late and ends far from recording duration', () => {
    const report = getTimelineParityReport(10_000, [
      { start_ms: 2_200, end_ms: 4_000 },
      { start_ms: 4_300, end_ms: 15_050 },
    ]);

    expect(report.firstStartMs).toBe(2_200);
    expect(report.lastEndMs).toBe(15_050);
    expect(report.durationDeltaMs).toBe(5_050);
    expect(report.warnings).toContain(
      'Transcript starts noticeably late compared with the recording start.',
    );
    expect(report.warnings).toContain(
      'Transcript end and recording duration differ by more than 3 seconds.',
    );
  });
});
