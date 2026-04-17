'use client';

import { formatDurationMs } from '@gravador/core';

interface Chapter {
  id?: string;
  title: string;
  startMs: number;
  endMs: number;
  summary: string;
}

export function ChaptersView({ payload }: { payload: unknown }) {
  const chapters = (payload as Chapter[] | undefined) ?? [];
  if (chapters.length === 0) return <p className="text-mute">Capítulos em processamento…</p>;
  return (
    <ol className="space-y-3 max-w-3xl">
      {chapters.map((c, i) => (
        <li key={c.id ?? i} className="card p-5">
          <button
            type="button"
            onClick={() =>
              (window as unknown as { gravadorSeek?: (ms: number) => void }).gravadorSeek?.(
                c.startMs,
              )
            }
            className="text-left w-full group"
          >
            <div className="flex justify-between items-baseline mb-2">
              <h3 className="font-medium group-hover:text-accentSoft">
                {i + 1}. {c.title}
              </h3>
              <span className="font-mono text-mute text-sm">
                {formatDurationMs(c.startMs)} – {formatDurationMs(c.endMs)}
              </span>
            </div>
            <p className="text-mute text-sm leading-relaxed">{c.summary}</p>
          </button>
        </li>
      ))}
    </ol>
  );
}
