'use client';

import { getDefaultRecordingLifecycle, getDefaultRetentionPolicy } from '@/lib/recording-lifecycle';
import { shortId } from '@gravador/core';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { useEffect, useRef, useState } from 'react';
import { auth, db, storage } from '../lib/firebase-browser';

export interface UseWebRecorderOptions {
  workspaceId: string;
}

function isStorageUnauthorizedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const maybeCode =
    'code' in error && typeof error.code === 'string' ? error.code.toLowerCase() : '';
  const maybeMessage =
    'message' in error && typeof error.message === 'string' ? error.message.toLowerCase() : '';

  return (
    maybeCode === 'storage/unauthorized' ||
    maybeCode === 'storage/unauthenticated' ||
    maybeMessage.includes('storage/unauthorized') ||
    maybeMessage.includes('does not have permission')
  );
}

async function uploadRecordingViaServer(params: {
  blob: Blob;
  mimeType: string;
  workspaceId: string;
  durationMs: number;
}) {
  const form = new FormData();
  form.set('workspaceId', params.workspaceId);
  form.set('durationMs', String(Math.max(0, Math.round(params.durationMs))));
  form.set('mimeType', params.mimeType);
  form.set('audio', params.blob, `${shortId()}.m4a`);

  const response = await fetch('/api/recordings/upload', {
    method: 'POST',
    body: form,
    credentials: 'include',
  });

  if (response.ok) return;

  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error ? `upload_api_failed:${body.error}` : 'upload_api_failed');
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
      finalDurationRef.current = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
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

      if (!userId) {
        await uploadRecordingViaServer({
          blob,
          mimeType,
          workspaceId,
          durationMs: finalDurationMs,
        });
        setDurationMs(0);
        setStatusMessage(
          'Gravação salva. Use os botões de IA na página para iniciar o processamento.',
        );
        return;
      }

      const id = shortId();
      const storagePath = `anotes/audio-raw/${workspaceId}/${id}.m4a`; // Using .m4a as extension but keeping mimeType

      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, blob, { contentType: mimeType });

      const lifecycle = getDefaultRecordingLifecycle({
        source: 'web',
        recordingId: id,
        actorId: userId,
      });

      await addDoc(collection(db, 'recordings'), {
        workspaceId,
        createdBy: userId,
        status: 'uploaded',
        durationMs: finalDurationMs,
        sizeBytes: blob.size,
        mimeType,
        storagePath,
        storageBucket: 'default',
        capturedAt: new Date(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
        pipelineResults: {},
        lifecycle: {
          ...lifecycle,
          lastEventAt: serverTimestamp(),
        },
        retention: getDefaultRetentionPolicy(),
      });

      setDurationMs(0);
      setStatusMessage(
        'Gravação salva. Use os botões de IA na página para iniciar o processamento.',
      );
    } catch (error) {
      if (isStorageUnauthorizedError(error)) {
        try {
          console.warn('[web-recorder] storage upload unauthorized; retrying via server route');
          await uploadRecordingViaServer({
            blob,
            mimeType,
            workspaceId,
            durationMs: finalDurationMs,
          });
          setDurationMs(0);
          setStatusMessage(
            'Gravação salva. Use os botões de IA na página para iniciar o processamento.',
          );
          return;
        } catch (fallbackError) {
          console.error('Error uploading recording via server fallback:', fallbackError);
        }
      }

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
