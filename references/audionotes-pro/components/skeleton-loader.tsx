/**
 * SkeletonLoader Component
 *
 * Animated skeleton placeholder for loading states.
 * Uses React Native's Animated API for a shimmer effect.
 */
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, ViewStyle } from "react-native";
import { useColors } from "@/hooks/use-colors";

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBlock({ width = "100%", height = 16, borderRadius = 8, style }: SkeletonProps) {
  const colors = useColors();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.8],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function RecordingCardSkeleton() {
  const colors = useColors();
  return (
    <View style={[skeletonStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={skeletonStyles.cardHeader}>
        <SkeletonBlock width={40} height={40} borderRadius={12} />
        <View style={skeletonStyles.cardHeaderText}>
          <SkeletonBlock width="70%" height={16} />
          <SkeletonBlock width="40%" height={12} style={{ marginTop: 6 }} />
        </View>
        <SkeletonBlock width={60} height={24} borderRadius={12} />
      </View>
      <SkeletonBlock width="90%" height={12} style={{ marginTop: 12 }} />
      <SkeletonBlock width="60%" height={12} style={{ marginTop: 6 }} />
    </View>
  );
}

export function TranscriptionSkeleton() {
  return (
    <View style={skeletonStyles.transcriptionContainer}>
      {[100, 85, 92, 70, 88, 75, 95, 60].map((w, i) => (
        <SkeletonBlock key={i} width={`${w}%`} height={14} style={{ marginBottom: 8 }} />
      ))}
    </View>
  );
}

export function SummarySkeleton() {
  return (
    <View style={skeletonStyles.summaryContainer}>
      <SkeletonBlock width="50%" height={18} style={{ marginBottom: 16 }} />
      {[100, 85, 92, 70, 88].map((w, i) => (
        <SkeletonBlock key={i} width={`${w}%`} height={14} style={{ marginBottom: 8 }} />
      ))}
      <SkeletonBlock width="40%" height={18} style={{ marginTop: 20, marginBottom: 16 }} />
      {[90, 75, 80].map((w, i) => (
        <SkeletonBlock key={`b${i}`} width={`${w}%`} height={14} style={{ marginBottom: 8 }} />
      ))}
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardHeaderText: {
    flex: 1,
    gap: 4,
  },
  transcriptionContainer: {
    padding: 16,
  },
  summaryContainer: {
    padding: 16,
  },
});
