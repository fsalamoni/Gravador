import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Waveform } from '../src/components/Waveform';
import { drainQueue, enqueueUpload } from '../src/features/recorder/queue';
import { useRecordingController } from '../src/features/recorder/recorder';
import { useRecorder } from '../src/features/recorder/store';
import { auth } from '../src/lib/firebase';
import { t } from '../src/lib/i18n';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { start, stop, pause, resume } = useRecordingController();
  const state = useRecorder((s) => s.state);
  const router = useRouter();

  useEffect(() => {
    drainQueue().catch(() => undefined);
  }, []);

  const isRecording = state.phase === 'recording';
  const isPaused = state.phase === 'paused';

  return (
    <View
      className="flex-1 bg-bg"
      style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
    >
      <View className="px-6">
        <Text className="text-mute text-sm tracking-widest">GRAVADOR</Text>
        <Text className="text-text text-3xl font-semibold mt-1">
          {isRecording
            ? t('recorder.recording')
            : isPaused
              ? t('recorder.pause')
              : t('recorder.quickAction')}
        </Text>
        <Text className="text-mute mt-2">{t('recorder.background')}</Text>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        <View className="w-full mb-12">
          <Waveform meters={(state as { meters?: number[] }).meters ?? []} />
        </View>

        <Pressable
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (state.phase === 'idle' || state.phase === 'stopped') {
              await start();
            } else if (isRecording) {
              const { uri, durationMs, sizeBytes } = await stop();
              if (uri && durationMs > 500) {
                const userId = auth.currentUser?.uid;
                if (!userId) throw new Error('Not authenticated');
                await enqueueUpload({
                  workspaceId: userId,
                  uri,
                  durationMs,
                  sizeBytes,
                  mimeType: 'audio/m4a',
                  capturedAt: new Date().toISOString(),
                });
                drainQueue().catch(() => undefined);
                router.push('/recordings');
              }
            }
          }}
          className={`w-32 h-32 rounded-full items-center justify-center ${
            isRecording ? 'bg-danger' : 'bg-accent'
          }`}
        >
          <View
            className={
              isRecording ? 'w-10 h-10 bg-white rounded-md' : 'w-12 h-12 bg-white rounded-full'
            }
          />
        </Pressable>

        {isRecording ? (
          <Pressable className="mt-6" onPress={() => pause()}>
            <Text className="text-accentSoft text-base">{t('recorder.pause')}</Text>
          </Pressable>
        ) : isPaused ? (
          <Pressable className="mt-6" onPress={() => resume()}>
            <Text className="text-accentSoft text-base">{t('recorder.resume')}</Text>
          </Pressable>
        ) : null}
      </View>

      <View className="px-6 flex-row justify-between">
        <Pressable onPress={() => router.push('/recordings')}>
          <Text className="text-mute">{t('nav.recordings')}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/settings')}>
          <Text className="text-mute">{t('nav.settings')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
