import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/use-colors";

interface WaveformVisualizerProps {
  levels: number[];
  isActive: boolean;
  color?: string;
  barWidth?: number;
  barGap?: number;
  height?: number;
}

export function WaveformVisualizer({
  levels,
  isActive,
  color,
  barWidth = 3,
  barGap = 2,
  height = 60,
}: WaveformVisualizerProps) {
  const colors = useColors();
  const barColor = color || colors.primary;

  return (
    <View style={[styles.container, { height }]}>
      {levels.map((level, index) => (
        <WaveformBar
          key={index}
          level={level}
          isActive={isActive}
          color={barColor}
          width={barWidth}
          gap={barGap}
          maxHeight={height}
          index={index}
        />
      ))}
    </View>
  );
}

interface WaveformBarProps {
  level: number;
  isActive: boolean;
  color: string;
  width: number;
  gap: number;
  maxHeight: number;
  index: number;
}

function WaveformBar({ level, isActive, color, width, gap, maxHeight, index }: WaveformBarProps) {
  const heightAnim = useRef(new Animated.Value(4)).current;

  useEffect(() => {
    const targetHeight = isActive ? Math.max(4, level * maxHeight) : 4;
    Animated.timing(heightAnim, {
      toValue: targetHeight,
      duration: 100,
      useNativeDriver: false,
    }).start();
  }, [level, isActive, maxHeight]);

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          width,
          marginHorizontal: gap / 2,
          height: heightAnim,
          backgroundColor: color,
          opacity: isActive ? 1 : 0.3,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  bar: {
    borderRadius: 2,
  },
});
