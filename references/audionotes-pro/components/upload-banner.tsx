import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { useRecordings, type LocalRecording } from "@/lib/recordings-context";
import { readAudioFileAsBase64, generateAudioFileName } from "@/lib/upload-service";
import { trpc } from "@/lib/trpc";

interface UploadBannerProps {
  recording: LocalRecording;
  onUploaded?: (serverId: number) => void;
}

export function UploadBanner({ recording, onUploaded }: UploadBannerProps) {
  const colors = useColors();
  const { user } = useAuth();
  const { updateRecording } = useRecordings();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const createRecording = trpc.recordings.create.useMutation();
  const uploadAudio = trpc.recordings.uploadAudio.useMutation();

  const handleUpload = useCallback(async () => {
    if (!user || isUploading || recording.isSynced) return;

    setIsUploading(true);
    setProgress(10);

    try {
      // Step 1: Create recording on server
      const { id: serverId } = await createRecording.mutateAsync({
        title: recording.title,
        duration: recording.duration,
        recordingMode: recording.recordingMode,
      });
      setProgress(30);

      // Step 2: Read audio file as base64
      const audioBase64 = await readAudioFileAsBase64(recording.localUri);
      setProgress(60);

      // Step 3: Upload to server
      const fileName = generateAudioFileName(recording.id, recording.mimeType);
      await uploadAudio.mutateAsync({
        recordingId: serverId,
        audioBase64,
        mimeType: recording.mimeType,
        fileName,
        duration: recording.duration,
      });
      setProgress(100);

      // Step 4: Update local state
      updateRecording(recording.id, {
        serverId,
        isSynced: true,
        status: "uploaded",
      });

      onUploaded?.(serverId);
    } catch (error) {
      console.error("[UploadBanner] Upload failed:", error);
      updateRecording(recording.id, { status: "error" });
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  }, [user, isUploading, recording, createRecording, uploadAudio, updateRecording, onUploaded]);

  if (recording.isSynced) return null;
  if (!user) {
    return (
      <View style={[styles.banner, { backgroundColor: `${colors.warning}15`, borderColor: `${colors.warning}40` }]}>
        <IconSymbol name="icloud.fill" size={16} color={colors.warning} />
        <Text style={[styles.bannerText, { color: colors.warning }]}>
          Faça login para sincronizar com a nuvem e usar IA
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      style={[
        styles.banner,
        { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}40` },
        isUploading && { opacity: 0.8 },
      ]}
      onPress={handleUpload}
      disabled={isUploading}
    >
      {isUploading ? (
        <>
          <ActivityIndicator size="small" color={colors.primary} />
          <View style={styles.progressContainer}>
            <Text style={[styles.bannerText, { color: colors.primary }]}>
              Enviando para a nuvem... {progress}%
            </Text>
            <View style={[styles.progressBar, { backgroundColor: `${colors.primary}30` }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.primary, width: `${progress}%` as any },
                ]}
              />
            </View>
          </View>
        </>
      ) : (
        <>
          <IconSymbol name="icloud.and.arrow.up" size={16} color={colors.primary} />
          <Text style={[styles.bannerText, { color: colors.primary }]}>
            Toque para sincronizar e usar recursos de IA
          </Text>
          <IconSymbol name="chevron.right" size={14} color={colors.primary} />
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  bannerText: { flex: 1, fontSize: 13, fontWeight: "500" },
  progressContainer: { flex: 1, gap: 6 },
  progressBar: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
});
