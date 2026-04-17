import { useAudioRecorder as useExpoAudioRecorder, AudioModule, RecordingPresets } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

export type RecordingState = "idle" | "recording" | "paused" | "stopped";

export interface AudioRecorderHook {
  state: RecordingState;
  duration: number;
  audioLevels: number[];
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  discardRecording: () => Promise<void>;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
}

export function useAudioRecorder(): AudioRecorderHook {
  const recorder = useExpoAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(30).fill(0));
  const [hasPermission, setHasPermission] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    checkPermission();
    return () => {
      clearTimers();
    };
  }, []);

  const checkPermission = async () => {
    if (Platform.OS === "web") {
      setHasPermission(true);
      return;
    }
    const status = await AudioModule.requestRecordingPermissionsAsync();
    setHasPermission(status.granted);
  };

  const requestPermission = async (): Promise<boolean> => {
    const status = await AudioModule.requestRecordingPermissionsAsync();
    setHasPermission(status.granted);
    return status.granted;
  };

  const clearTimers = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (levelTimerRef.current) {
      clearInterval(levelTimerRef.current);
      levelTimerRef.current = null;
    }
  };

  const startTimers = () => {
    // Duration timer
    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);

    // Audio level simulation (real levels from recorder when available)
    levelTimerRef.current = setInterval(() => {
      setAudioLevels((prev) => {
        const newLevel = Math.random() * 0.8 + 0.1;
        const updated = [...prev.slice(1), newLevel];
        return updated;
      });
    }, 100);
  };

  const startRecording = useCallback(async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return;
    }

    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      setState("recording");
      setDuration(0);
      setAudioLevels(Array(30).fill(0));
      startTimers();
    } catch (error) {
      console.error("[AudioRecorder] Failed to start:", error);
    }
  }, [hasPermission, recorder]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (state !== "recording" && state !== "paused") return null;

    try {
      clearTimers();
      await recorder.stop();
      setState("stopped");

      const uri = recorder.uri;
      return uri || null;
    } catch (error) {
      console.error("[AudioRecorder] Failed to stop:", error);
      setState("idle");
      return null;
    }
  }, [state, recorder]);

  const pauseRecording = useCallback(() => {
    if (state !== "recording") return;
    recorder.pause();
    setState("paused");
    clearTimers();
  }, [state, recorder]);

  const resumeRecording = useCallback(() => {
    if (state !== "paused") return;
    recorder.record();
    setState("recording");
    startTimers();
  }, [state, recorder]);

  const discardRecording = useCallback(async () => {
    clearTimers();
    if (state === "recording" || state === "paused") {
      try {
        await recorder.stop();
      } catch {}
    }
    setState("idle");
    setDuration(0);
    setAudioLevels(Array(30).fill(0));
  }, [state, recorder]);

  return {
    state,
    duration,
    audioLevels,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    discardRecording,
    hasPermission,
    requestPermission,
  };
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
