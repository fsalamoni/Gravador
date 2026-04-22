export interface TimelineSegment {
  start_ms: number;
  end_ms: number;
}

export interface TimelineParityReport {
  segmentCount: number;
  firstStartMs: number | null;
  lastEndMs: number | null;
  durationDeltaMs: number | null;
  overlapCount: number;
  gapCount: number;
  invalidCount: number;
  warnings: string[];
}

const OVERLAP_TOLERANCE_MS = 150;
const GAP_THRESHOLD_MS = 2500;
const START_DELAY_THRESHOLD_MS = 1500;
const DURATION_DELTA_THRESHOLD_MS = 3000;

export function getTimelineParityReport(
  recordingDurationMs: number,
  segments: TimelineSegment[],
): TimelineParityReport {
  if (segments.length === 0) {
    return {
      segmentCount: 0,
      firstStartMs: null,
      lastEndMs: null,
      durationDeltaMs: null,
      overlapCount: 0,
      gapCount: 0,
      invalidCount: 0,
      warnings: ['Transcript segments are missing, so timeline parity cannot be verified yet.'],
    };
  }

  const ordered = [...segments].sort((a, b) => a.start_ms - b.start_ms);
  const firstStartMs = ordered[0]?.start_ms ?? null;
  const lastEndMs = ordered[ordered.length - 1]?.end_ms ?? null;

  let invalidCount = 0;
  let overlapCount = 0;
  let gapCount = 0;
  let previousEnd = ordered[0]?.end_ms ?? 0;

  for (const [index, segment] of ordered.entries()) {
    if (segment.end_ms <= segment.start_ms) {
      invalidCount++;
    }

    if (index === 0) {
      previousEnd = segment.end_ms;
      continue;
    }

    if (segment.start_ms < previousEnd - OVERLAP_TOLERANCE_MS) {
      overlapCount++;
    }

    if (segment.start_ms - previousEnd > GAP_THRESHOLD_MS) {
      gapCount++;
    }

    previousEnd = Math.max(previousEnd, segment.end_ms);
  }

  const durationDeltaMs =
    typeof lastEndMs === 'number' ? Math.abs(lastEndMs - recordingDurationMs) : null;

  const warnings: string[] = [];
  if ((firstStartMs ?? 0) > START_DELAY_THRESHOLD_MS) {
    warnings.push('Transcript starts noticeably late compared with the recording start.');
  }
  if ((durationDeltaMs ?? 0) > DURATION_DELTA_THRESHOLD_MS) {
    warnings.push('Transcript end and recording duration differ by more than 3 seconds.');
  }
  if (invalidCount > 0) {
    warnings.push(
      `Detected ${invalidCount} transcript segment(s) with invalid start/end boundaries.`,
    );
  }
  if (overlapCount > 0) {
    warnings.push(`Detected ${overlapCount} overlapping transcript segment transition(s).`);
  }
  if (gapCount > 0) {
    warnings.push(`Detected ${gapCount} gap(s) greater than 2.5s between transcript segments.`);
  }

  return {
    segmentCount: ordered.length,
    firstStartMs,
    lastEndMs,
    durationDeltaMs,
    overlapCount,
    gapCount,
    invalidCount,
    warnings,
  };
}
