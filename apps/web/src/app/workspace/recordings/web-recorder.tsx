'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Phase = 'idle' | 'recording' | 'paused' | 'uploading';

export function WebRecorder({ onRecorded }: { onRecorded?: () => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 200);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        for (const track of stream.getTracks()) track.stop();
        stopTimer();

        const blob = new Blob(chunksRef.current, { type: mimeType });
        const durationMs = Date.now() - startTimeRef.current;

        if (durationMs < 500) {
          setPhase('idle');
          setElapsed(0);
          return;
        }

        setPhase('uploading');
        try {
          const formData = new FormData();
          formData.append('file', blob, `web-recording-${Date.now()}.webm`);
          formData.append('durationMs', String(durationMs));
          formData.append('mimeType', mimeType);
          formData.append('capturedAt', new Date().toISOString());

          const res = await fetch('/api/recordings/upload', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `Upload failed: ${res.status}`);
          }

          onRecorded?.();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro ao enviar gravação');
        } finally {
          setPhase('idle');
          setElapsed(0);
        }
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setPhase('recording');
      startTimer();
    } catch {
      setError('Permissão de microfone negada ou não disponível.');
    }
  }, [startTimer, stopTimer, onRecorded]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      stopTimer();
      setPhase('paused');
    }
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      startTimer();
      setPhase('recording');
    }
  }, [startTimer]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-4">
      {phase === 'idle' && (
        <button
          type="button"
          onClick={startRecording}
          className="flex items-center gap-2 bg-accent hover:bg-accentSoft text-white px-5 py-2.5 rounded-xl font-medium transition"
        >
          <span className="w-3 h-3 bg-white rounded-full" />
          Gravar
        </button>
      )}

      {phase === 'recording' && (
        <>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-danger rounded-full animate-pulse" />
            <span className="font-mono text-sm">{formatTime(elapsed)}</span>
          </div>
          <button
            type="button"
            onClick={pauseRecording}
            className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-surfaceAlt transition"
          >
            Pausar
          </button>
          <button
            type="button"
            onClick={stopRecording}
            className="px-3 py-1.5 rounded-lg bg-danger text-white text-sm hover:bg-danger/80 transition"
          >
            Parar
          </button>
        </>
      )}

      {phase === 'paused' && (
        <>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-mute rounded-full" />
            <span className="font-mono text-sm">{formatTime(elapsed)}</span>
            <span className="text-xs text-mute">Pausado</span>
          </div>
          <button
            type="button"
            onClick={resumeRecording}
            className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-surfaceAlt transition"
          >
            Continuar
          </button>
          <button
            type="button"
            onClick={stopRecording}
            className="px-3 py-1.5 rounded-lg bg-danger text-white text-sm hover:bg-danger/80 transition"
          >
            Parar
          </button>
        </>
      )}

      {phase === 'uploading' && (
        <div className="flex items-center gap-2 text-mute text-sm">
          <span className="animate-spin">⏳</span>
          Enviando gravação…
        </div>
      )}

      {error && <p className="text-danger text-sm">{error}</p>}
    </div>
  );
}
