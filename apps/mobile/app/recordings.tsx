import { formatDurationMs } from '@gravador/core';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { Pressable, Text, View } from 'react-native';
import { StudioPill, StudioScreen } from '../src/components/StudioScreen';
import { auth, db } from '../src/lib/firebase';
import { t } from '../src/lib/i18n';

const DECORATIVE_BARS: Array<{ id: string; height: number }> = [
  { id: 'bar-1', height: 14 },
  { id: 'bar-2', height: 24 },
  { id: 'bar-3', height: 42 },
  { id: 'bar-4', height: 30 },
  { id: 'bar-5', height: 60 },
  { id: 'bar-6', height: 36 },
  { id: 'bar-7', height: 48 },
  { id: 'bar-8', height: 22 },
  { id: 'bar-9', height: 38 },
  { id: 'bar-10', height: 18 },
];

export default function RecordingsScreen() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['recordings'],
    queryFn: async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) return [];
      const q = query(
        collection(db, 'recordings'),
        where('createdBy', '==', userId),
        where('deletedAt', '==', null),
        orderBy('capturedAt', 'desc'),
        limit(100),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Array<{
        id: string;
        title?: string;
        durationMs: number;
        status: string;
        capturedAt: { toDate: () => Date };
      }>;
    },
  });

  const totalMinutes = Math.round(
    (data ?? []).reduce((sum, item) => sum + item.durationMs, 0) / 60000,
  );

  return (
    <StudioScreen className="pb-6 pt-2">
      <View className="gap-5 pb-4">
        <Pressable onPress={() => router.back()}>
          <Text className="text-sm text-mute">← {t('nav.home')}</Text>
        </Pressable>

        <View>
          <StudioPill label="Library" tone="neutral" />
          <Text className="mt-5 text-xs uppercase tracking-[0.28em] text-mute">
            Recording archive
          </Text>
          <Text className="mt-3 text-4xl font-semibold text-text">{t('nav.recordings')}</Text>
          <Text className="mt-3 leading-7 text-mute">
            Agora a biblioteca pode parecer uma coleção de sessões relevantes, não uma lista fria de
            linhas.
          </Text>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1 rounded-[28px] border border-border bg-surface px-5 py-5">
            <Text className="text-xs uppercase tracking-[0.24em] text-mute">Items</Text>
            <Text className="mt-3 text-3xl font-semibold text-text">{data?.length ?? 0}</Text>
            <Text className="mt-1 text-sm text-mute">Sessões encontradas</Text>
          </View>
          <View className="flex-1 rounded-[28px] border border-border bg-surface px-5 py-5">
            <Text className="text-xs uppercase tracking-[0.24em] text-mute">Minutes</Text>
            <Text className="mt-3 text-3xl font-semibold text-text">{totalMinutes}</Text>
            <Text className="mt-1 text-sm text-mute">Áudio nesta tela</Text>
          </View>
        </View>
      </View>

      <FlashList
        data={data ?? []}
        estimatedItemSize={188}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          !isLoading ? (
            <View className="rounded-[30px] border border-dashed border-border bg-surface px-6 py-12">
              <Text className="text-center text-base text-mute">Nenhuma gravação ainda.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            className="mb-4 rounded-[30px] border border-border bg-surface px-5 py-5"
            onPress={() => router.push(`/recording/${item.id}`)}
          >
            <View className="flex-row items-center justify-between gap-4">
              <StudioPill
                label={t(`recording.status.${item.status}`)}
                tone={item.status === 'ready' ? 'success' : 'neutral'}
              />
              <Text className="text-sm text-mute">{formatDurationMs(item.durationMs)}</Text>
            </View>
            <Text className="mt-4 text-2xl font-semibold text-text">
              {item.title ?? item.capturedAt.toDate().toLocaleString()}
            </Text>
            <Text className="mt-2 text-sm leading-6 text-mute">
              {item.capturedAt.toDate().toLocaleString()}
            </Text>

            <View className="mt-5 flex-row items-end gap-[5px]">
              {DECORATIVE_BARS.map((bar) => (
                <View
                  key={`${item.id}-${bar.id}`}
                  className="flex-1 rounded-full bg-accent/70"
                  style={{ height: bar.height }}
                />
              ))}
            </View>
          </Pressable>
        )}
      />
    </StudioScreen>
  );
}
