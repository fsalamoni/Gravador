/**
 * Notifications Service
 *
 * Manages local push notifications for AudioNotes Pro.
 * Notifies the user when AI processing (transcription, summary, mind map) is complete.
 *
 * Uses expo-notifications (already installed in the project).
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Configure how notifications are displayed when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const ANDROID_CHANNEL_ID = "audionotes-ai";

/**
 * Request notification permissions and set up Android channel.
 * Should be called once on app startup.
 * Returns true if permissions were granted.
 */
export async function setupNotifications(): Promise<boolean> {
  try {
    // Set up Android notification channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: "Processamento de IA",
        description: "Notificações sobre transcrição e resumos de IA",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#6366F1",
        sound: "default",
      });
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request if not already granted
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[Notifications] Permission not granted");
      return false;
    }

    console.log("[Notifications] Permissions granted");
    return true;
  } catch (error) {
    console.warn("[Notifications] Setup failed:", error);
    return false;
  }
}

/**
 * Schedule a local notification immediately (with 1 second delay).
 */
async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ?? {},
        sound: "default",
        ...(Platform.OS === "android" && { channelId: ANDROID_CHANNEL_ID }),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
    });
  } catch (error) {
    console.warn("[Notifications] Failed to schedule notification:", error);
  }
}

/**
 * Notify user that transcription is complete.
 */
export async function notifyTranscriptionComplete(
  recordingTitle: string,
  recordingId: string,
): Promise<void> {
  await scheduleLocalNotification(
    "Transcrição Concluída",
    `"${recordingTitle}" foi transcrita com sucesso. Toque para ver.`,
    { screen: "detail", id: recordingId, tab: "transcription" },
  );
}

/**
 * Notify user that AI summary is complete.
 */
export async function notifySummaryComplete(
  recordingTitle: string,
  recordingId: string,
): Promise<void> {
  await scheduleLocalNotification(
    "Resumo Gerado",
    `O resumo de IA de "${recordingTitle}" está pronto.`,
    { screen: "detail", id: recordingId, tab: "summary" },
  );
}

/**
 * Notify user that mind map is complete.
 */
export async function notifyMindMapComplete(
  recordingTitle: string,
  recordingId: string,
): Promise<void> {
  await scheduleLocalNotification(
    "Mapa Mental Criado",
    `O mapa mental de "${recordingTitle}" foi gerado.`,
    { screen: "detail", id: recordingId, tab: "mindmap" },
  );
}

/**
 * Notify user that action items were extracted.
 */
export async function notifyActionItemsComplete(
  recordingTitle: string,
  count: number,
  recordingId: string,
): Promise<void> {
  await scheduleLocalNotification(
    "Itens de Ação Extraídos",
    `${count} item${count !== 1 ? "s" : ""} de ação encontrado${count !== 1 ? "s" : ""} em "${recordingTitle}".`,
    { screen: "detail", id: recordingId, tab: "actions" },
  );
}

/**
 * Notify user that recording upload/sync is complete.
 */
export async function notifyUploadComplete(recordingTitle: string): Promise<void> {
  await scheduleLocalNotification(
    "Gravação Sincronizada",
    `"${recordingTitle}" foi sincronizada com a nuvem.`,
  );
}

/**
 * Add a listener for notification taps (to navigate to the right screen).
 * Returns the subscription for cleanup.
 */
export function addNotificationResponseListener(
  onResponse: (data: Record<string, string>) => void,
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, string>;
    if (data) {
      onResponse(data);
    }
  });
}
