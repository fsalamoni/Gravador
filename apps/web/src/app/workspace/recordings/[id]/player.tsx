'use client';

import { formatDurationMs } from '@gravador/core';
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
      waveColor: '#3a4058',
      progressColor: '#7c5cff',
      cursorColor: '#a08bff',
      barWidth: 2,
      barRadius: 2,
      height: 80,
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
    <div>
      <div ref={containerRef} />
      <div className="flex items-center justify-between mt-3 text-sm text-mute">
        <span>{formatDurationMs(current)}</span>
        <button
          type="button"
          onClick={() => wsRef.current?.playPause()}
          className="bg-accent text-white px-4 py-1.5 rounded-lg hover:bg-accentSoft"
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <span>{formatDurationMs(duration)}</span>
      </div>
    </div>
  );
}
