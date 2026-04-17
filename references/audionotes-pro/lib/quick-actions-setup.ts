/**
 * Quick Actions Setup
 *
 * Configures home screen quick actions (long-press on app icon) for iOS and Android.
 * Uses expo-quick-actions v6.0.1 (compatible with Expo SDK 54).
 *
 * iOS: 3D Touch / Haptic Touch long-press on icon
 * Android: Long-press on app icon in launcher
 */
import * as QuickActions from "expo-quick-actions";
import { Platform } from "react-native";

/**
 * Registers the home screen quick actions.
 * Should be called once on app startup (in _layout.tsx useEffect).
 */
export async function setupQuickActions(): Promise<void> {
  try {
    const supported = await QuickActions.isSupported();
    if (!supported) {
      console.log("[QuickActions] Not supported on this device");
      return;
    }

    await QuickActions.setItems([
      {
        id: "quick_record",
        title: "Gravar Agora",
        subtitle: "Iniciar gravação de áudio",
        icon: Platform.OS === "ios" ? "symbol:mic.fill" : "record_voice_over",
        params: { href: "/recording?mode=ambient" },
      },
      {
        id: "new_voice_memo",
        title: "Nota de Voz",
        subtitle: "Gravar nota rápida",
        icon: Platform.OS === "ios" ? "symbol:waveform" : "mic",
        params: { href: "/recording?mode=voice_memo" },
      },
      {
        id: "new_meeting",
        title: "Gravar Reunião",
        subtitle: "Modo reunião com IA",
        icon: Platform.OS === "ios" ? "symbol:person.2.fill" : "groups",
        params: { href: "/recording?mode=meeting" },
      },
      {
        id: "open_library",
        title: "Minhas Gravações",
        subtitle: "Ver biblioteca",
        icon: Platform.OS === "ios" ? "symbol:list.bullet" : "library_music",
        params: { href: "/" },
      },
    ]);

    console.log("[QuickActions] Home screen shortcuts configured successfully");
  } catch (error) {
    // Non-critical — app works without quick actions
    console.warn("[QuickActions] Failed to set items:", error);
  }
}

/**
 * Gets the initial quick action that launched the app (if any).
 * Returns null if the app was opened normally.
 */
export function getInitialQuickAction(): QuickActions.Action | null {
  return QuickActions.initial ?? null;
}
