import { shortId } from '@gravador/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../../lib/supabase';

const QUEUE_KEY = '@gravador/upload-queue/v1';

export interface QueuedUpload {
  id: string;
  workspaceId: string;
  uri: string;
  durationMs: number;
  sizeBytes: number;
  mimeType: string;
  capturedAt: string;
  attempts: number;
}

async function readQueue(): Promise<QueuedUpload[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as QueuedUpload[]) : [];
}

async function writeQueue(items: QueuedUpload[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function enqueueUpload(
  input: Omit<QueuedUpload, 'id' | 'attempts'>,
): Promise<QueuedUpload> {
  const item: QueuedUpload = { ...input, id: shortId(), attempts: 0 };
  const q = await readQueue();
  q.push(item);
  await writeQueue(q);
  return item;
}

export async function getQueue(): Promise<QueuedUpload[]> {
  return readQueue();
}

/**
 * Drain the queue, uploading each item to Supabase Storage. Resumable semantics
 * are provided by Supabase's TUS protocol support — we use the `upload` API
 * here for simplicity, and swap to `tus-js-client` for large files.
 */
export async function drainQueue(onProgress?: (item: QueuedUpload) => void): Promise<void> {
  const queue = await readQueue();
  const remaining: QueuedUpload[] = [];

  for (const item of queue) {
    try {
      onProgress?.(item);
      const fileInfo = await FileSystem.getInfoAsync(item.uri);
      if (!fileInfo.exists) continue; // drop if file is gone

      const path = `${item.workspaceId}/${item.id}.m4a`;
      const bytes = await FileSystem.readAsStringAsync(item.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const buffer = Buffer.from(bytes, 'base64');
      const { error } = await supabase.storage
        .from('audio-raw')
        .upload(path, buffer, { contentType: item.mimeType, upsert: false });
      if (error) throw error;

      const { error: insertErr } = await supabase.from('recordings').insert({
        workspace_id: item.workspaceId,
        created_by: (await supabase.auth.getUser()).data.user?.id,
        status: 'transcribing',
        duration_ms: item.durationMs,
        size_bytes: item.sizeBytes,
        mime_type: item.mimeType,
        storage_path: path,
        storage_bucket: 'audio-raw',
        captured_at: item.capturedAt,
      });
      if (insertErr) throw insertErr;

      await FileSystem.deleteAsync(item.uri, { idempotent: true });
    } catch (err) {
      console.warn('[queue] upload failed', err);
      if (item.attempts < 5) remaining.push({ ...item, attempts: item.attempts + 1 });
    }
  }

  await writeQueue(remaining);
}
