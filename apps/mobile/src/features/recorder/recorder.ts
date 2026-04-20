import { AudioModule, type AudioRecorder, useAudioRecorder } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { useRecorder } from './store';

/**
 * `useRecordingController` owns the expo-audio recorder instance, manages
 * meter polling, and exposes stable start/stop/pause/resume callbacks.
 *
 * Background behaviour is configured at the native layer via `UIBackgroundModes`
 * (iOS) and a foreground service notification (Android), declared in app.config.js.
 */
export function useRecordingController() {
  const recorder = useAudioRecorder({
    extension: '.m4a',
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
    ios: {
      audioQuality: 127,
      outputFormat: 'mpeg4aac',
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
  });

  const meterTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = async () => {
    const granted = await AudioModule.requestRecordingPermissionsAsync();
    if (!granted.granted) throw new Error('microphone_permission_denied');

    await recorder.prepareToRecordAsync();
    recorder.record();

    await showOngoingNotification();
    useRecorder.getState().setState({
      phase: 'recording',
      startedAt: Date.now(),
      uri: recorder.uri ?? '',
      meters: [],
    });
    meterTimer.current = setInterval(async () => {
      const status = recorder.getStatus();
      if (status.metering != null) useRecorder.getState().pushMeter(status.metering);
    }, 100);
  };

  const pause = async () => {
    recorder.pause();
    const s = useRecorder.getState().state;
    if (s.phase === 'recording') {
      useRecorder.getState().setState({ ...s, phase: 'paused', pausedAt: Date.now() });
    }
  };

  const resume = async () => {
    recorder.record();
    const s = useRecorder.getState().state;
    if (s.phase === 'paused') {
      useRecorder.getState().setState({
        phase: 'recording',
        startedAt: s.startedAt,
        uri: s.uri,
        meters: s.meters,
      });
    }
  };

  const stop = async () => {
    if (meterTimer.current) clearInterval(meterTimer.current);
    await recorder.stop();
    await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
    const s = useRecorder.getState().state;
    const uri = recorder.uri ?? (s.phase !== 'idle' ? s.uri : '');
    const info = uri ? await FileSystem.getInfoAsync(uri) : null;
    const durationMs = s.phase !== 'idle' && s.phase !== 'stopped' ? Date.now() - s.startedAt : 0;
    const meters = s.phase !== 'idle' ? ((s as { meters?: number[] }).meters ?? []) : [];

    useRecorder.getState().setState({ phase: 'stopped', uri, durationMs, meters });
    return { uri, durationMs, sizeBytes: info?.exists ? (info.size ?? 0) : 0 };
  };

  useEffect(
    () => () => {
      if (meterTimer.current) clearInterval(meterTimer.current);
    },
    [],
  );

  return { start, stop, pause, resume, recorder };
}

async function showOngoingNotification() {
  try {
    await Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    await Notifications.scheduleNotificationAsync({
      identifier: 'gravador-recording',
      content: {
        title: '🎙️ Gravando…',
        body: 'Toque para abrir o Gravador',
        sticky: true,
      },
      trigger: null,
    });
  } catch {}
}

export type { AudioRecorder };
