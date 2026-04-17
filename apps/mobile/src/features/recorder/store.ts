import { create } from 'zustand';

export type RecorderState =
  | { phase: 'idle' }
  | { phase: 'recording'; startedAt: number; uri: string; meters: number[] }
  | { phase: 'paused'; startedAt: number; uri: string; meters: number[]; pausedAt: number }
  | { phase: 'stopped'; uri: string; durationMs: number; meters: number[] };

interface RecorderStore {
  state: RecorderState;
  setState: (s: RecorderState) => void;
  pushMeter: (db: number) => void;
  reset: () => void;
}

export const useRecorder = create<RecorderStore>((set, get) => ({
  state: { phase: 'idle' },
  setState: (s) => set({ state: s }),
  pushMeter: (db) => {
    const s = get().state;
    if (s.phase === 'recording' || s.phase === 'paused') {
      const meters = [...s.meters, db];
      if (meters.length > 600) meters.shift();
      set({ state: { ...s, meters } });
    }
  },
  reset: () => set({ state: { phase: 'idle' } }),
}));
