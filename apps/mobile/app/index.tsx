import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StudioPanel, StudioPill, StudioScreen } from '../src/components/StudioScreen';
import { Waveform } from '../src/components/Waveform';
import { drainQueue, enqueueUpload } from '../src/features/recorder/queue';
import { useRecordingController } from '../src/features/recorder/recorder';
import { useRecorder } from '../src/features/recorder/store';
import { auth } from '../src/lib/firebase';
import { t } from '../src/lib/i18n';

export default function HomeScreen() {
  const { start, stop, pause, resume } = useRecordingController();
  const state = useRecorder((s) => s.state);
  const router = useRouter();

  useEffect(() => {
    drainQueue().catch(() => undefined);
  }, []);

  const isRecording = state.phase === 'recording';
  const isPaused = state.phase === 'paused';
  const phaseTitle = isRecording
    ? t('recorder.recording')
    : isPaused
      ? t('recorder.pause')
      : t('recorder.quickAction');
  const phaseHint = isRecording
    ? 'Captura em andamento com visualização em tempo real.'
    : isPaused
      ? 'A sessão está pronta para voltar sem perder o contexto.'
      : t('recorder.background');

  return (
    <StudioScreen className="pb-6 pt-2">
      <View className="gap-5">
        <View>
          <StudioPill label="Live backend" tone="accent" />
          <Text className="mt-5 text-xs uppercase tracking-[0.28em] text-mute">Recorder deck</Text>
          <Text className="mt-3 text-4xl font-semibold text-text">{phaseTitle}</Text>
          <Text className="mt-3 max-w-[320px] leading-7 text-mute">{phaseHint}</Text>
        </View>

        <StudioPanel className="gap-5">
          <View className="flex-row items-start justify-between gap-4">
            <View className="flex-1">
              <Text className="text-xs uppercase tracking-[0.24em] text-mute">Capture stage</Text>
              <Text className="mt-3 text-2xl font-semibold text-text">
                Grave com cara de cabine, não de botão perdido.
              </Text>
            </View>
            <StudioPill
              label={isRecording ? 'Recording' : isPaused ? 'Paused' : 'Idle'}
              tone={isRecording ? 'success' : 'neutral'}
            />
          </View>

          <View className="rounded-[28px] border border-border bg-surfaceAlt px-4 py-5">
            <Waveform meters={(state as { meters?: number[] }).meters ?? []} color="#f38a37" />
          </View>

          <View className="items-center justify-center pt-3">
            <View className="absolute h-44 w-44 rounded-full bg-accent/10" />
            <View className="absolute h-36 w-36 rounded-full border border-accent/25" />
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
              className={`h-32 w-32 items-center justify-center rounded-full ${isRecording ? 'bg-danger' : 'bg-accent'}`}
            >
              <View
                className={
                  isRecording
                    ? 'h-10 w-10 rounded-[10px] bg-[#120d0a]'
                    : 'h-12 w-12 rounded-full bg-[#120d0a]'
                }
              />
            </Pressable>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 rounded-[24px] border border-border bg-[#100c09]/55 px-4 py-4">
              <Text className="text-xs uppercase tracking-[0.24em] text-mute">Session</Text>
              <Text className="mt-3 text-base font-semibold text-text">
                {auth.currentUser?.email ?? 'Conta ativa'}
              </Text>
              <Text className="mt-2 text-sm leading-6 text-mute">
                A gravação já nasce conectada à mesma identidade do workspace.
              </Text>
            </View>
            <View className="flex-1 rounded-[24px] border border-border bg-[#100c09]/55 px-4 py-4">
              <Text className="text-xs uppercase tracking-[0.24em] text-mute">Queue</Text>
              <Text className="mt-3 text-base font-semibold text-text">Upload pronto</Text>
              <Text className="mt-2 text-sm leading-6 text-mute">
                Ao parar a captura, o fluxo já empurra a sessão para a fila e para a biblioteca.
              </Text>
            </View>
          </View>

          {isRecording ? (
            <Pressable
              className="items-center rounded-[24px] border border-border bg-[#100c09]/55 px-4 py-4"
              onPress={() => pause()}
            >
              <Text className="font-semibold text-accentSoft">{t('recorder.pause')}</Text>
            </Pressable>
          ) : isPaused ? (
            <Pressable
              className="items-center rounded-[24px] border border-border bg-[#100c09]/55 px-4 py-4"
              onPress={() => resume()}
            >
              <Text className="font-semibold text-accentSoft">{t('recorder.resume')}</Text>
            </Pressable>
          ) : null}
        </StudioPanel>

        <View className="flex-row gap-3">
          <Pressable
            className="flex-1 rounded-[28px] border border-border bg-surface px-5 py-5"
            onPress={() => router.push('/recordings')}
          >
            <Text className="text-xs uppercase tracking-[0.24em] text-mute">Library</Text>
            <Text className="mt-3 text-2xl font-semibold text-text">{t('nav.recordings')}</Text>
            <Text className="mt-2 leading-6 text-mute">
              Entre no acervo com cards e contexto visual melhorado.
            </Text>
          </Pressable>
          <Pressable
            className="flex-1 rounded-[28px] border border-border bg-surface px-5 py-5"
            onPress={() => router.push('/settings')}
          >
            <Text className="text-xs uppercase tracking-[0.24em] text-mute">Control</Text>
            <Text className="mt-3 text-2xl font-semibold text-text">{t('nav.settings')}</Text>
            <Text className="mt-2 leading-6 text-mute">
              Conta, idioma e release path agora organizados como parte do produto.
            </Text>
          </Pressable>
        </View>
      </View>
    </StudioScreen>
  );
}
