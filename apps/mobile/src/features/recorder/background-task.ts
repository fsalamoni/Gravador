import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { drainQueue } from './queue';

const BG_UPLOAD_TASK = 'gravador.bg.upload';

TaskManager.defineTask(BG_UPLOAD_TASK, async () => {
  try {
    await drainQueue();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (err) {
    console.warn('[bg] upload task failed', err);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Register the periodic background task (min 15 min on iOS, opportunistic on Android). */
export async function registerBackgroundUploadTask() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BG_UPLOAD_TASK);
  if (isRegistered) return;
  await BackgroundTask.registerTaskAsync(BG_UPLOAD_TASK, { minimumInterval: 15 * 60 });
}

export async function unregisterBackgroundUploadTask() {
  await BackgroundTask.unregisterTaskAsync(BG_UPLOAD_TASK).catch(() => undefined);
}
