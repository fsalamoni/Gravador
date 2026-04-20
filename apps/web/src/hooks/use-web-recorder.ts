'use client';

import { shortId } from '@gravador/core';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { useRef, useState } from 'react';
import { auth, db, storage } from '../lib/firebase-browser';

export interface UseWebRecorderOptions {
  workspaceId: string;
}

export function useWebRecorder({ workspaceId }: UseWebRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType;
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await handleUpload(audioBlob, mimeType);

        // Stop all tracks to release microphone
        for (const track of stream.getTracks()) {
          track.stop();
        }
      };

      mediaRecorder.start();
      startTimeRef.current = Date.now();
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setDurationMs(Date.now() - startTimeRef.current);
        }
      }, 100);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Não foi possível acessar o microfone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const handleUpload = async (blob: Blob, mimeType: string) => {
    try {
      setIsUploading(true);
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');

      const id = shortId();
      const storagePath = `anotes/audio-raw/${workspaceId}/${id}.m4a`; // Using .m4a as extension but keeping mimeType

      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, blob, { contentType: mimeType });

      await addDoc(collection(db, 'recordings'), {
        workspaceId,
        createdBy: userId,
        status: 'transcribing',
        durationMs: durationMs,
        sizeBytes: blob.size,
        mimeType,
        storagePath,
        storageBucket: 'default',
        capturedAt: new Date(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
      });

      setDurationMs(0);
    } catch (error) {
      console.error('Error uploading recording:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return {
    isRecording,
    isUploading,
    durationMs,
    startRecording,
    stopRecording,
  };
}
