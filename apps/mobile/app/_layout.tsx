import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Component, type ReactNode, useEffect } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../src/global.css';
import { StudioPanel, StudioScreen } from '../src/components/StudioScreen';
import { useAuthSession, useSyncAuthSession } from '../src/features/auth/session';
import { registerBackgroundUploadTask } from '../src/features/recorder/background-task';
import { t } from '../src/lib/i18n';

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: '#120d0a',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 32,
          }}
        >
          <ScrollView contentContainerStyle={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text
              style={{ color: '#f38a37', fontSize: 18, fontWeight: '600', marginBottom: 12 }}
            >
              Erro ao iniciar o app
            </Text>
            <Text style={{ color: '#baa390', textAlign: 'center', lineHeight: 22, fontSize: 14 }}>
              {this.state.error.message}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 2 } },
});

function AppNavigator() {
  const pathname = usePathname();
  const router = useRouter();
  const authReady = useAuthSession((state) => state.ready);
  const user = useAuthSession((state) => state.user);
  const isAuthRoute = pathname === '/auth';

  useEffect(() => {
    if (!authReady) return;
    if (!user && !isAuthRoute) {
      router.replace('/auth');
      return;
    }

    if (user && isAuthRoute) {
      router.replace('/');
    }
  }, [authReady, isAuthRoute, router, user]);

  if (!authReady || (!user && !isAuthRoute) || (user && isAuthRoute)) {
    return (
      <StudioScreen className="justify-center" edges={['top', 'left', 'right', 'bottom']}>
        <StudioPanel className="items-center gap-4 py-8">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-accent/15">
            <ActivityIndicator size="large" color="#f38a37" />
          </View>
          <Text className="text-xs uppercase tracking-[0.28em] text-mute">Workspace boot</Text>
          <Text className="text-center text-2xl font-semibold text-text">
            {t('auth.mobilePreparing')}
          </Text>
          <Text className="text-center leading-6 text-mute">
            Restaurando sessão, registrando tarefas de fundo e preparando a camada visual do app.
          </Text>
        </StudioPanel>
      </StudioScreen>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#120d0a' },
      }}
    />
  );
}

export default function RootLayout() {
  useSyncAuthSession();

  useEffect(() => {
    registerBackgroundUploadTask().catch(() => undefined);
  }, []);

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="light" />
            <AppNavigator />
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
