import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { setupNotifications } from "@/lib/notifications-service";
import { setupQuickActions } from "@/lib/quick-actions-setup";
import { ONBOARDING_KEY } from "../onboarding";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface SettingRowProps {
  icon: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: boolean;
  onToggle?: (val: boolean) => void;
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
}

function SettingRow({
  icon,
  iconColor,
  title,
  subtitle,
  value,
  onToggle,
  onPress,
  showChevron = false,
  destructive = false,
}: SettingRowProps) {
  const colors = useColors();
  const color = destructive ? colors.error : iconColor || colors.primary;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingRow,
        { borderBottomColor: colors.border },
        pressed && onPress && { backgroundColor: colors.surface },
      ]}
      onPress={onPress}
      disabled={!onPress && !onToggle}
    >
      <View style={[styles.settingIcon, { backgroundColor: `${color}20` }]}>
        <IconSymbol name={icon as any} size={18} color={color} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: destructive ? colors.error : colors.foreground }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.settingSubtitle, { color: colors.muted }]}>{subtitle}</Text>
        )}
      </View>
      {onToggle !== undefined && (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#FFFFFF"
        />
      )}
      {showChevron && (
        <IconSymbol name="chevron.right" size={16} color={colors.muted} />
      )}
    </Pressable>
  );
}

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>{title}</Text>
      <View style={[styles.sectionContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const logout = trpc.auth.logout.useMutation();

  const [autoTranscribe, setAutoTranscribe] = useState(true);
  const [autoSummary, setAutoSummary] = useState(false);
  const [cloudSync, setCloudSync] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [highQuality, setHighQuality] = useState(true);

  const handleRequestNotifications = async () => {
    const granted = await setupNotifications();
    if (granted) {
      setNotifications(true);
      Alert.alert("Notificações Ativadas", "Você receberá alertas quando a IA concluir o processamento.");
    } else {
      Alert.alert("Permissão Negada", "Ative as notificações nas configurações do seu celular.");
    }
  };

  const handleRefreshShortcuts = async () => {
    try {
      await setupQuickActions();
      Alert.alert("Atalhos Atualizados", "Os atalhos de acesso rápido foram configurados. Pressione longamente o ícone do app para usá-los.");
    } catch {
      Alert.alert("Erro", "Não foi possível configurar os atalhos.");
    }
  };

  const handleResetOnboarding = async () => {
    Alert.alert("Ver Tutorial", "Deseja ver o tutorial de introdução novamente?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Ver Tutorial",
        onPress: async () => {
          await AsyncStorage.removeItem(ONBOARDING_KEY);
          router.replace("/onboarding" as any);
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert("Sair", "Deseja encerrar a sessão?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await logout.mutateAsync();
          router.replace("/");
        },
      },
    ]);
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Configurações</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account */}
        {user && (
          <SettingSection title="CONTA">
            <View style={styles.profileRow}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>
                  {(user as any).name?.charAt(0)?.toUpperCase() || "U"}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: colors.foreground }]}>
                  {(user as any).name || "Usuário"}
                </Text>
                <Text style={[styles.profileEmail, { color: colors.muted }]}>
                  {(user as any).email || ""}
                </Text>
              </View>
            </View>
          </SettingSection>
        )}

        {/* AI & Processing */}
        <SettingSection title="IA E PROCESSAMENTO">
          <SettingRow
            icon="waveform"
            iconColor="#6366F1"
            title="Transcrição Automática"
            subtitle="Transcrever após cada gravação"
            value={autoTranscribe}
            onToggle={setAutoTranscribe}
          />
          <SettingRow
            icon="sparkles"
            iconColor="#8B5CF6"
            title="Resumo Automático"
            subtitle="Gerar resumo após transcrição"
            value={autoSummary}
            onToggle={setAutoSummary}
          />
        </SettingSection>

        {/* Recording */}
        <SettingSection title="GRAVAÇÃO">
          <SettingRow
            icon="mic.fill"
            iconColor="#EF4444"
            title="Alta Qualidade"
            subtitle="Maior qualidade de áudio (mais espaço)"
            value={highQuality}
            onToggle={setHighQuality}
          />
          <SettingRow
            icon="icloud.fill"
            iconColor="#3B82F6"
            title="Sincronização na Nuvem"
            subtitle="Sincronizar gravações automaticamente"
            value={cloudSync}
            onToggle={setCloudSync}
          />
          <SettingRow
            icon="folder.fill"
            iconColor="#4285F4"
            title="Google Drive"
            subtitle="Backup e sincronização com seu Drive"
            showChevron
            onPress={() => router.push("/google-drive" as any)}
          />
        </SettingSection>

        {/* Quick Access */}
        <SettingSection title="ACESSO RÁPIDO">
          <SettingRow
            icon="bolt.fill"
            iconColor="#F59E0B"
            title="Atalhos na Tela Inicial"
            subtitle="Pressione longo o ícone do app para gravar"
            showChevron
            onPress={handleRefreshShortcuts}
          />
          <SettingRow
            icon="mic.circle.fill"
            iconColor="#EF4444"
            title="Modos de Gravação Rápida"
            subtitle="Ambiente, Reunião, Chamada, Nota de Voz"
          />
        </SettingSection>

        {/* Notifications */}
        <SettingSection title="NOTIFICAÇÕES">
          <SettingRow
            icon="bell.fill"
            iconColor="#F59E0B"
            title="Notificações de IA"
            subtitle="Alertas quando transcrição e resumos ficam prontos"
            value={notifications}
            onToggle={(val) => {
              setNotifications(val);
              if (val) handleRequestNotifications();
            }}
          />
        </SettingSection>

        {/* About */}
        <SettingSection title="SOBRE">
          <SettingRow
            icon="info.circle.fill"
            iconColor="#6366F1"
            title="Versão do App"
            subtitle="AudioNotes Pro v1.0.0"
          />
          <SettingRow
            icon="questionmark.circle"
            iconColor="#10B981"
            title="Ajuda e Suporte"
            showChevron
            onPress={() => {}}
          />
          <SettingRow
            icon="play.circle.fill"
            iconColor="#6366F1"
            title="Ver Tutorial"
            subtitle="Rever o guia de introdução"
            showChevron
            onPress={handleResetOnboarding}
          />
        </SettingSection>

        {/* Danger Zone */}
        {user && (
          <SettingSection title="">
            <SettingRow
              icon="person.fill"
              title="Sair da Conta"
              destructive
              onPress={handleLogout}
            />
          </SettingSection>
        )}

        {!user && (
          <View style={styles.loginPrompt}>
            <Text style={[styles.loginPromptText, { color: colors.muted }]}>
              Faça login para sincronizar suas gravações na nuvem e acessar todos os recursos de IA.
            </Text>
            <Pressable
              style={[styles.loginButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/oauth/login" as any)}
            >
              <Text style={styles.loginButtonText}>Entrar / Criar Conta</Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  content: { paddingTop: 8 },
  section: { marginBottom: 24, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionContent: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingContent: { flex: 1 },
  settingTitle: { fontSize: 15, fontWeight: "500" },
  settingSubtitle: { fontSize: 12, marginTop: 2 },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, fontWeight: "600" },
  profileEmail: { fontSize: 13, marginTop: 2 },
  loginPrompt: {
    marginHorizontal: 16,
    padding: 20,
    alignItems: "center",
    gap: 14,
  },
  loginPromptText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  loginButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  loginButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
});
