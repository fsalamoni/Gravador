import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text } from 'react-native';

export default function RecordingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
      <Pressable onPress={() => router.back()}>
        <Text className="text-mute">← voltar</Text>
      </Pressable>
      <Text className="text-text text-2xl font-semibold mt-2">Gravação</Text>
      <Text className="text-mute mt-1">id: {id}</Text>
      <Text className="text-text mt-6">
        A visualização rica (transcript, resumo, mapa mental, chat) vive no web app — use o link
        "Abrir no web" para acessar.
      </Text>
    </ScrollView>
  );
}
