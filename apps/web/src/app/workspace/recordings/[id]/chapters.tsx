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
  if (chapters.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-border bg-[#100c09]/45 px-6 py-10 text-center text-mute">
        Capítulos em processamento…
      </div>
    );
  }

  return (
    <ol className="max-w-4xl space-y-3">
      {chapters.map((c, i) => (
        <li key={c.id ?? i} className="card p-6">
          <button
            type="button"
            onClick={() =>
              (window as unknown as { gravadorSeek?: (ms: number) => void }).gravadorSeek?.(
                c.startMs,
              )
            }
            className="group w-full text-left"
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <h3 className="text-xl font-semibold text-text transition group-hover:text-accentSoft">
                {i + 1}. {c.title}
              </h3>
              <span className="rounded-full border border-accent/35 bg-accent/10 px-3 py-1 font-mono text-xs text-accentSoft">
                {formatDurationMs(c.startMs)} – {formatDurationMs(c.endMs)}
              </span>
            </div>
            <p className="text-sm leading-7 text-mute">{c.summary}</p>
          </button>
        </li>
      ))}
    </ol>
  );
}
