'use client';

import { useWebRecorder } from '@/hooks/use-web-recorder';
import { formatDurationMs } from '@gravador/core';
import { Mic, StopCircle } from 'lucide-react';

interface WebRecorderButtonProps {
  workspaceId: string;
}

export function WebRecorderButton({ workspaceId }: WebRecorderButtonProps) {
  const { isRecording, isUploading, durationMs, startRecording, stopRecording } = useWebRecorder({
    workspaceId,
  });

  return (
    <div className="flex items-center gap-4">
      {isRecording && (
        <div className="text-sm font-mono text-danger animate-pulse">
          {formatDurationMs(durationMs)}
        </div>
      )}

      {isUploading && <div className="text-sm text-mute">Enviando...</div>}

      {isRecording ? (
        <button
          type="button"
          onClick={stopRecording}
          disabled={isUploading}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger transition hover:bg-danger/20 disabled:opacity-50"
          title="Parar gravação"
        >
          <StopCircle className="h-6 w-6" />
        </button>
      ) : (
        <button
          type="button"
          onClick={startRecording}
          disabled={isUploading}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent transition hover:bg-accent/20 disabled:opacity-50"
          title="Iniciar gravação"
        >
          <Mic className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
