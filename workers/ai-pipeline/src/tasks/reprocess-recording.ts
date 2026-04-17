import { task } from '@trigger.dev/sdk/v3';
import { processRecording } from './process-recording';

/** Manual re-run entry point used by the "Reprocess AI" button in the web UI. */
export const reprocessRecording = task({
  id: 'reprocess-recording',
  run: async (payload: { recordingId: string }) => processRecording.triggerAndWait(payload),
});
