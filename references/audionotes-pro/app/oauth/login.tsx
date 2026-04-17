import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/use-colors";
import { startOAuthLogin } from "@/constants/oauth";

export default function LoginScreen() {
  const colors = useColors();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await startOAuthLogin();
      // On native, the OAuth flow continues via deep link callback
      // On web, the page redirects automatically
    } catch (error) {
      console.error("[Login] OAuth failed:", error);
      Alert.alert(
        "Erro de Login",
        "Não foi possível iniciar o login. Verifique sua conexão e tente novamente.",
        [{ text: "OK" }],
      );
    } finally {
      // Keep loading on native (waiting for deep link callback)
      if (Platform.OS === "web") {
        setIsLoading(false);
      }
    }
  };

  const handleSkip = () => {
    router.replace("/(tabs)" as any);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A1A", "#0F0F2E", "#1A0A2E"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Background decorative circles */}
      <View style={[styles.circle, styles.circle1]} />
      <View style={[styles.circle, styles.circle2]} />
      <View style={[styles.circle, styles.circle3]} />

      <SafeAreaView style={styles.safeArea} edges={["top", "bottom", "left", "right"]}>
        {/* Skip button */}
        <View style={styles.skipRow}>
          <Pressable
            style={({ pressed }) => [styles.skipButton, pressed && { opacity: 0.6 }]}
            onPress={handleSkip}
          >
            <Text style={styles.skipText}>Usar sem conta</Text>
          </Pressable>
        </View>

        {/* Hero section */}
        <View style={styles.hero}>
          {/* App icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconOuter}>
              <View style={styles.iconInner}>
                <Text style={styles.iconEmoji}>🎙️</Text>
              </View>
            </View>
            {/* Pulse rings */}
            <View style={[styles.pulseRing, styles.pulseRing1]} />
            <View style={[styles.pulseRing, styles.pulseRing2]} />
          </View>

          <Text style={styles.appName}>AudioNotes Pro</Text>
          <Text style={styles.tagline}>
            Capture. Transcreva. Entenda.{"\n"}Powered by AI.
          </Text>
        </View>

        {/* Feature highlights */}
        <View style={styles.features}>
          {[
            { icon: "🎤", text: "Gravação com qualidade de estúdio" },
            { icon: "✨", text: "Transcrição em mais de 50 idiomas" },
            { icon: "🧠", text: "Resumos e mapas mentais com IA" },
            { icon: "☁️", text: "Sincronização segura na nuvem" },
          ].map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* Login buttons */}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              isLoading && { opacity: 0.7 },
            ]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <LinearGradient
              colors={["#6366F1", "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loginGradient}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.loginIcon}>🔐</Text>
                  <Text style={styles.loginText}>Entrar / Criar Conta</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          <Text style={styles.disclaimer}>
            Ao continuar, você concorda com nossos Termos de Uso e Política de Privacidade.
            Seus dados são criptografados e seguros.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A1A",
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },
  circle: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.08,
  },
  circle1: {
    width: 300,
    height: 300,
    backgroundColor: "#6366F1",
    top: -80,
    right: -80,
  },
  circle2: {
    width: 200,
    height: 200,
    backgroundColor: "#8B5CF6",
    bottom: 100,
    left: -60,
  },
  circle3: {
    width: 150,
    height: 150,
    backgroundColor: "#06B6D4",
    top: "40%",
    right: -40,
  },
  skipRow: {
    alignItems: "flex-end",
    paddingTop: 8,
    paddingBottom: 4,
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  skipText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
  },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 16,
  },
  iconContainer: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  iconOuter: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: "rgba(99,102,241,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.4)",
  },
  iconInner: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "rgba(99,102,241,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconEmoji: {
    fontSize: 36,
  },
  pulseRing: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.3)",
  },
  pulseRing1: {
    width: 110,
    height: 110,
  },
  pulseRing2: {
    width: 130,
    height: 130,
    borderColor: "rgba(99,102,241,0.15)",
  },
  appName: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 16,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 24,
  },
  features: {
    gap: 12,
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  featureIcon: {
    fontSize: 20,
  },
  featureText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
    flex: 1,
  },
  actions: {
    paddingBottom: 16,
    gap: 16,
  },
  loginButton: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  loginGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 10,
  },
  loginIcon: {
    fontSize: 20,
  },
  loginText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  disclaimer: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
    lineHeight: 16,
  },
});
