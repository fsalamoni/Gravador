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
  const [audioUnavailable, setAudioUnavailable] = useState(false);

  const waveformParity = getWaveformParityReport(expectedDurationMs, duration);
  const hasParityWarning = !!waveformParity && waveReady && waveformParity.hasWarning;

  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;
    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration * 1000);
      }
      setAudioUnavailable(false);
    };

    const handleTimeUpdate = () => {
      if (!waveReady) {
        setCurrent(audio.currentTime * 1000);
      }
    };

    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);
    const handleEnded = () => {
      setPlaying(false);
      setCurrent(0);
    };
    const handleError = () => {
      setAudioUnavailable(true);
      setWaveReady(false);
      setPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [waveReady]);

  useEffect(() => {
    if (!containerRef.current || !src || !audioRef.current) return;

    const audio = audioRef.current;
    audio.src = src;
    audio.load();
    setAudioUnavailable(false);
    setWaveReady(false);
    setCurrent(0);
    setDuration(0);

    if (wsRef.current) {
      wsRef.current.destroy();
      wsRef.current = null;
    }

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
    ws.on('error', () => {
      setWaveReady(false);
    });

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
        {src && !audioUnavailable ? (
          <div ref={containerRef} />
        ) : (
          <div className="flex h-[104px] items-center justify-center rounded-[22px] border border-dashed border-border text-sm text-mute">
            {src
              ? 'Não foi possível carregar o áudio para reprodução.'
              : 'O áudio ainda não está disponível para reprodução.'}
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
          disabled={!src || audioUnavailable}
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
