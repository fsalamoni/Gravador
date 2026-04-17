import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatDuration } from "@/hooks/use-audio-recorder";
import { useRecordings, type LocalRecording } from "@/lib/recordings-context";
import { useAuth } from "@/hooks/use-auth";

const FILTERS = [
  { id: "all", label: "Todas" },
  { id: "today", label: "Hoje" },
  { id: "meeting", label: "Reuniões" },
  { id: "call", label: "Chamadas" },
  { id: "voice_memo", label: "Notas" },
  { id: "starred", label: "Favoritas" },
];

const MODE_LABELS: Record<string, string> = {
  ambient: "Ambiente",
  meeting: "Reunião",
  call: "Chamada",
  voice_memo: "Nota de Voz",
};

const MODE_COLORS: Record<string, string> = {
  ambient: "#6366F1",
  meeting: "#10B981",
  call: "#F59E0B",
  voice_memo: "#8B5CF6",
};

function RecordingCard({
  recording,
  onPress,
  onStar,
  onDelete,
}: {
  recording: LocalRecording;
  onPress: () => void;
  onStar: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const modeColor = MODE_COLORS[recording.recordingMode] || colors.primary;
  const date = new Date(recording.createdAt);
  const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { opacity: 0.85 },
      ]}
      onPress={onPress}
    >
      {/* Mode indicator bar */}
      <View style={[styles.cardModeBar, { backgroundColor: modeColor }]} />

      <View style={styles.cardContent}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.modeBadge, { backgroundColor: `${modeColor}20` }]}>
              <Text style={[styles.modeBadgeText, { color: modeColor }]}>
                {MODE_LABELS[recording.recordingMode]}
              </Text>
            </View>
            {recording.isStarred && (
              <IconSymbol name="star.fill" size={14} color="#F59E0B" />
            )}
          </View>
          <Pressable
            style={({ pressed }) => [styles.starButton, pressed && { opacity: 0.6 }]}
            onPress={onStar}
          >
            <IconSymbol
              name={recording.isStarred ? "star.fill" : "star"}
              size={20}
              color={recording.isStarred ? "#F59E0B" : colors.muted}
            />
          </Pressable>
        </View>

        {/* Title */}
        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
          {recording.title}
        </Text>

        {/* Footer row */}
        <View style={styles.cardFooter}>
          <View style={styles.cardMeta}>
            <IconSymbol name="clock" size={13} color={colors.muted} />
            <Text style={[styles.cardMetaText, { color: colors.muted }]}>
              {formatDuration(recording.duration)}
            </Text>
            <Text style={[styles.cardMetaText, { color: colors.muted }]}>•</Text>
            <Text style={[styles.cardMetaText, { color: colors.muted }]}>
              {dateStr} {timeStr}
            </Text>
          </View>

          <View style={styles.cardBadges}>
            {recording.transcriptionStatus === "completed" && (
              <View style={[styles.aiBadge, { backgroundColor: `${colors.success}20` }]}>
                <Text style={[styles.aiBadgeText, { color: colors.success }]}>Transcrito</Text>
              </View>
            )}
            {recording.summaryStatus === "completed" && (
              <View style={[styles.aiBadge, { backgroundColor: `${colors.primary}20` }]}>
                <Text style={[styles.aiBadgeText, { color: colors.primary }]}>Resumido</Text>
              </View>
            )}
            {!recording.isSynced && (
              <View style={[styles.aiBadge, { backgroundColor: `${colors.warning}20` }]}>
                <Text style={[styles.aiBadgeText, { color: colors.warning }]}>Local</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function EmptyState() {
  const colors = useColors();
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🎙️</Text>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        Nenhuma gravação ainda
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
        Toque no botão de gravação para capturar sua primeira nota de áudio com IA.
      </Text>
    </View>
  );
}

export default function LibraryScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { filteredRecordings, state, setFilter, updateRecording, deleteRecording } =
    useRecordings();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const displayedRecordings = searchQuery
    ? filteredRecordings.filter(
        (r) =>
          r.title.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : filteredRecordings;

  const handleRecordingPress = useCallback((recording: LocalRecording) => {
    const path = recording.serverId
      ? `/detail/${recording.serverId}`
      : `/detail/local_${recording.id}`;
    router.push(path as any);
  }, []);

  const handleStar = useCallback(
    (recording: LocalRecording) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      updateRecording(recording.id, { isStarred: !recording.isStarred });
    },
    [updateRecording],
  );

  const handleDelete = useCallback(
    (recording: LocalRecording) => {
      Alert.alert(
        "Excluir Gravação",
        `Deseja excluir "${recording.title}"? Esta ação não pode ser desfeita.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Excluir",
            style: "destructive",
            onPress: () => {
              if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              deleteRecording(recording.id);
            },
          },
        ],
      );
    },
    [deleteRecording],
  );

  const handleRecord = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push("/recording");
  }, []);

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>AudioNotes</Text>
          {user && (
            <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
              {displayedRecordings.length} gravações
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [
              styles.headerIconButton,
              { backgroundColor: colors.surface },
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => setIsSearching(!isSearching)}
          >
            <IconSymbol name="magnifyingglass" size={20} color={colors.foreground} />
          </Pressable>
        </View>
      </View>

      {/* Search Bar */}
      {isSearching && (
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Buscar gravações..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <IconSymbol name="xmark.circle.fill" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.filterTab,
                state.activeFilter === item.id && [
                  styles.filterTabActive,
                  { backgroundColor: colors.primary },
                ],
                { borderColor: colors.border },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => setFilter(item.id)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  { color: state.activeFilter === item.id ? "#FFFFFF" : colors.muted },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {/* Recordings List */}
      <FlatList
        data={displayedRecordings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          displayedRecordings.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={<EmptyState />}
        renderItem={({ item }) => (
          <RecordingCard
            recording={item}
            onPress={() => handleRecordingPress(item)}
            onStar={() => handleStar(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />

      {/* FAB - Record Button */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary },
          pressed && { transform: [{ scale: 0.95 }], opacity: 0.9 },
        ]}
        onPress={handleRecord}
      >
        <IconSymbol name="mic.fill" size={28} color="#FFFFFF" />
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8 },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  filterContainer: { paddingVertical: 8 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterTabActive: { borderColor: "transparent" },
  filterTabText: { fontSize: 13, fontWeight: "500" },
  listContent: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 4 },
  listContentEmpty: { flex: 1 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
  },
  cardModeBar: { width: 4 },
  cardContent: { flex: 1, padding: 14 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  modeBadgeText: { fontSize: 11, fontWeight: "600" },
  starButton: { padding: 4 },
  cardTitle: { fontSize: 15, fontWeight: "600", lineHeight: 20, marginBottom: 10 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
  },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardMetaText: { fontSize: 12 },
  cardBadges: { flexDirection: "row", gap: 4 },
  aiBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiBadgeText: { fontSize: 10, fontWeight: "600" },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  emptySubtitle: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
