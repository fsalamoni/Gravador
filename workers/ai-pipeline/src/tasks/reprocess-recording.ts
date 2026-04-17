import { processRecording } from './process-recording.ts';

/** Manual re-run entry point used by the "Reprocess AI" button. */
export async function reprocessRecording(payload: { recordingId: string }) {
  return processRecording(payload);
}
