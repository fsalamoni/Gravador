import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StudioPanel, StudioPill, StudioScreen } from '../src/components/StudioScreen';
import { useAuthSession } from '../src/features/auth/session';
import { auth } from '../src/lib/firebase';
import { useI18n } from '../src/lib/i18n';

export default function SettingsScreen() {
  const router = useRouter();
  const locale = useI18n((s) => s.locale);
  const setLocale = useI18n((s) => s.setLocale);
  const user = useAuthSession((state) => state.user);
  const [signingOut, setSigningOut] = useState(false);

  return (
    <StudioScreen scroll className="pb-6 pt-2">
      <View className="gap-5 pb-4">
        <Pressable onPress={() => router.back()}>
          <Text className="text-sm text-mute">← voltar</Text>
        </Pressable>

        <View>
          <StudioPill label="Control room" tone="neutral" />
          <Text className="mt-5 text-xs uppercase tracking-[0.28em] text-mute">Preferences</Text>
          <Text className="mt-3 text-4xl font-semibold text-text">Configurações</Text>
          <Text className="mt-3 leading-7 text-mute">
            O app agora precisa sustentar uma sensação de ferramenta premium também nas áreas
            calmas: conta, idioma e sessão.
          </Text>
        </View>

        <StudioPanel>
          <Text className="text-xs uppercase tracking-[0.24em] text-mute">Google</Text>
          <Text className="mt-4 text-3xl font-semibold text-text">{user?.email ?? '-'}</Text>
          <Text className="mt-3 text-sm leading-6 text-mute">{user?.uid ?? '-'}</Text>
          <View className="mt-5 rounded-[24px] border border-border bg-surfaceAlt px-4 py-4">
            <Text className="font-medium text-text">
              Sessão conectada ao mesmo backend do workspace web.
            </Text>
            <Text className="mt-2 text-sm leading-6 text-mute">
              Isso mantém gravações, uploads e contexto de autenticação na mesma trilha de produto.
            </Text>
          </View>
        </StudioPanel>

        <StudioPanel>
          <Text className="text-xs uppercase tracking-[0.24em] text-mute">Idioma</Text>
          <View className="mt-5 flex-row gap-3">
            {(['pt-BR', 'en'] as const).map((language) => (
              <Pressable
                key={language}
                onPress={() => setLocale(language)}
                className={`flex-1 rounded-[22px] border px-4 py-4 ${
                  locale === language ? 'border-accent bg-accent' : 'border-border bg-surfaceAlt'
                }`}
              >
                <Text
                  className={`text-center font-semibold ${locale === language ? 'text-[#120d0a]' : 'text-text'}`}
                >
                  {language}
                </Text>
              </Pressable>
            ))}
          </View>
        </StudioPanel>

        <StudioPanel>
          <Text className="text-xs uppercase tracking-[0.24em] text-mute">Release path</Text>
          <View className="mt-4 gap-3">
            <View className="rounded-[24px] border border-border bg-surfaceAlt px-4 py-4">
              <Text className="font-medium text-text">Web vivo, mobile em refinamento.</Text>
              <Text className="mt-2 text-sm leading-6 text-mute">
                A linguagem visual agora está sendo puxada para o mesmo nível do web antes do APK
                final.
              </Text>
            </View>
            <View className="rounded-[24px] border border-border bg-surfaceAlt px-4 py-4">
              <Text className="font-medium text-text">Próximo gargalo: Expo/EAS auth.</Text>
              <Text className="mt-2 text-sm leading-6 text-mute">
                Assim que autenticar, a trilha do preview Android volta a andar.
              </Text>
            </View>
          </View>
        </StudioPanel>

        <Pressable
          onPress={async () => {
            setSigningOut(true);
            try {
              await signOut(auth);
              router.replace('/auth');
            } finally {
              setSigningOut(false);
            }
          }}
          disabled={signingOut}
          className="rounded-[28px] border border-danger/50 bg-danger/10 px-5 py-5"
        >
          <Text className="text-center font-semibold text-danger">
            {signingOut ? 'Saindo...' : 'Sair'}
          </Text>
        </Pressable>
      </View>
    </StudioScreen>
  );
}
