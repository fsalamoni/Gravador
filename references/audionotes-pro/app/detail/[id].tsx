import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { AudioPlayer } from "@/components/audio-player";
import { UploadBanner } from "@/components/upload-banner";
import { useColors } from "@/hooks/use-colors";
import { formatDuration } from "@/hooks/use-audio-recorder";
import { useRecordings } from "@/lib/recordings-context";
import { trpc } from "@/lib/trpc";
import { exportRecording, copyToClipboard } from "@/lib/export-service";

type TabId = "transcription" | "summary" | "mindmap" | "actions" | "ask";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "transcription", label: "Transcrição", icon: "doc.text.fill" },
  { id: "summary", label: "Resumo", icon: "sparkles" },
  { id: "mindmap", label: "Mapa Mental", icon: "brain.head.profile" },
  { id: "actions", label: "Ações", icon: "checklist" },
  { id: "ask", label: "Perguntar IA", icon: "bubble.left.fill" },
];

const SUMMARY_TEMPLATES = [
  { id: "executive", label: "Executivo", icon: "💼" },
  { id: "action_items", label: "Itens de Ação", icon: "✅" },
  { id: "decisions", label: "Decisões", icon: "⚖️" },
  { id: "meeting_notes", label: "Ata de Reunião", icon: "📋" },
  { id: "strategic", label: "Estratégico", icon: "🎯" },
  { id: "feedback", label: "Feedback", icon: "💬" },
];

function MindMapNode({ node, depth = 0 }: { node: any; depth?: number }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <View style={[styles.mindMapNode, { marginLeft: depth * 20 }]}>
      <Pressable
        style={[
          styles.mindMapNodeContent,
          {
            backgroundColor: node.color ? `${node.color}20` : colors.surface,
            borderColor: node.color || colors.border,
          },
        ]}
        onPress={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren && (
          <IconSymbol
            name={expanded ? "chevron.down" : "chevron.right"}
            size={12}
            color={node.color || colors.muted}
          />
        )}
        <Text style={[styles.mindMapNodeText, { color: node.color || colors.foreground }]}>
          {node.text}
        </Text>
      </Pressable>
      {expanded && hasChildren && (
        <View style={styles.mindMapChildren}>
          {node.children.map((child: any, i: number) => (
            <MindMapNode key={child.id || i} node={child} depth={depth + 1} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { state: recordingsState, updateRecording } = useRecordings();
  const [activeTab, setActiveTab] = useState<TabId>("transcription");
  const [selectedTemplate, setSelectedTemplate] = useState("executive");
  const [question, setQuestion] = useState("");
  const [isSendingQuestion, setIsSendingQuestion] = useState(false);
  const [currentServerId, setCurrentServerId] = useState<number | null>(null);
  const chatScrollRef = useRef<ScrollView>(null);

  const isLocalId = id?.startsWith("local_");
  const rawServerId = isLocalId ? null : parseInt(id || "0", 10);
  const localId = isLocalId ? id?.replace("local_", "") : null;

  const serverId = currentServerId || rawServerId;

  // Find local recording
  const localRecording = recordingsState.recordings.find(
    (r) => r.id === localId || (rawServerId && r.serverId === rawServerId),
  );

  // Server queries
  const recordingQuery = trpc.recordings.get.useQuery(
    { id: serverId! },
    { enabled: !!serverId },
  );
  const transcriptionQuery = trpc.transcription.get.useQuery(
    { recordingId: serverId! },
    { enabled: !!serverId },
  );
  const summariesQuery = trpc.summary.list.useQuery(
    { recordingId: serverId! },
    { enabled: !!serverId },
  );
  const mindMapQuery = trpc.mindMap.get.useQuery(
    { recordingId: serverId! },
    { enabled: !!serverId },
  );
  const actionItemsQuery = trpc.actionItems.list.useQuery(
    { recordingId: serverId! },
    { enabled: !!serverId },
  );
  const aiMessagesQuery = trpc.askAI.messages.useQuery(
    { recordingId: serverId! },
    { enabled: !!serverId },
  );

  const startTranscription = trpc.transcription.start.useMutation();
  const generateSummary = trpc.summary.generate.useMutation();
  const generateMindMap = trpc.mindMap.generate.useMutation();
  const generateActionItems = trpc.actionItems.generate.useMutation();
  const updateActionItem = trpc.actionItems.update.useMutation();
  const askAI = trpc.askAI.ask.useMutation();
  const syncToDrive = trpc.googleDrive.syncRecording.useMutation();
  const driveStatus = trpc.googleDrive.status.useQuery(undefined, { enabled: !!serverId });

  const recording = recordingQuery.data || localRecording;
  const transcription = transcriptionQuery.data;
  const summaries = summariesQuery.data || [];
  const mindMap = mindMapQuery.data;
  const actionItems = actionItemsQuery.data || [];
  const aiMessages = aiMessagesQuery.data || [];
  const currentSummary = summaries.find((s: any) => s.templateType === selectedTemplate);

  const handleUploaded = useCallback(
    (newServerId: number) => {
      setCurrentServerId(newServerId);
    },
    [],
  );

  const handleTranscribe = useCallback(async () => {
    if (!serverId) return;
    try {
      await startTranscription.mutateAsync({ recordingId: serverId });
      const poll = setInterval(async () => {
        const result = await transcriptionQuery.refetch();
        if (result.data?.status === "completed" || result.data?.status === "failed") {
          clearInterval(poll);
        }
      }, 2000);
      setTimeout(() => clearInterval(poll), 120000);
    } catch {
      Alert.alert("Erro", "Não foi possível iniciar a transcrição.");
    }
  }, [serverId, startTranscription, transcriptionQuery]);

  const handleGenerateSummary = useCallback(async () => {
    if (!serverId) return;
    try {
      await generateSummary.mutateAsync({ recordingId: serverId, templateType: selectedTemplate as any });
      const poll = setInterval(async () => {
        const result = await summariesQuery.refetch();
        const s = result.data?.find((x: any) => x.templateType === selectedTemplate);
        if (s?.status === "completed" || s?.status === "failed") clearInterval(poll);
      }, 2000);
      setTimeout(() => clearInterval(poll), 60000);
    } catch {
      Alert.alert("Erro", "Não foi possível gerar o resumo.");
    }
  }, [serverId, selectedTemplate, generateSummary, summariesQuery]);

  const handleGenerateMindMap = useCallback(async () => {
    if (!serverId) return;
    try {
      await generateMindMap.mutateAsync({ recordingId: serverId });
      const poll = setInterval(async () => {
        const result = await mindMapQuery.refetch();
        if (result.data?.status === "completed" || result.data?.status === "failed") clearInterval(poll);
      }, 2000);
      setTimeout(() => clearInterval(poll), 60000);
    } catch {
      Alert.alert("Erro", "Não foi possível gerar o mapa mental.");
    }
  }, [serverId, generateMindMap, mindMapQuery]);

  const handleGenerateActions = useCallback(async () => {
    if (!serverId) return;
    try {
      await generateActionItems.mutateAsync({ recordingId: serverId });
      await actionItemsQuery.refetch();
    } catch {
      Alert.alert("Erro", "Não foi possível extrair os itens de ação.");
    }
  }, [serverId, generateActionItems, actionItemsQuery]);

  const handleAskQuestion = useCallback(async () => {
    if (!question.trim() || !serverId || isSendingQuestion) return;
    const q = question.trim();
    setQuestion("");
    setIsSendingQuestion(true);
    try {
      await askAI.mutateAsync({ recordingId: serverId, question: q });
      await aiMessagesQuery.refetch();
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch {
      Alert.alert("Erro", "Não foi possível processar sua pergunta.");
    } finally {
      setIsSendingQuestion(false);
    }
  }, [question, serverId, isSendingQuestion, askAI, aiMessagesQuery]);

  const handleShare = useCallback(async () => {
    const title = (recording as any)?.title || "Gravação";
    const text = transcription?.fullText
      ? `${title}\n\n${transcription.fullText}`
      : title;
    try {
      await Share.share({ message: text, title });
    } catch {}
  }, [recording, transcription]);

  const handleSyncToDrive = useCallback(async () => {
    if (!serverId) {
      Alert.alert("Aviso", "Esta gravação ainda não foi sincronizada com o servidor. Aguarde o upload.");
      return;
    }
    if (!driveStatus.data?.connected) {
      Alert.alert(
        "Google Drive não conectado",
        "Conecte seu Google Drive nas configurações para sincronizar gravações.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Configurar", onPress: () => router.push("/google-drive" as any) },
        ],
      );
      return;
    }
    try {
      await syncToDrive.mutateAsync({ recordingId: serverId });
      Alert.alert("Sincronizado! ✅", "Gravação enviada para o Google Drive com sucesso.");
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Não foi possível sincronizar com o Google Drive.");
    }
  }, [serverId, driveStatus.data, syncToDrive]);

  const handleExport = useCallback(() => {
    const title = (recording as any)?.title || "Gravação";
    Alert.alert(
      "Exportar Gravação",
      "Escolha o formato de exportação:",
      [
        {
          text: "Markdown (.md)",
          onPress: async () => {
            try {
              await exportRecording({
                title,
                recordingMode: (recording as any)?.recordingMode || "ambient",
                duration: (recording as any)?.duration || 0,
                createdAt: (recording as any)?.createdAt || new Date().toISOString(),
                transcription: transcription?.fullText,
                summary: currentSummary?.content,
                summaryTemplate: selectedTemplate,
                actionItems: actionItems.map((a: any) => ({
                  text: a.text,
                  priority: a.priority,
                  assignee: a.assignee,
                  dueDate: a.dueDate,
                  isCompleted: a.isCompleted,
                })),
              }, "markdown");
            } catch { Alert.alert("Erro", "Não foi possível exportar."); }
          },
        },
        {
          text: "Texto Simples (.txt)",
          onPress: async () => {
            try {
              await exportRecording({
                title,
                recordingMode: (recording as any)?.recordingMode || "ambient",
                duration: (recording as any)?.duration || 0,
                createdAt: (recording as any)?.createdAt || new Date().toISOString(),
                transcription: transcription?.fullText,
                summary: currentSummary?.content,
                summaryTemplate: selectedTemplate,
                actionItems: actionItems.map((a: any) => ({
                  text: a.text,
                  priority: a.priority,
                  assignee: a.assignee,
                  dueDate: a.dueDate,
                  isCompleted: a.isCompleted,
                })),
              }, "text");
            } catch { Alert.alert("Erro", "Não foi possível exportar."); }
          },
        },
        {
          text: "Copiar Transcrição",
          onPress: async () => {
            if (!transcription?.fullText) {
              Alert.alert("Aviso", "Nenhuma transcrição disponível.");
              return;
            }
            await copyToClipboard(transcription.fullText);
            Alert.alert("Copiado!", "Transcrição copiada para a área de transferência.");
          },
        },
        { text: "Cancelar", style: "cancel" },
      ],
    );
  }, [recording, transcription, currentSummary, selectedTemplate, actionItems]);

  const title = (recording as any)?.title || "Gravação";
  const duration = (recording as any)?.duration || 0;
  const localUri = localRecording?.localUri;

  const needsSync = localRecording && !localRecording.isSynced;

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
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
            {formatDuration(duration)}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [styles.headerAction, pressed && { opacity: 0.7 }]}
            onPress={handleSyncToDrive}
            disabled={syncToDrive.isPending}
          >
            {syncToDrive.isPending
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <IconSymbol name="folder.fill" size={20} color={driveStatus.data?.connected ? "#4285F4" : colors.muted} />}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.headerAction, pressed && { opacity: 0.7 }]}
            onPress={handleShare}
          >
            <IconSymbol name="square.and.arrow.up" size={20} color={colors.primary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.headerAction, pressed && { opacity: 0.7 }]}
            onPress={handleExport}
          >
            <IconSymbol name="arrow.down.doc.fill" size={20} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      {/* Audio Player (if local file available) */}
      {localUri && (
        <View style={styles.playerContainer}>
          <AudioPlayer uri={localUri} duration={duration} title={title} />
        </View>
      )}

      {/* Upload Banner */}
      {needsSync && localRecording && (
        <UploadBanner recording={localRecording} onUploaded={handleUploaded} />
      )}

      {/* Tab Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { borderBottomColor: colors.border }]}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((tab) => (
          <Pressable
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && [styles.tabActive, { borderBottomColor: colors.primary }],
            ]}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab(tab.id);
            }}
          >
            <IconSymbol
              name={tab.icon as any}
              size={16}
              color={activeTab === tab.id ? colors.primary : colors.muted}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab.id ? colors.primary : colors.muted },
                activeTab === tab.id && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Tab Content */}
      <View style={{ flex: 1 }}>
        {/* TRANSCRIPTION TAB */}
        {activeTab === "transcription" && (
          <ScrollView contentContainerStyle={styles.tabContent}>
            {!serverId ? (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyEmoji}>☁️</Text>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  Sincronize para Transcrever
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                  Toque no banner acima para enviar a gravação para a nuvem e usar a transcrição com IA.
                </Text>
              </View>
            ) : transcription?.status === "completed" ? (
              <View style={styles.transcriptionContent}>
                {transcription.language && (
                  <View style={[styles.languageBadge, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.languageBadgeText, { color: colors.muted }]}>
                      🌐 {String(transcription.language).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={[styles.transcriptionText, { color: colors.foreground }]}>
                  {transcription.fullText}
                </Text>
              </View>
            ) : transcription?.status === "processing" ? (
              <View style={styles.processingState}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.processingText, { color: colors.muted }]}>
                  Transcrevendo áudio com IA...
                </Text>
                <Text style={[styles.processingSubText, { color: colors.muted }]}>
                  Isso pode levar alguns minutos
                </Text>
              </View>
            ) : transcription?.status === "failed" ? (
              <View style={styles.errorState}>
                <Text style={styles.errorEmoji}>❌</Text>
                <Text style={[styles.errorTitle, { color: colors.error }]}>Falha na Transcrição</Text>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                  onPress={handleTranscribe}
                >
                  <Text style={styles.actionButtonText}>Tentar Novamente</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyEmoji}>🎙️</Text>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  Iniciar Transcrição
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                  Converta o áudio em texto com IA em mais de 50 idiomas automaticamente.
                </Text>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                  onPress={handleTranscribe}
                  disabled={startTranscription.isPending}
                >
                  {startTranscription.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.actionButtonText}>Transcrever com IA</Text>
                  )}
                </Pressable>
              </View>
            )}
          </ScrollView>
        )}

        {/* SUMMARY TAB */}
        {activeTab === "summary" && (
          <View style={{ flex: 1 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.templateBar}
              contentContainerStyle={styles.templateBarContent}
            >
              {SUMMARY_TEMPLATES.map((t) => (
                <Pressable
                  key={t.id}
                  style={[
                    styles.templateChip,
                    { borderColor: colors.border },
                    selectedTemplate === t.id && {
                      backgroundColor: `${colors.primary}20`,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => setSelectedTemplate(t.id)}
                >
                  <Text style={styles.templateEmoji}>{t.icon}</Text>
                  <Text
                    style={[
                      styles.templateLabel,
                      { color: selectedTemplate === t.id ? colors.primary : colors.muted },
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <ScrollView contentContainerStyle={styles.tabContent}>
              {!transcription?.fullText ? (
                <View style={styles.emptyTab}>
                  <Text style={styles.emptyEmoji}>📝</Text>
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                    Transcrição Necessária
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                    Primeiro transcreva o áudio para gerar resumos inteligentes.
                  </Text>
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: colors.primary }]}
                    onPress={() => setActiveTab("transcription")}
                  >
                    <Text style={styles.actionButtonText}>Ir para Transcrição</Text>
                  </Pressable>
                </View>
              ) : currentSummary?.status === "completed" ? (
                <View style={styles.summaryContent}>
                  <Text style={[styles.summaryText, { color: colors.foreground }]}>
                    {currentSummary.content}
                  </Text>
                  <Pressable
                    style={[styles.regenerateButton, { borderColor: colors.border }]}
                    onPress={handleGenerateSummary}
                  >
                    <IconSymbol name="arrow.clockwise" size={14} color={colors.muted} />
                    <Text style={[styles.regenerateText, { color: colors.muted }]}>Regenerar</Text>
                  </Pressable>
                </View>
              ) : currentSummary?.status === "processing" ? (
                <View style={styles.processingState}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.processingText, { color: colors.muted }]}>
                    Gerando resumo com IA...
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyTab}>
                  <Text style={styles.emptyEmoji}>✨</Text>
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                    Gerar Resumo
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                    Use IA para criar um resumo inteligente desta gravação.
                  </Text>
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: colors.primary }]}
                    onPress={handleGenerateSummary}
                    disabled={generateSummary.isPending}
                  >
                    {generateSummary.isPending ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.actionButtonText}>Gerar Resumo</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {/* MIND MAP TAB */}
        {activeTab === "mindmap" && (
          <ScrollView contentContainerStyle={styles.tabContent}>
            {!transcription?.fullText ? (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyEmoji}>🧠</Text>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  Transcrição Necessária
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                  Transcreva o áudio para gerar o mapa mental interativo.
                </Text>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                  onPress={() => setActiveTab("transcription")}
                >
                  <Text style={styles.actionButtonText}>Ir para Transcrição</Text>
                </Pressable>
              </View>
            ) : mindMap?.status === "completed" && mindMap.data ? (
              <View style={styles.mindMapContainer}>
                <MindMapNode node={mindMap.data} depth={0} />
                <Pressable
                  style={[styles.regenerateButton, { borderColor: colors.border, marginTop: 16 }]}
                  onPress={handleGenerateMindMap}
                >
                  <IconSymbol name="arrow.clockwise" size={14} color={colors.muted} />
                  <Text style={[styles.regenerateText, { color: colors.muted }]}>Regenerar</Text>
                </Pressable>
              </View>
            ) : mindMap?.status === "processing" ? (
              <View style={styles.processingState}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.processingText, { color: colors.muted }]}>
                  Criando mapa mental...
                </Text>
              </View>
            ) : (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyEmoji}>🗺️</Text>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  Mapa Mental
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                  Visualize conceitos e conexões da sua gravação em um mapa interativo.
                </Text>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                  onPress={handleGenerateMindMap}
                  disabled={generateMindMap.isPending}
                >
                  {generateMindMap.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.actionButtonText}>Gerar Mapa Mental</Text>
                  )}
                </Pressable>
              </View>
            )}
          </ScrollView>
        )}

        {/* ACTION ITEMS TAB */}
        {activeTab === "actions" && (
          <ScrollView contentContainerStyle={styles.tabContent}>
            {!transcription?.fullText ? (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyEmoji}>✅</Text>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  Transcrição Necessária
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                  Transcreva o áudio para extrair itens de ação automaticamente.
                </Text>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                  onPress={() => setActiveTab("transcription")}
                >
                  <Text style={styles.actionButtonText}>Ir para Transcrição</Text>
                </Pressable>
              </View>
            ) : actionItems.length > 0 ? (
              <View style={styles.actionItemsList}>
                {actionItems.map((item: any) => (
                  <Pressable
                    key={item.id}
                    style={[
                      styles.actionItem,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                    onPress={() => {
                      updateActionItem.mutate({ id: item.id, isCompleted: !item.isCompleted });
                      actionItemsQuery.refetch();
                    }}
                  >
                    <View
                      style={[
                        styles.actionItemCheck,
                        {
                          borderColor: item.isCompleted ? colors.success : colors.border,
                          backgroundColor: item.isCompleted ? colors.success : "transparent",
                        },
                      ]}
                    >
                      {item.isCompleted && (
                        <IconSymbol name="checkmark" size={12} color="#FFFFFF" />
                      )}
                    </View>
                    <View style={styles.actionItemContent}>
                      <Text
                        style={[
                          styles.actionItemText,
                          { color: colors.foreground },
                          item.isCompleted && {
                            textDecorationLine: "line-through",
                            color: colors.muted,
                          },
                        ]}
                      >
                        {item.text}
                      </Text>
                      <View style={styles.actionItemMeta}>
                        {item.assignee && (
                          <Text style={[styles.actionItemMetaText, { color: colors.muted }]}>
                            👤 {item.assignee}
                          </Text>
                        )}
                        {item.dueDate && (
                          <Text style={[styles.actionItemMetaText, { color: colors.muted }]}>
                            📅 {item.dueDate}
                          </Text>
                        )}
                        <View
                          style={[
                            styles.priorityBadge,
                            {
                              backgroundColor:
                                item.priority === "high"
                                  ? `${colors.error}20`
                                  : item.priority === "medium"
                                  ? `${colors.warning}20`
                                  : `${colors.success}20`,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.priorityText,
                              {
                                color:
                                  item.priority === "high"
                                    ? colors.error
                                    : item.priority === "medium"
                                    ? colors.warning
                                    : colors.success,
                              },
                            ]}
                          >
                            {item.priority === "high"
                              ? "Alta"
                              : item.priority === "medium"
                              ? "Média"
                              : "Baixa"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                ))}
                <Pressable
                  style={[styles.regenerateButton, { borderColor: colors.border, marginTop: 8 }]}
                  onPress={handleGenerateActions}
                >
                  <IconSymbol name="arrow.clockwise" size={14} color={colors.muted} />
                  <Text style={[styles.regenerateText, { color: colors.muted }]}>Regenerar</Text>
                </Pressable>
              </View>
            ) : generateActionItems.isPending ? (
              <View style={styles.processingState}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.processingText, { color: colors.muted }]}>
                  Extraindo itens de ação...
                </Text>
              </View>
            ) : (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyEmoji}>📋</Text>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  Itens de Ação
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                  Extraia automaticamente tarefas, responsáveis e prazos da gravação.
                </Text>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                  onPress={handleGenerateActions}
                >
                  <Text style={styles.actionButtonText}>Extrair Ações</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        )}

        {/* ASK AI TAB */}
        {activeTab === "ask" && (
          <View style={{ flex: 1 }}>
            {!transcription?.fullText ? (
              <View style={[styles.tabContent, styles.emptyTab]}>
                <Text style={styles.emptyEmoji}>🤖</Text>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  Transcrição Necessária
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                  Transcreva o áudio para fazer perguntas sobre o conteúdo com IA.
                </Text>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                  onPress={() => setActiveTab("transcription")}
                >
                  <Text style={styles.actionButtonText}>Ir para Transcrição</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <ScrollView
                  ref={chatScrollRef}
                  contentContainerStyle={styles.chatContent}
                  onContentSizeChange={() =>
                    chatScrollRef.current?.scrollToEnd({ animated: false })
                  }
                >
                  {aiMessages.length === 0 && (
                    <View style={styles.chatEmpty}>
                      <Text style={styles.chatEmptyEmoji}>💬</Text>
                      <Text style={[styles.chatEmptyText, { color: colors.muted }]}>
                        Faça perguntas sobre o conteúdo da gravação. A IA responderá com base na
                        transcrição.
                      </Text>
                    </View>
                  )}
                  {aiMessages.map((msg: any) => (
                    <View
                      key={msg.id}
                      style={[
                        styles.chatMessage,
                        msg.role === "user"
                          ? [styles.chatMessageUser, { backgroundColor: colors.primary }]
                          : [
                              styles.chatMessageAI,
                              { backgroundColor: colors.surface, borderColor: colors.border },
                            ],
                      ]}
                    >
                      <Text
                        style={[
                          styles.chatMessageText,
                          { color: msg.role === "user" ? "#FFFFFF" : colors.foreground },
                        ]}
                      >
                        {msg.content}
                      </Text>
                    </View>
                  ))}
                  {isSendingQuestion && (
                    <View
                      style={[
                        styles.chatMessage,
                        styles.chatMessageAI,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  )}
                </ScrollView>

                <View
                  style={[
                    styles.chatInputBar,
                    { backgroundColor: colors.background, borderTopColor: colors.border },
                  ]}
                >
                  <TextInput
                    style={[
                      styles.chatInput,
                      {
                        backgroundColor: colors.surface,
                        color: colors.foreground,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="Pergunte sobre a gravação..."
                    placeholderTextColor={colors.muted}
                    value={question}
                    onChangeText={setQuestion}
                    multiline
                    maxLength={500}
                    returnKeyType="send"
                    onSubmitEditing={handleAskQuestion}
                  />
                  <Pressable
                    style={[
                      styles.sendButton,
                      { backgroundColor: question.trim() ? colors.primary : colors.border },
                    ]}
                    onPress={handleAskQuestion}
                    disabled={!question.trim() || isSendingQuestion}
                  >
                    <IconSymbol name="paperplane.fill" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>
              </>
            )}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backButton: { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: "600" },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  headerAction: { padding: 8 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  playerContainer: { paddingHorizontal: 16, paddingVertical: 8 },
  tabBar: { borderBottomWidth: StyleSheet.hairlineWidth, maxHeight: 48 },
  tabBarContent: { paddingHorizontal: 16, gap: 4 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {},
  tabText: { fontSize: 13, fontWeight: "500" },
  tabTextActive: { fontWeight: "600" },
  tabContent: { padding: 16, flexGrow: 1 },
  emptyTab: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 40, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  actionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    minWidth: 160,
  },
  actionButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  processingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingTop: 60,
  },
  processingText: { fontSize: 15 },
  processingSubText: { fontSize: 13 },
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingTop: 40,
  },
  errorEmoji: { fontSize: 48 },
  errorTitle: { fontSize: 18, fontWeight: "700" },
  transcriptionContent: { gap: 12 },
  languageBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  languageBadgeText: { fontSize: 12, fontWeight: "600" },
  transcriptionText: { fontSize: 15, lineHeight: 24 },
  summaryContent: { gap: 12 },
  summaryText: { fontSize: 15, lineHeight: 24 },
  regenerateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  regenerateText: { fontSize: 13 },
  templateBar: { maxHeight: 52 },
  templateBarContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  templateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  templateEmoji: { fontSize: 13 },
  templateLabel: { fontSize: 12, fontWeight: "500" },
  mindMapContainer: { paddingBottom: 24 },
  mindMapNode: { marginBottom: 4 },
  mindMapNodeContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  mindMapNodeText: { fontSize: 14, fontWeight: "500", flexShrink: 1 },
  mindMapChildren: { marginTop: 4 },
  actionItemsList: { gap: 8 },
  actionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionItemCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  actionItemContent: { flex: 1, gap: 6 },
  actionItemText: { fontSize: 14, lineHeight: 20 },
  actionItemMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  actionItemMetaText: { fontSize: 12 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  priorityText: { fontSize: 11, fontWeight: "600" },
  chatContent: { padding: 16, gap: 12, flexGrow: 1 },
  chatEmpty: { alignItems: "center", paddingTop: 40, gap: 12 },
  chatEmptyEmoji: { fontSize: 40 },
  chatEmptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  chatMessage: { maxWidth: "85%", padding: 12, borderRadius: 16 },
  chatMessageUser: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  chatMessageAI: { alignSelf: "flex-start", borderWidth: 1, borderBottomLeftRadius: 4 },
  chatMessageText: { fontSize: 14, lineHeight: 20 },
  chatInputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  chatInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
