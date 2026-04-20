'use client';

import { shortId } from '@gravador/core';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { useEffect, useRef, useState } from 'react';
import { auth, db, storage } from '../lib/firebase-browser';

export interface UseWebRecorderOptions {
  workspaceId: string;
}

export function useWebRecorder({ workspaceId }: UseWebRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalDurationRef = useRef(0);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    },
    [],
  );

  const startRecording = async () => {
    try {
      setStatusMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
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
        await handleUpload(audioBlob, mimeType, finalDurationRef.current);

        // Stop all tracks to release microphone
        for (const track of stream.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      };

      mediaRecorder.start();
      startTimeRef.current = Date.now();
      finalDurationRef.current = 0;
      setIsRecording(true);
      setStatusMessage('Gravando no navegador…');

      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setDurationMs(Date.now() - startTimeRef.current);
        }
      }, 100);
    } catch (error) {
      console.error('Error starting recording:', error);
      setStatusMessage('Não foi possível acessar o microfone deste dispositivo.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      finalDurationRef.current = startTimeRef.current
        ? Date.now() - startTimeRef.current
        : durationMs;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatusMessage('Finalizando e enviando a gravação…');

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const handleUpload = async (blob: Blob, mimeType: string, finalDurationMs: number) => {
    try {
      setIsUploading(true);
      setStatusMessage('Enviando áudio e registrando a gravação…');
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');

      const id = shortId();
      const storagePath = `anotes/audio-raw/${workspaceId}/${id}.m4a`; // Using .m4a as extension but keeping mimeType

      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, blob, { contentType: mimeType });

      const recordingRef = await addDoc(collection(db, 'recordings'), {
        workspaceId,
        createdBy: userId,
        status: 'transcribing',
        durationMs: finalDurationMs,
        sizeBytes: blob.size,
        mimeType,
        storagePath,
        storageBucket: 'default',
        capturedAt: new Date(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
      });

      void fetch('/api/integrations/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingId: recordingRef.id }),
      }).catch(() => undefined);

      setDurationMs(0);
      setStatusMessage('Gravação salva. O processamento já foi iniciado.');
    } catch (error) {
      console.error('Error uploading recording:', error);
      setStatusMessage('Falha ao salvar a gravação. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  return {
    isRecording,
    isUploading,
    durationMs,
    statusMessage,
    startRecording,
    stopRecording,
  };
}
