import { useMemo } from 'react';
import { View } from 'react-native';

interface WaveformProps {
  meters: number[];
  barCount?: number;
  color?: string;
}

/**
 * Minimal reactive waveform: takes raw dB meter samples and renders a bar row.
 * Mapping is logarithmic-friendly: dB ∈ [-60, 0] → height ∈ [0.06, 1].
 */
export function Waveform({ meters, barCount = 48, color = '#f38a37' }: WaveformProps) {
  const bars = useMemo(() => downsample(meters, barCount), [meters, barCount]);
  return (
    <View className="flex-row items-end h-28 gap-[3px]">
      {bars.map((v, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: waveform bars are positional, not identity-based
          key={i}
          style={{
            flex: 1,
            height: `${Math.max(6, v * 100)}%`,
            backgroundColor: color,
            borderRadius: 999,
            opacity: 0.52 + v * 0.48,
          }}
        />
      ))}
    </View>
  );
}

function downsample(meters: number[], target: number): number[] {
  if (meters.length === 0) return new Array(target).fill(0.06);
  const out: number[] = [];
  const step = meters.length / target;
  for (let i = 0; i < target; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    let sum = 0;
    let n = 0;
    for (let j = start; j < Math.max(end, start + 1); j++) {
      const db = meters[j] ?? -60;
      const norm = Math.min(1, Math.max(0, (db + 60) / 60));
      sum += norm;
      n++;
    }
    out.push(n > 0 ? sum / n : 0.06);
  }
  return out;
}
