'use client';

import { getWaveformParityReport } from '@/lib/waveform-parity';
import { formatDurationMs } from '@gravador/core';
import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

export function Player({ src, expectedDurationMs }: { src: string; expectedDurationMs?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveReady, setWaveReady] = useState(false);

  const waveformParity = getWaveformParityReport(expectedDurationMs, duration);
  const hasParityWarning = !!waveformParity && waveReady && waveformParity.hasWarning;

  useEffect(() => {
    if (!containerRef.current || !src || !audioRef.current) return;

    const audio = audioRef.current;
    audio.src = src;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'rgb(var(--color-mute) / 0.4)',
      progressColor: 'rgb(var(--color-accent))',
      cursorColor: 'rgb(var(--color-accentSoft))',
      barWidth: 3,
      barGap: 2,
      barRadius: 999,
      height: 104,
      // Use our own audio element so the browser handles decoding
      // (avoids AudioContext CORS restrictions with signed URLs)
      media: audio,
    });

    ws.on('ready', () => {
      setDuration(ws.getDuration() * 1000);
      setWaveReady(true);
    });
    ws.on('audioprocess', (t) => setCurrent(t * 1000));
    ws.on('seeking', (t) => setCurrent(t * 1000));
    ws.on('play', () => setPlaying(true));
    ws.on('pause', () => setPlaying(false));
    ws.on('finish', () => setPlaying(false));

    wsRef.current = ws;
    return () => {
      ws.destroy();
      setWaveReady(false);
    };
  }, [src]);

  // Expose global seek hook for transcript/chat
  useEffect(() => {
    (window as unknown as { gravadorSeek?: (ms: number) => void }).gravadorSeek = (ms) => {
      const ws = wsRef.current;
      if (!ws) return;
      ws.seekTo(Math.max(0, Math.min(1, ms / 1000 / ws.getDuration())));
      if (!ws.isPlaying()) ws.play();
    };
  }, []);

  const handlePlayPause = () => {
    const ws = wsRef.current;
    const audio = audioRef.current;
    if (ws && waveReady) {
      ws.playPause();
    } else if (audio) {
      // Fallback: use native audio element directly if WaveSurfer not ready
      if (audio.paused) {
        void audio.play();
        setPlaying(true);
      } else {
        audio.pause();
        setPlaying(false);
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* Hidden native audio element - handles actual playback without CORS issues */}
      {/* biome-ignore lint/a11y/useMediaCaption: recording playback */}
      <audio ref={audioRef} preload="metadata" className="hidden" />

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
          onClick={handlePlayPause}
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent text-onAccent transition hover:bg-accentSoft disabled:opacity-60"
          disabled={!src}
          aria-label={playing ? 'Pause audio' : 'Play audio'}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>
        <div className="rounded-full border border-border px-3 py-1.5 font-mono">
          {formatDurationMs(duration)}
        </div>
      </div>

      {waveformParity ? (
        <div
          className={`rounded-[20px] border px-4 py-3 text-sm ${
            hasParityWarning
              ? 'border-warning/45 bg-warning/10 text-warning'
              : 'border-ok/35 bg-ok/10 text-ok'
          }`}
        >
          Waveform duration {hasParityWarning ? 'differs from' : 'matches'} expected recording
          duration by {Math.round(waveformParity.durationDeltaMs / 1000)}s.
        </div>
      ) : null}
    </div>
  );
}
