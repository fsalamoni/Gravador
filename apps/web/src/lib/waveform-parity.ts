export interface WaveformParityReport {
  expectedDurationMs: number;
  waveformDurationMs: number;
  durationDeltaMs: number;
  hasWarning: boolean;
  warning: string | null;
}

const WAVEFORM_DURATION_DELTA_THRESHOLD_MS = 3000;

export function getWaveformParityReport(
  expectedDurationMs: number | null | undefined,
  waveformDurationMs: number | null | undefined,
): WaveformParityReport | null {
  if (
    typeof expectedDurationMs !== 'number' ||
    !Number.isFinite(expectedDurationMs) ||
    expectedDurationMs <= 0 ||
    typeof waveformDurationMs !== 'number' ||
    !Number.isFinite(waveformDurationMs) ||
    waveformDurationMs <= 0
  ) {
    return null;
  }

  const durationDeltaMs = Math.abs(waveformDurationMs - expectedDurationMs);
  const hasWarning = durationDeltaMs > WAVEFORM_DURATION_DELTA_THRESHOLD_MS;

  return {
    expectedDurationMs,
    waveformDurationMs,
    durationDeltaMs,
    hasWarning,
    warning: hasWarning
      ? 'Waveform duration differs from expected recording duration by more than 3 seconds.'
      : null,
  };
}
