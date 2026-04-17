import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

export default function GoogleDriveScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ code?: string; state?: string; error?: string }>();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const driveStatus = trpc.googleDrive.status.useQuery();
  const getAuthUrl = trpc.googleDrive.getAuthUrl.useMutation();
  const connectDrive = trpc.googleDrive.connect.useMutation();
  const disconnectDrive = trpc.googleDrive.disconnect.useMutation();
  const listFiles = trpc.googleDrive.listFiles.useQuery(undefined, {
    enabled: driveStatus.data?.connected === true,
  });

  const utils = trpc.useUtils();

  // Handle OAuth callback from deep link
  useEffect(() => {
    if (params.code && params.state && !isConnecting) {
      handleOAuthCallback(params.code, params.state);
    }
    if (params.error) {
      Alert.alert("Erro", `Falha ao conectar com Google Drive: ${params.error}`);
    }
  }, [params.code, params.state, params.error]);

  const getRedirectUri = () => {
    if (Platform.OS === "web") {
      return `${window.location.origin}/google-drive`;
    }
    return Linking.createURL("/google-drive");
  };

  const handleConnect = async () => {
    if (!driveStatus.data?.hasCredentials) {
      Alert.alert(
        "Configuração Necessária",
        "Para conectar o Google Drive, o administrador precisa configurar as credenciais Google OAuth no servidor (GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET).",
        [{ text: "Entendido" }],
      );
      return;
    }

    try {
      setIsConnecting(true);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const redirectUri = getRedirectUri();
      const { url } = await getAuthUrl.mutateAsync({ redirectUri });
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Não foi possível iniciar a conexão com Google Drive.");
      setIsConnecting(false);
    }
  };

  const handleOAuthCallback = async (code: string, _state: string) => {
    try {
      setIsConnecting(true);
      const redirectUri = getRedirectUri();
      const result = await connectDrive.mutateAsync({ code, redirectUri });
      await utils.googleDrive.status.invalidate();
      await utils.googleDrive.listFiles.invalidate();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert(
        "Conectado! ✅",
        `Google Drive conectado com sucesso!\nPasta: "${result.folderName}"`,
      );
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Falha ao conectar com Google Drive.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      "Desconectar Google Drive",
      "Suas gravações locais e no servidor não serão afetadas. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desconectar",
          style: "destructive",
          onPress: async () => {
            try {
              await disconnectDrive.mutateAsync();
              await utils.googleDrive.status.invalidate();
              if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (e: any) {
              Alert.alert("Erro", e.message || "Não foi possível desconectar.");
            }
          },
        },
      ],
    );
  };

  const isConnected = driveStatus.data?.connected;
  const folderName = driveStatus.data?.folderName;
  const files = listFiles.data?.files || [];

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.left" size={22} color={colors.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Google Drive</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Drive Icon */}
        <View style={[styles.iconContainer, { backgroundColor: isConnected ? "#E8F5E9" : colors.surface }]}>
          <Text style={styles.driveIcon}>
            {isConnected ? "✅" : "☁️"}
          </Text>
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>
          {isConnected ? "Google Drive Conectado" : "Conectar Google Drive"}
        </Text>

        <Text style={[styles.subtitle, { color: colors.muted }]}>
          {isConnected
            ? `Suas gravações são sincronizadas automaticamente com a pasta "${folderName}" no seu Google Drive.`
            : "Sincronize suas gravações com o Google Drive para acessá-las em qualquer dispositivo e criar backups automáticos."}
        </Text>

        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.muted }]}>Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: isConnected ? "#E8F5E9" : colors.surface }]}>
              <View style={[styles.statusDot, { backgroundColor: isConnected ? "#22C55E" : "#9CA3AF" }]} />
              <Text style={[styles.statusText, { color: isConnected ? "#16A34A" : colors.muted }]}>
                {isConnected ? "Conectado" : "Desconectado"}
              </Text>
            </View>
          </View>

          {isConnected && folderName && (
            <View style={[styles.statusRow, { marginTop: 12 }]}>
              <Text style={[styles.statusLabel, { color: colors.muted }]}>Pasta</Text>
              <Text style={[styles.statusValue, { color: colors.foreground }]}>📁 {folderName}</Text>
            </View>
          )}

          {isConnected && (
            <View style={[styles.statusRow, { marginTop: 12 }]}>
              <Text style={[styles.statusLabel, { color: colors.muted }]}>Arquivos</Text>
              <Text style={[styles.statusValue, { color: colors.foreground }]}>
                {listFiles.isLoading ? "Carregando..." : `${files.length} arquivo${files.length !== 1 ? "s" : ""}`}
              </Text>
            </View>
          )}
        </View>

        {/* Features List */}
        {!isConnected && (
          <View style={[styles.featuresCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.featuresTitle, { color: colors.foreground }]}>O que você ganha:</Text>
            {[
              { icon: "🔄", text: "Sincronização automática de gravações" },
              { icon: "💾", text: "Backup seguro na nuvem" },
              { icon: "📱", text: "Acesso em qualquer dispositivo" },
              { icon: "📁", text: "Pasta dedicada 'AudioNotes Pro'" },
              { icon: "🔒", text: "Seus dados, sua conta Google" },
            ].map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={[styles.featureText, { color: colors.foreground }]}>{f.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Files List */}
        {isConnected && files.length > 0 && (
          <View style={[styles.filesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.filesTitle, { color: colors.foreground }]}>Arquivos no Drive</Text>
            {files.slice(0, 10).map((file) => (
              <View key={file.id} style={[styles.fileRow, { borderBottomColor: colors.border }]}>
                <Text style={styles.fileIcon}>🎙️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fileName, { color: colors.foreground }]} numberOfLines={1}>
                    {file.name}
                  </Text>
                  {file.createdTime && (
                    <Text style={[styles.fileDate, { color: colors.muted }]}>
                      {new Date(file.createdTime).toLocaleDateString("pt-BR")}
                    </Text>
                  )}
                </View>
                {file.size && (
                  <Text style={[styles.fileSize, { color: colors.muted }]}>
                    {(parseInt(file.size) / 1024 / 1024).toFixed(1)} MB
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          {!isConnected ? (
            <Pressable
              style={({ pressed }) => [
                styles.connectButton,
                { backgroundColor: "#4285F4", opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={handleConnect}
              disabled={isConnecting || getAuthUrl.isPending}
            >
              {isConnecting || getAuthUrl.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.connectButtonText}>Conectar com Google</Text>
                </>
              )}
            </Pressable>
          ) : (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.syncButton,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={async () => {
                  await utils.googleDrive.listFiles.invalidate();
                  await listFiles.refetch();
                }}
                disabled={listFiles.isFetching}
              >
                {listFiles.isFetching ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.syncButtonText}>🔄 Atualizar Lista</Text>
                )}
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.disconnectButton,
                  { borderColor: colors.error, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={handleDisconnect}
                disabled={disconnectDrive.isPending}
              >
                <Text style={[styles.disconnectButtonText, { color: colors.error }]}>
                  Desconectar Google Drive
                </Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Note */}
        <Text style={[styles.note, { color: colors.muted }]}>
          {isConnected
            ? "As gravações são sincronizadas automaticamente após o upload. Você também pode sincronizar manualmente a partir da tela de detalhes de cada gravação."
            : "Ao conectar, o app criará uma pasta 'AudioNotes Pro' no seu Google Drive. Você pode alterar o nome da pasta nas configurações avançadas."}
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "600" },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  driveIcon: { fontSize: 36 },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  subtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  statusCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusLabel: { fontSize: 14, fontWeight: "500" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: "600" },
  statusValue: { fontSize: 14 },
  featuresCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  featuresTitle: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureIcon: { fontSize: 18, width: 28 },
  featureText: { fontSize: 14, flex: 1 },
  filesCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 0,
  },
  filesTitle: { fontSize: 15, fontWeight: "600", marginBottom: 12 },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fileIcon: { fontSize: 20 },
  fileName: { fontSize: 14, fontWeight: "500" },
  fileDate: { fontSize: 12, marginTop: 2 },
  fileSize: { fontSize: 12 },
  actions: { gap: 12 },
  connectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: "#4285F4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
    fontFamily: "serif",
  },
  connectButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  syncButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
  },
  syncButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  disconnectButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  disconnectButtonText: { fontSize: 15, fontWeight: "600" },
  note: { fontSize: 12, textAlign: "center", lineHeight: 18 },
});
