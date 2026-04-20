import { shortId } from '@gravador/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../../lib/firebase';

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
 * Drain the queue, uploading each item to Firebase Storage.
 */
export async function drainQueue(onProgress?: (item: QueuedUpload) => void): Promise<void> {
  const queue = await readQueue();
  const remaining: QueuedUpload[] = [];

  for (const item of queue) {
    try {
      onProgress?.(item);
      const fileInfo = await FileSystem.getInfoAsync(item.uri);
      if (!fileInfo.exists) continue; // drop if file is gone

      const storagePath = `anotes/audio-raw/${item.workspaceId}/${item.id}.m4a`;
      const bytes = await FileSystem.readAsStringAsync(item.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to Uint8Array
      // biome-ignore lint/suspicious/noExplicitAny: atob exists on RN globalThis but not in TS types
      const raw = (globalThis as any).atob(bytes) as string;
      const byteArray = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        byteArray[i] = raw.charCodeAt(i);
      }

      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, byteArray, { contentType: item.mimeType });

      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error('User not authenticated — cannot create recording');
      }
      await addDoc(collection(db, 'recordings'), {
        workspaceId: item.workspaceId,
        createdBy: userId,
        status: 'transcribing',
        durationMs: item.durationMs,
        sizeBytes: item.sizeBytes,
        mimeType: item.mimeType,
        storagePath,
        storageBucket: 'default',
        capturedAt: new Date(item.capturedAt),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
      });

      await FileSystem.deleteAsync(item.uri, { idempotent: true });
    } catch (err) {
      console.warn('[queue] upload failed', err);
      if (item.attempts < 5) remaining.push({ ...item, attempts: item.attempts + 1 });
    }
  }

  await writeQueue(remaining);
}
