import { describe, expect, it } from 'vitest';
import { getEditVersionParityReport } from './edit-version-parity';

describe('getEditVersionParityReport', () => {
  it('returns warning when no active artifacts exist', () => {
    const report = getEditVersionParityReport(3, []);
    expect(report.hasInvalidRecordingVersion).toBe(false);
    expect(report.activeArtifactCount).toBe(0);
    expect(report.warnings).toEqual(['No active artifacts found for edit/version parity checks.']);
  });

  it('returns healthy report when active artifacts align with recording version', () => {
    const report = getEditVersionParityReport(3, [
      { kind: 'summary', artifactStatus: 'active', sourceRecordingVersion: 3 },
      { kind: 'chapters', artifactStatus: 'deleted', sourceRecordingVersion: 2 },
    ]);

    expect(report.activeArtifactCount).toBe(1);
    expect(report.hasInvalidRecordingVersion).toBe(false);
    expect(report.staleArtifactCount).toBe(0);
    expect(report.futureArtifactCount).toBe(0);
    expect(report.warnings).toEqual([]);
  });

  it('flags stale and future active artifacts', () => {
    const report = getEditVersionParityReport(3, [
      { kind: 'summary', artifactStatus: 'active', sourceRecordingVersion: 2 },
      { kind: 'chapters', artifactStatus: 'active', sourceRecordingVersion: 4 },
    ]);

    expect(report.staleArtifactCount).toBe(1);
    expect(report.futureArtifactCount).toBe(1);
    expect(report.warnings).toContain(
      'Detected 1 active artifact(s) generated from older recording versions.',
    );
    expect(report.warnings).toContain(
      'Detected 1 active artifact(s) referencing a newer recording version than the current lifecycle version.',
    );
  });

  it('warns when recording lifecycle version is invalid', () => {
    const report = getEditVersionParityReport(0, [
      { kind: 'summary', artifactStatus: 'active', sourceRecordingVersion: 1 },
    ]);
    expect(report.recordingVersion).toBe(1);
    expect(report.hasInvalidRecordingVersion).toBe(true);
    expect(report.warnings).toContain(
      'Recording lifecycle version was invalid and fallback version 1 was used for parity checks.',
    );
  });
});
