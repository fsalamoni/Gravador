'use client';

import { formatDurationMs } from '@gravador/core';

interface Segment {
  id: string;
  start_ms: number;
  end_ms: number;
  text: string;
  speaker_id: string | null;
}

export function TranscriptView({ segments }: { segments: Segment[] }) {
  if (segments.length === 0) {
    return (
      <p className="text-mute">A transcrição aparecerá aqui quando o processamento terminar.</p>
    );
  }
  return (
    <div className="space-y-3 max-w-3xl">
      {segments.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() =>
            (window as unknown as { gravadorSeek?: (ms: number) => void }).gravadorSeek?.(
              s.start_ms,
            )
          }
          className="block text-left w-full hover:bg-surfaceAlt p-3 rounded-lg transition group"
        >
          <div className="flex gap-3 text-sm text-mute mb-1">
            <span className="text-accentSoft font-mono">{formatDurationMs(s.start_ms)}</span>
            {s.speaker_id ? <span>Falante {s.speaker_id.slice(0, 6)}</span> : null}
          </div>
          <p className="text-text leading-relaxed group-hover:text-white">{s.text}</p>
        </button>
      ))}
    </div>
  );
}
