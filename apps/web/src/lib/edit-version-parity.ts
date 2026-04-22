export interface ArtifactVersionParityItem {
  kind: string;
  artifactStatus: 'active' | 'deleted';
  sourceRecordingVersion: number;
}

export interface EditVersionParityReport {
  recordingVersion: number;
  hasInvalidRecordingVersion: boolean;
  activeArtifactCount: number;
  staleArtifactCount: number;
  futureArtifactCount: number;
  warnings: string[];
}

export function getEditVersionParityReport(
  recordingVersion: number,
  artifacts: ArtifactVersionParityItem[],
): EditVersionParityReport {
  const normalizedVersion =
    Number.isFinite(recordingVersion) && recordingVersion > 0 ? Math.floor(recordingVersion) : 1;
  const hasInvalidRecordingVersion = normalizedVersion !== recordingVersion;
  const activeArtifacts = artifacts.filter((artifact) => artifact.artifactStatus === 'active');

  if (activeArtifacts.length === 0) {
    const warnings = ['No active artifacts found for edit/version parity checks.'];
    if (hasInvalidRecordingVersion) {
      warnings.push(
        'Recording lifecycle version was invalid and fallback version 1 was used for parity checks.',
      );
    }
    return {
      recordingVersion: normalizedVersion,
      hasInvalidRecordingVersion,
      activeArtifactCount: 0,
      staleArtifactCount: 0,
      futureArtifactCount: 0,
      warnings,
    };
  }

  let staleArtifactCount = 0;
  let futureArtifactCount = 0;

  for (const artifact of activeArtifacts) {
    if (artifact.sourceRecordingVersion < normalizedVersion) staleArtifactCount++;
    if (artifact.sourceRecordingVersion > normalizedVersion) futureArtifactCount++;
  }

  const warnings: string[] = [];
  if (hasInvalidRecordingVersion) {
    warnings.push(
      'Recording lifecycle version was invalid and fallback version 1 was used for parity checks.',
    );
  }
  if (staleArtifactCount > 0) {
    warnings.push(
      `Detected ${staleArtifactCount} active artifact(s) generated from older recording versions.`,
    );
  }
  if (futureArtifactCount > 0) {
    warnings.push(
      `Detected ${futureArtifactCount} active artifact(s) referencing a newer recording version than the current lifecycle version.`,
    );
  }

  return {
    recordingVersion: normalizedVersion,
    hasInvalidRecordingVersion,
    activeArtifactCount: activeArtifacts.length,
    staleArtifactCount,
    futureArtifactCount,
    warnings,
  };
}
