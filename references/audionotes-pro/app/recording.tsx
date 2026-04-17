import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { WaveformVisualizer } from "@/components/waveform-visualizer";
import { useColors } from "@/hooks/use-colors";
import { formatDuration, useAudioRecorder } from "@/hooks/use-audio-recorder";
import { useRecordings } from "@/lib/recordings-context";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";

type RecordingMode = "ambient" | "meeting" | "call" | "voice_memo";

const RECORDING_MODES: { id: RecordingMode; label: string; icon: string; description: string }[] =
  [
    { id: "ambient", label: "Ambiente", icon: "🌍", description: "Gravação geral de ambiente" },
    { id: "meeting", label: "Reunião", icon: "👥", description: "Reuniões e conferências" },
    { id: "call", label: "Chamada", icon: "📞", description: "Ligações e calls" },
    { id: "voice_memo", label: "Nota de Voz", icon: "🎙️", description: "Notas rápidas" },
  ];

export default function RecordingScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { addRecording, updateRecording } = useRecordings();
  const { state, duration, audioLevels, startRecording, stopRecording, pauseRecording, resumeRecording, discardRecording, hasPermission, requestPermission } = useAudioRecorder();
  // Support ?mode= param from Quick Actions (home screen shortcuts)
  const params = useLocalSearchParams<{ mode?: string }>();
  const initialMode = (params.mode as RecordingMode) || "ambient";
  const [selectedMode, setSelectedMode] = useState<RecordingMode>(initialMode);
  const [isSaving, setIsSaving] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const createRecording = trpc.recordings.create.useMutation();
  const uploadAudio = trpc.recordings.uploadAudio.useMutation();
  const startTranscription = trpc.transcription.start.useMutation();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "uploading" | "transcribing" | "done">("idle");

  useKeepAwake();

  // Pulse animation for recording indicator
  useEffect(() => {
    if (state === "recording") {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state]);

  const handleStart = useCallback(async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          "Permissão Necessária",
          "O AudioNotes Pro precisa de acesso ao microfone para gravar.",
          [{ text: "OK" }],
        );
        return;
      }
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await startRecording();
  }, [hasPermission, requestPermission, startRecording]);

  const handleStop = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveStatus("saving");

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    try {
      const uri = await stopRecording();
      if (!uri) {
        setIsSaving(false);
        setSaveStatus("idle");
        return;
      }

      const localId = `local_${Date.now()}`;
      const now = new Date().toISOString();

      // Save locally first
      addRecording({
        id: localId,
        title: "Nova Gravação",
        duration,
        localUri: uri,
        mimeType: "audio/m4a",
        recordingMode: selectedMode,
        isStarred: false,
        isSynced: false,
        status: "saved",
        createdAt: now,
      });

      // If authenticated, upload and trigger transcription automatically
      if (user) {
        try {
          // Step 1: Create recording entry on server
          setSaveStatus("uploading");
          const { id: serverId } = await createRecording.mutateAsync({
            title: "Nova Gravação",
            duration,
            recordingMode: selectedMode,
          });

          // Step 2: Read file and upload to S3
          const { readAudioFileAsBase64, generateAudioFileName } = await import("@/lib/upload-service");
          const audioBase64 = await readAudioFileAsBase64(uri);
          const fileName = generateAudioFileName(localId, "audio/m4a");

          await uploadAudio.mutateAsync({
            recordingId: serverId,
            audioBase64,
            mimeType: "audio/m4a",
            fileName,
            duration,
          });

          // Update local record with server ID and synced status
          updateRecording(localId, {
            serverId,
            isSynced: true,
            status: "uploaded",
            transcriptionStatus: "processing",
          });

          // Step 3: Start transcription automatically
          setSaveStatus("transcribing");
          await startTranscription.mutateAsync({ recordingId: serverId });

          setSaveStatus("done");
        } catch (e) {
          console.warn("[Recording] Upload/transcription failed:", e);
          // Don't block navigation — recording is saved locally
        }
      }

      setSaveStatus("done");
      router.back();
    } catch (error) {
      console.error("[Recording] Failed to save:", error);
      Alert.alert("Erro", "Não foi possível salvar a gravação. Tente novamente.");
    } finally {
      setIsSaving(false);
      setSaveStatus("idle");
    }
  }, [isSaving, stopRecording, duration, selectedMode, addRecording, updateRecording, user, createRecording, uploadAudio, startTranscription]);

  const handleDiscard = useCallback(() => {
    Alert.alert(
      "Descartar Gravação",
      "Tem certeza que deseja descartar esta gravação?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Descartar",
          style: "destructive",
          onPress: async () => {
            await discardRecording();
            router.back();
          },
        },
      ],
    );
  }, [discardRecording]);

  const handlePauseResume = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (state === "recording") {
      pauseRecording();
    } else if (state === "paused") {
      resumeRecording();
    }
  }, [state, pauseRecording, resumeRecording]);

  const isRecordingActive = state === "recording" || state === "paused";

  return (
    <View style={[styles.container, { backgroundColor: "#0A0A0F" }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.7 }]}
            onPress={() => {
              if (isRecordingActive) {
                handleDiscard();
              } else {
                router.back();
              }
            }}
          >
            <IconSymbol name="xmark" size={20} color="#FFFFFF" />
          </Pressable>

          <View style={styles.headerCenter}>
            {state === "recording" && (
              <View style={styles.recordingBadge}>
                <Animated.View
                  style={[styles.recordingDot, { transform: [{ scale: pulseAnim }] }]}
                />
                <Text style={styles.recordingBadgeText}>GRAVANDO</Text>
              </View>
            )}
            {state === "paused" && (
              <View style={[styles.recordingBadge, { backgroundColor: "rgba(251,191,36,0.2)" }]}>
                <View style={[styles.recordingDot, { backgroundColor: "#FBBF24" }]} />
                <Text style={[styles.recordingBadgeText, { color: "#FBBF24" }]}>PAUSADO</Text>
              </View>
            )}
          </View>

          <View style={styles.headerButton} />
        </View>

        {/* Mode Selector */}
        {!isRecordingActive && (
          <View style={styles.modeSelector}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeSelectorContent}>
              {RECORDING_MODES.map((mode) => (
                <Pressable
                  key={mode.id}
                  style={({ pressed }) => [
                    styles.modeButton,
                    selectedMode === mode.id && styles.modeButtonActive,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => setSelectedMode(mode.id)}
                >
                  <Text style={styles.modeEmoji}>{mode.icon}</Text>
                  <Text
                    style={[
                      styles.modeLabel,
                      selectedMode === mode.id && styles.modeLabelActive,
                    ]}
                  >
                    {mode.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Main Content */}
        <View style={styles.content}>
          {/* Timer */}
          <Text style={styles.timer}>{formatDuration(duration)}</Text>

          {/* Mode indicator when recording */}
          {isRecordingActive && (
            <Text style={styles.modeIndicator}>
              {RECORDING_MODES.find((m) => m.id === selectedMode)?.icon}{" "}
              {RECORDING_MODES.find((m) => m.id === selectedMode)?.label}
            </Text>
          )}

          {/* Waveform */}
          <View style={styles.waveformContainer}>
            <WaveformVisualizer
              levels={audioLevels}
              isActive={state === "recording"}
              color={state === "recording" ? "#EF4444" : "#6366F1"}
              height={80}
              barWidth={4}
              barGap={3}
            />
          </View>

          {/* Status text */}
          {state === "idle" && saveStatus === "idle" && (
            <Text style={styles.statusText}>Toque no botão para começar a gravar</Text>
          )}
          {state === "paused" && (
            <Text style={[styles.statusText, { color: "#FBBF24" }]}>Gravação pausada</Text>
          )}
          {saveStatus === "saving" && (
            <Text style={[styles.statusText, { color: "#6366F1" }]}>⏳ Salvando gravação...</Text>
          )}
          {saveStatus === "uploading" && (
            <Text style={[styles.statusText, { color: "#06B6D4" }]}>☁️ Enviando para a nuvem...</Text>
          )}
          {saveStatus === "transcribing" && (
            <Text style={[styles.statusText, { color: "#8B5CF6" }]}>✨ Iniciando transcrição com IA...</Text>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {isRecordingActive ? (
            <View style={styles.activeControls}>
              {/* Discard */}
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.7 }]}
                onPress={handleDiscard}
              >
                <IconSymbol name="trash.fill" size={22} color="#EF4444" />
              </Pressable>

              {/* Stop */}
              <Pressable
                style={({ pressed }) => [styles.stopButton, pressed && { opacity: 0.8 }]}
                onPress={handleStop}
                disabled={isSaving}
              >
                <View style={styles.stopButtonInner}>
                  <IconSymbol name="stop.fill" size={28} color="#FFFFFF" />
                </View>
              </Pressable>

              {/* Pause/Resume */}
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.7 }]}
                onPress={handlePauseResume}
              >
                <IconSymbol
                  name={state === "recording" ? "pause.fill" : "play.fill"}
                  size={22}
                  color="#FFFFFF"
                />
              </Pressable>
            </View>
          ) : (
            <View style={styles.idleControls}>
              {/* Record Button */}
              <Pressable
                style={({ pressed }) => [styles.recordButton, pressed && { opacity: 0.85 }]}
                onPress={handleStart}
              >
                <View style={styles.recordButtonOuter}>
                  <View style={styles.recordButtonInner}>
                    <IconSymbol name="mic.fill" size={36} color="#FFFFFF" />
                  </View>
                </View>
              </Pressable>
              <Text style={styles.recordButtonLabel}>Toque para gravar</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  recordingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(239,68,68,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  recordingBadgeText: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  modeSelector: {
    paddingVertical: 8,
  },
  modeSelectorContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  modeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modeButtonActive: {
    backgroundColor: "rgba(99,102,241,0.3)",
    borderColor: "#6366F1",
  },
  modeEmoji: { fontSize: 14 },
  modeLabel: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "500" },
  modeLabelActive: { color: "#FFFFFF" },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  timer: {
    fontSize: 72,
    fontWeight: "200",
    color: "#FFFFFF",
    letterSpacing: -2,
    fontVariant: ["tabular-nums"],
  },
  modeIndicator: {
    marginTop: 8,
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "500",
  },
  waveformContainer: {
    marginTop: 32,
    width: "100%",
    alignItems: "center",
  },
  statusText: {
    marginTop: 24,
    fontSize: 15,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
  },
  controls: {
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  idleControls: { alignItems: "center", gap: 12 },
  recordButton: { alignItems: "center" },
  recordButtonOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(239,68,68,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  recordButtonInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  recordButtonLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginTop: 8,
  },
  activeControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
  },
  secondaryButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  stopButton: { alignItems: "center" },
  stopButtonInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
  },
});
