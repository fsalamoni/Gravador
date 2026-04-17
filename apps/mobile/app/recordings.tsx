import { formatDurationMs } from '@gravador/core';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { t } from '../src/lib/i18n';
import { supabase } from '../src/lib/supabase';

export default function RecordingsScreen() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['recordings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recordings')
        .select('id,title,duration_ms,status,captured_at')
        .is('deleted_at', null)
        .order('captured_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
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
              {item.title ?? new Date(item.captured_at).toLocaleString()}
            </Text>
            <Text className="text-mute text-sm mt-1">
              {formatDurationMs(item.duration_ms)} · {t(`recording.status.${item.status}`)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
