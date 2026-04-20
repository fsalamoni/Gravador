'use client';

import { useWebRecorder } from '@/hooks/use-web-recorder';
import { formatDurationMs } from '@gravador/core';
import { Mic, StopCircle } from 'lucide-react';

interface WebRecorderButtonProps {
  workspaceId: string;
}

export function WebRecorderButton({ workspaceId }: WebRecorderButtonProps) {
  const { isRecording, isUploading, durationMs, statusMessage, startRecording, stopRecording } =
    useWebRecorder({
      workspaceId,
    });

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-3">
        {isRecording && (
          <div className="animate-pulse text-sm font-mono text-danger">
            {formatDurationMs(durationMs)}
          </div>
        )}

        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isUploading}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition disabled:opacity-50 ${
            isRecording
              ? 'bg-danger text-white hover:bg-danger/90'
              : 'bg-accent text-onAccent hover:bg-accentSoft'
          }`}
          title={isRecording ? 'Parar gravação' : 'Iniciar gravação'}
        >
          {isRecording ? <StopCircle className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {isRecording ? 'Parar gravação' : 'Gravar'}
        </button>
      </div>

      {statusMessage && <div className="text-right text-xs text-mute">{statusMessage}</div>}
    </div>
  );
}
