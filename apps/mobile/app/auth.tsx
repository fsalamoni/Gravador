import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { StudioPanel, StudioPill, StudioScreen } from '../src/components/StudioScreen';
import { useAuthSession } from '../src/features/auth/session';
import { auth } from '../src/lib/firebase';
import { t } from '../src/lib/i18n';

WebBrowser.maybeCompleteAuthSession();

type GoogleClientIds = {
  androidClientId?: string;
  iosClientId?: string;
  webClientId?: string;
};

function getExpoExtraValue(key: string) {
  const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
  return extra?.[key];
}

export default function AuthScreen() {
  const router = useRouter();
  const authReady = useAuthSession((state) => state.ready);
  const user = useAuthSession((state) => state.user);

  const googleClientIds = useMemo<GoogleClientIds>(
    () => ({
      androidClientId:
        getExpoExtraValue('googleAndroidClientId') ??
        process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      iosClientId:
        getExpoExtraValue('googleIosClientId') ?? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      webClientId:
        getExpoExtraValue('googleWebClientId') ?? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    }),
    [],
  );

  const isPlatformGoogleConfigured =
    Platform.OS === 'android'
      ? Boolean(googleClientIds.androidClientId)
      : Platform.OS === 'ios'
        ? Boolean(googleClientIds.iosClientId)
        : Boolean(googleClientIds.webClientId);

  useEffect(() => {
    if (authReady && user) {
      router.replace('/');
    }
  }, [authReady, router, user]);

  if (!isPlatformGoogleConfigured) {
    return (
      <StudioScreen scroll className="justify-center py-6">
        <View className="min-h-full justify-center gap-5 py-6">
          <StudioPill label={t('auth.googleOnly')} tone="neutral" />
          <Text className="text-xs uppercase tracking-[0.28em] text-mute">Studio access</Text>
          <Text className="text-5xl font-semibold leading-[56px] text-text">
            Entre no Gravador com presença de produto, não com cara de tela provisória.
          </Text>
          <Text className="text-base leading-8 text-mute">{t('auth.mobileGoogleSubtitle')}</Text>

          <StudioPanel>
            <Text className="text-sm font-semibold uppercase tracking-[0.24em] text-danger">
              Configuração pendente
            </Text>
            <Text className="mt-4 text-3xl font-semibold text-text">
              {t('auth.mobileGoogleConfigError')}
            </Text>
            <Text className="mt-4 leading-7 text-mute">{t('auth.mobileGoogleHint')}</Text>
          </StudioPanel>
        </View>
      </StudioScreen>
    );
  }

  return <ConfiguredAuthScreen googleClientIds={googleClientIds} />;
}

function ConfiguredAuthScreen({ googleClientIds }: { googleClientIds: GoogleClientIds }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: googleClientIds.androidClientId,
    iosClientId: googleClientIds.iosClientId,
    webClientId: googleClientIds.webClientId,
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true,
  });

  useEffect(() => {
    if (!response) return;
    const authResponse = response;

    async function finishGoogleAuth() {
      if (authResponse.type !== 'success') {
        setSigningIn(false);

        if (authResponse.type === 'cancel' || authResponse.type === 'dismiss') {
          setError(t('auth.mobileGoogleCancelled'));
          return;
        }

        setError(t('auth.mobileGoogleError'));
        return;
      }

      const idToken = authResponse.params.id_token;

      if (!idToken) {
        setSigningIn(false);
        setError(t('auth.mobileGoogleConfigError'));
        return;
      }

      try {
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
        router.replace('/');
      } catch {
        setError(t('auth.mobileGoogleError'));
      } finally {
        setSigningIn(false);
      }
    }

    finishGoogleAuth().catch(() => {
      setSigningIn(false);
      setError(t('auth.mobileGoogleError'));
    });
  }, [response, router]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSigningIn(true);

    try {
      const result = await promptAsync();
      if (result.type === 'cancel' || result.type === 'dismiss') {
        setSigningIn(false);
        setError(t('auth.mobileGoogleCancelled'));
      }
    } catch {
      setSigningIn(false);
      setError(t('auth.mobileGoogleError'));
    }
  };

  return (
    <StudioScreen scroll className="py-6">
      <View className="gap-5 pb-4">
        <StudioPill label={t('auth.googleOnly')} tone="accent" />
        <Text className="text-xs uppercase tracking-[0.28em] text-mute">Workspace gateway</Text>
        <Text className="text-5xl font-semibold leading-[56px] text-text">
          O acesso do mobile agora precisa parecer a porta de entrada de uma ferramenta séria.
        </Text>
        <Text className="text-base leading-8 text-mute">{t('auth.mobileGoogleSubtitle')}</Text>

        <View className="grid gap-4">
          <StudioPanel>
            <Text className="text-xs uppercase tracking-[0.24em] text-mute">Why it matters</Text>
            <Text className="mt-4 text-3xl font-semibold text-text">
              Mesmo login, mesmo backend, mesma sessão mental.
            </Text>
            <Text className="mt-4 leading-7 text-mute">
              Entre com a conta Google do workspace web para gravar, sincronizar e revisar como
              parte de um único produto.
            </Text>
            <View className="mt-5 gap-3">
              <View className="rounded-[24px] border border-border bg-surfaceAlt px-4 py-3">
                <Text className="font-medium text-text">Google-only auth</Text>
                <Text className="mt-1 text-sm text-mute">
                  A mesma identidade move o app e o workspace.
                </Text>
              </View>
              <View className="rounded-[24px] border border-border bg-surfaceAlt px-4 py-3">
                <Text className="font-medium text-text">Live backend</Text>
                <Text className="mt-1 text-sm text-mute">
                  Firestore nomeado, upload e health check já estão vivos.
                </Text>
              </View>
              <View className="rounded-[24px] border border-border bg-surfaceAlt px-4 py-3">
                <Text className="font-medium text-text">Android first</Text>
                <Text className="mt-1 text-sm text-mute">
                  A trilha do APK continua pronta para o momento em que o Expo autenticar.
                </Text>
              </View>
            </View>
          </StudioPanel>

          <StudioPanel>
            <Text className="text-xs uppercase tracking-[0.24em] text-mute">Continue</Text>
            <Text className="mt-4 text-3xl font-semibold text-text">{t('auth.signIn')}</Text>
            <Text className="mt-4 leading-7 text-mute">{t('auth.mobileGoogleHint')}</Text>

            {error ? (
              <View className="mt-5 rounded-[24px] border border-danger/40 bg-danger/10 px-4 py-4">
                <Text className="leading-6 text-danger">{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleGoogleSignIn}
              disabled={!request || signingIn}
              className="mt-6 flex-row items-center justify-center gap-3 rounded-[26px] bg-accent px-5 py-5 disabled:opacity-60"
            >
              {signingIn ? <ActivityIndicator color="#120d0a" /> : null}
              <Text className="font-semibold text-[#120d0a]">
                {signingIn ? t('auth.mobileSigningIn') : t('auth.continueWithGoogle')}
              </Text>
            </Pressable>
          </StudioPanel>
        </View>
      </View>
    </StudioScreen>
  );
}
