/**
 * Onboarding Screen
 *
 * Shown to new users on first launch.
 * Introduces the app's key features with illustrations.
 * Stores completion state in AsyncStorage.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export const ONBOARDING_KEY = "audionotes_onboarding_done";

interface OnboardingSlide {
  id: string;
  emoji: string;
  title: string;
  description: string;
  accentColor: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: "record",
    emoji: "🎙️",
    title: "Grave com um Toque",
    description:
      "Capture reuniões, ideias e conversas com qualidade de estúdio. Pressione longamente o ícone do app para gravar instantaneamente.",
    accentColor: "#6366F1",
  },
  {
    id: "transcribe",
    emoji: "📝",
    title: "Transcrição Automática",
    description:
      "Nossa IA transcreve seu áudio em mais de 50 idiomas com precisão profissional. Identificação automática de falantes incluída.",
    accentColor: "#8B5CF6",
  },
  {
    id: "ai",
    emoji: "✨",
    title: "IA Que Entende Você",
    description:
      "Resumos executivos, mapas mentais, itens de ação e muito mais. Faça perguntas sobre qualquer gravação e obtenha respostas precisas.",
    accentColor: "#0EA5E9",
  },
  {
    id: "sync",
    emoji: "☁️",
    title: "Sincronize em Qualquer Lugar",
    description:
      "Suas gravações ficam seguras na nuvem e acessíveis em todos os seus dispositivos. Compartilhe e exporte em Markdown ou texto.",
    accentColor: "#10B981",
  },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    router.replace("/(tabs)");
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    router.replace("/(tabs)");
  };

  const currentSlide = SLIDES[currentIndex];
  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Skip button */}
      {!isLast && (
        <Pressable
          style={({ pressed }) => [styles.skipButton, pressed && { opacity: 0.6 }]}
          onPress={handleSkip}
        >
          <Text style={[styles.skipText, { color: colors.muted }]}>Pular</Text>
        </Pressable>
      )}

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
            {/* Emoji illustration */}
            <View
              style={[
                styles.emojiContainer,
                { backgroundColor: `${item.accentColor}20` },
              ]}
            >
              <Text style={styles.emoji}>{item.emoji}</Text>
            </View>

            {/* Text content */}
            <Text style={[styles.slideTitle, { color: colors.foreground }]}>
              {item.title}
            </Text>
            <Text style={[styles.slideDescription, { color: colors.muted }]}>
              {item.description}
            </Text>
          </View>
        )}
      />

      {/* Dots indicator */}
      <View style={styles.dotsContainer}>
        {SLIDES.map((_, i) => {
          const opacity = scrollX.interpolate({
            inputRange: [
              (i - 1) * SCREEN_WIDTH,
              i * SCREEN_WIDTH,
              (i + 1) * SCREEN_WIDTH,
            ],
            outputRange: [0.3, 1, 0.3],
            extrapolate: "clamp",
          });
          const width = scrollX.interpolate({
            inputRange: [
              (i - 1) * SCREEN_WIDTH,
              i * SCREEN_WIDTH,
              (i + 1) * SCREEN_WIDTH,
            ],
            outputRange: [8, 24, 8],
            extrapolate: "clamp",
          });
          return (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  opacity,
                  width,
                  backgroundColor: currentSlide.accentColor,
                },
              ]}
            />
          );
        })}
      </View>

      {/* CTA Button */}
      <Pressable
        style={({ pressed }) => [
          styles.ctaButton,
          { backgroundColor: currentSlide.accentColor },
          pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
        ]}
        onPress={handleNext}
      >
        <Text style={styles.ctaText}>
          {isLast ? "Começar Agora" : "Próximo"}
        </Text>
      </Pressable>

      {/* Page counter */}
      <Text style={[styles.pageCounter, { color: colors.muted }]}>
        {currentIndex + 1} / {SLIDES.length}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
  },
  skipButton: {
    alignSelf: "flex-end",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 16,
    fontWeight: "500",
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  emojiContainer: {
    width: 140,
    height: 140,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
  },
  emoji: {
    fontSize: 64,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 36,
  },
  slideDescription: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 32,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  ctaButton: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 30,
    marginHorizontal: 32,
    alignSelf: "stretch",
    alignItems: "center",
    marginBottom: 16,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  pageCounter: {
    fontSize: 13,
    marginBottom: 8,
  },
});
