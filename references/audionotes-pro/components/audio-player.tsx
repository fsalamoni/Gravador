import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatDuration } from "@/hooks/use-audio-recorder";

interface AudioPlayerProps {
  uri: string;
  duration: number;
  title?: string;
}

export function AudioPlayer({ uri, duration, title }: AudioPlayerProps) {
  const colors = useColors();
  const player = useAudioPlayer(uri);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(console.warn);
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      player.release();
    };
  }, []);

  const startProgressTimer = useCallback(() => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      setCurrentTime(player.currentTime || 0);
      if (player.currentTime >= (player.duration || duration)) {
        setIsPlaying(false);
        setCurrentTime(0);
        clearInterval(progressTimerRef.current!);
      }
    }, 500);
  }, [player, duration]);

  const handlePlayPause = useCallback(async () => {
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    } else {
      setIsLoading(true);
      try {
        player.play();
        setIsPlaying(true);
        startProgressTimer();
      } catch (e) {
        console.error("[AudioPlayer] Play failed:", e);
      } finally {
        setIsLoading(false);
      }
    }
  }, [isPlaying, player, startProgressTimer]);

  const handleSeek = useCallback(
    (percentage: number) => {
      const seekTo = percentage * (player.duration || duration);
      player.seekTo(seekTo);
      setCurrentTime(seekTo);
    },
    [player, duration],
  );

  const handleSkipBack = useCallback(() => {
    const newTime = Math.max(0, currentTime - 15);
    player.seekTo(newTime);
    setCurrentTime(newTime);
  }, [player, currentTime]);

  const handleSkipForward = useCallback(() => {
    const newTime = Math.min(player.duration || duration, currentTime + 15);
    player.seekTo(newTime);
    setCurrentTime(newTime);
  }, [player, duration, currentTime]);

  const totalDuration = player.duration || duration || 1;
  const progress = Math.min(currentTime / totalDuration, 1);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {title && (
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
          {title}
        </Text>
      )}

      {/* Progress Bar */}
      <Pressable
        style={[styles.progressBar, { backgroundColor: colors.border }]}
        onPress={(e) => {
            const locationX = e.nativeEvent.locationX;
          handleSeek(Math.min(1, Math.max(0, locationX / 280)));
        }}
      >
        <View
          style={[
            styles.progressFill,
            { backgroundColor: colors.primary, width: `${progress * 100}%` as any },
          ]}
        />
        <View
          style={[
            styles.progressThumb,
            { backgroundColor: colors.primary, left: `${progress * 100}%` as any },
          ]}
        />
      </Pressable>

      {/* Time Labels */}
      <View style={styles.timeRow}>
        <Text style={[styles.timeText, { color: colors.muted }]}>
          {formatDuration(Math.floor(currentTime))}
        </Text>
        <Text style={[styles.timeText, { color: colors.muted }]}>
          {formatDuration(Math.floor(totalDuration))}
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable
          style={({ pressed }) => [styles.controlButton, pressed && { opacity: 0.7 }]}
          onPress={handleSkipBack}
        >
          <IconSymbol name="gobackward.15" size={24} color={colors.foreground} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.playButton,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.85 },
          ]}
          onPress={handlePlayPause}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <IconSymbol
              name={isPlaying ? "pause.fill" : "play.fill"}
              size={24}
              color="#FFFFFF"
            />
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.controlButton, pressed && { opacity: 0.7 }]}
          onPress={handleSkipForward}
        >
          <IconSymbol name="goforward.15" size={24} color={colors.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  title: { fontSize: 14, fontWeight: "600" },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: "visible",
    position: "relative",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressThumb: {
    position: "absolute",
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: { fontSize: 12 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  controlButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
