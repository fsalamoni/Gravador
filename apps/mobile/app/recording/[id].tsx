import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { StudioPanel, StudioPill, StudioScreen } from '../../src/components/StudioScreen';

export default function RecordingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <StudioScreen scroll className="pb-6 pt-2">
      <View className="gap-5 pb-4">
        <Pressable onPress={() => router.back()}>
          <Text className="text-sm text-mute">← voltar</Text>
        </Pressable>

        <View>
          <StudioPill label="Detail" tone="neutral" />
          <Text className="mt-5 text-xs uppercase tracking-[0.28em] text-mute">
            Recording surface
          </Text>
          <Text className="mt-3 text-4xl font-semibold text-text">Gravação</Text>
          <Text className="mt-3 leading-7 text-mute">
            Mesmo quando o detalhe rico mora no web, o mobile precisa entregar uma passagem elegante
            e clara entre os dois ambientes.
          </Text>
        </View>

        <StudioPanel>
          <Text className="text-xs uppercase tracking-[0.24em] text-mute">Recording id</Text>
          <Text className="mt-4 break-all text-xl font-semibold text-text">{id}</Text>
          <Text className="mt-4 leading-7 text-mute">
            A visualização rica com transcript, resumo, mapa mental, capítulos e chat continua no
            web app para revisão profunda.
          </Text>
        </StudioPanel>

        <StudioPanel>
          <Text className="text-xs uppercase tracking-[0.24em] text-mute">Next move</Text>
          <Text className="mt-4 text-3xl font-semibold text-text">
            Abra no web para análise completa.
          </Text>
          <Text className="mt-4 leading-7 text-mute">
            O mobile agora serve melhor como controle e captura; o workspace web continua sendo a
            bancada principal para IA e edição contextual.
          </Text>
          <Pressable
            className="mt-6 rounded-[26px] bg-accent px-5 py-4"
            onPress={() => router.back()}
          >
            <Text className="text-center font-semibold text-[#120d0a]">Voltar à biblioteca</Text>
          </Pressable>
        </StudioPanel>
      </View>
    </StudioScreen>
  );
}
