import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Reads a local audio file and converts it to base64 for upload.
 */
export async function readAudioFileAsBase64(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    // Web: fetch the blob and convert
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Native: use FileSystem
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64;
}

/**
 * Gets file info (size, etc.) for a local audio file.
 */
export async function getAudioFileInfo(uri: string): Promise<{ size: number; exists: boolean }> {
  if (Platform.OS === "web") {
    return { size: 0, exists: true };
  }
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      return { size: (info as any).size || 0, exists: true };
    }
    return { size: 0, exists: false };
  } catch {
    return { size: 0, exists: false };
  }
}

/**
 * Generates a filename for the recording.
 */
export function generateAudioFileName(recordingId: string, mimeType: string): string {
  const ext = mimeType.includes("m4a") ? "m4a" : mimeType.includes("mp4") ? "mp4" : "m4a";
  return `recording_${recordingId}_${Date.now()}.${ext}`;
}

/**
 * Deletes a local audio file after successful upload.
 */
export async function deleteLocalAudioFile(uri: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch (e) {
    console.warn("[UploadService] Failed to delete local file:", e);
  }
}
