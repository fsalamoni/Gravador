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
      <div className="rounded-[28px] border border-dashed border-border bg-[#100c09]/45 px-6 py-10 text-center text-mute">
        A transcrição aparecerá aqui quando o processamento terminar.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-4xl">
      {segments.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() =>
            (window as unknown as { gravadorSeek?: (ms: number) => void }).gravadorSeek?.(
              s.start_ms,
            )
          }
          className="group block w-full rounded-[24px] border border-border bg-[#100c09]/55 p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-surfaceAlt/80"
        >
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-mute">
            <span className="rounded-full border border-accent/35 bg-accent/10 px-3 py-1 font-mono text-accentSoft">
              {formatDurationMs(s.start_ms)}
            </span>
            {s.speaker_id ? (
              <span className="rounded-full border border-border px-3 py-1 text-[11px] text-mute">
                Falante {s.speaker_id.slice(0, 6)}
              </span>
            ) : null}
          </div>
          <p className="leading-8 text-text transition group-hover:text-white">{s.text}</p>
        </button>
      ))}
    </div>
  );
}
