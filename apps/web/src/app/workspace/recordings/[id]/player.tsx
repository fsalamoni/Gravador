'use client';

import { formatDurationMs } from '@gravador/core';
import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

export function Player({ src }: { src: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!containerRef.current || !src) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4a372a',
      progressColor: 'rgb(var(--color-accent))',
      cursorColor: '#ffc48f',
      barWidth: 3,
      barGap: 2,
      barRadius: 999,
      height: 104,
      url: src,
    });
    ws.on('ready', () => setDuration(ws.getDuration() * 1000));
    ws.on('audioprocess', (t) => setCurrent(t * 1000));
    ws.on('seeking', (t) => setCurrent(t * 1000));
    ws.on('play', () => setPlaying(true));
    ws.on('pause', () => setPlaying(false));
    wsRef.current = ws;
    return () => ws.destroy();
  }, [src]);

  // Expose a global seek hook used by the transcript + chat to jump around
  useEffect(() => {
    (window as unknown as { gravadorSeek?: (ms: number) => void }).gravadorSeek = (ms) => {
      const ws = wsRef.current;
      if (!ws) return;
      ws.seekTo(Math.max(0, Math.min(1, ms / 1000 / ws.getDuration())));
      if (!ws.isPlaying()) ws.play();
    };
  }, []);

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-border bg-bg/55 p-5">
        {src ? (
          <div ref={containerRef} />
        ) : (
          <div className="flex h-[104px] items-center justify-center rounded-[22px] border border-dashed border-border text-sm text-mute">
            O áudio ainda não está disponível para reprodução.
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[26px] border border-border bg-surfaceAlt/70 px-4 py-4 text-sm text-mute">
        <div className="rounded-full border border-border px-3 py-1.5 font-mono">
          {formatDurationMs(current)}
        </div>
        <button
          type="button"
          onClick={() => wsRef.current?.playPause()}
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent text-onAccent transition hover:bg-accentSoft disabled:opacity-60"
          disabled={!src}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>
        <div className="rounded-full border border-border px-3 py-1.5 font-mono">
          {formatDurationMs(duration)}
        </div>
      </div>
    </div>
  );
}
