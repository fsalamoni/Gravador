import { formatDurationMs } from '@gravador/core';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { Pressable, Text, View } from 'react-native';
import { db } from '../src/lib/firebase';
import { t } from '../src/lib/i18n';

export default function RecordingsScreen() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['recordings'],
    queryFn: async () => {
      const q = query(
        collection(db, 'recordings'),
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

  return (
    <View className="flex-1 bg-bg pt-16 px-6">
      <Pressable onPress={() => router.back()} className="mb-4">
        <Text className="text-mute">← {t('nav.home')}</Text>
      </Pressable>
      <Text className="text-text text-2xl font-semibold mb-4">{t('nav.recordings')}</Text>

      <FlashList
        data={data ?? []}
        estimatedItemSize={72}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          !isLoading ? (
            <Text className="text-mute mt-8 text-center">Nenhuma gravação ainda.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            className="py-4 border-b border-surface"
            onPress={() => router.push(`/recording/${item.id}`)}
          >
            <Text className="text-text font-medium">
              {item.title ?? item.capturedAt.toDate().toLocaleString()}
            </Text>
            <Text className="text-mute text-sm mt-1">
              {formatDurationMs(item.durationMs)} · {t(`recording.status.${item.status}`)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
