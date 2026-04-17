import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useI18n } from '../src/lib/i18n';

export default function SettingsScreen() {
  const router = useRouter();
  const locale = useI18n((s) => s.locale);
  const setLocale = useI18n((s) => s.setLocale);

  return (
    <View className="flex-1 bg-bg px-6 pt-16">
      <Pressable onPress={() => router.back()}>
        <Text className="text-mute">← voltar</Text>
      </Pressable>
      <Text className="text-text text-2xl font-semibold mt-2">Configurações</Text>

      <View className="mt-8">
        <Text className="text-mute mb-2">Idioma</Text>
        <View className="flex-row gap-2">
          {(['pt-BR', 'en'] as const).map((l) => (
            <Pressable
              key={l}
              onPress={() => setLocale(l)}
              className={`px-4 py-2 rounded-full ${locale === l ? 'bg-accent' : 'bg-surface'}`}
            >
              <Text className={locale === l ? 'text-white' : 'text-text'}>{l}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
