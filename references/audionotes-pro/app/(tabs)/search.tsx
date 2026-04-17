import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
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
import { useRecordings } from "@/lib/recordings-context";

export default function SearchScreen() {
  const colors = useColors();
  const { state } = useRecordings();
  const [query, setQuery] = useState("");

  const results = query.length > 1
    ? state.recordings.filter(
        (r) =>
          r.title.toLowerCase().includes(query.toLowerCase()),
      )
    : [];

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Buscar</Text>
      </View>

      {/* Search Input */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Buscar em gravações, transcrições..."
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          autoFocus={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")}>
            <IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} />
          </Pressable>
        )}
      </View>

      {/* Results */}
      {query.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Busque suas gravações
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Pesquise por título, conteúdo de transcrição ou resumos
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>😕</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Nenhum resultado
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Tente outros termos de busca
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.resultCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => {
                const path = item.serverId ? `/detail/${item.serverId}` : `/detail/local_${item.id}`;
                router.push(path as any);
              }}
            >
              <View style={styles.resultHeader}>
                <IconSymbol name="mic.fill" size={16} color={colors.primary} />
                <Text style={[styles.resultTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {item.title}
                </Text>
              </View>
              <View style={styles.resultMeta}>
                <Text style={[styles.resultMetaText, { color: colors.muted }]}>
                  {formatDuration(item.duration)}
                </Text>
                <Text style={[styles.resultMetaText, { color: colors.muted }]}>•</Text>
                <Text style={[styles.resultMetaText, { color: colors.muted }]}>
                  {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                </Text>
              </View>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 16 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  resultCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultTitle: { flex: 1, fontSize: 15, fontWeight: "600" },
  resultMeta: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 24 },
  resultMetaText: { fontSize: 12 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
