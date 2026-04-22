import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Component, type ErrorInfo, type ReactNode, useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../src/global.css';
import { StudioPanel, StudioScreen } from '../src/components/StudioScreen';
import { useAuthSession, useSyncAuthSession } from '../src/features/auth/session';
import { registerBackgroundUploadTask } from '../src/features/recorder/background-task';
import { t } from '../src/lib/i18n';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 2 } },
});

class StartupErrorBoundary extends Component<
  { children: ReactNode },
  { errorMessage: string | null }
> {
  override state = { errorMessage: null };

  static getDerivedStateFromError(error: Error) {
    return { errorMessage: error.message || 'unexpected_startup_error' };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[mobile-startup] unhandled error', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  override render() {
    if (!this.state.errorMessage) {
      return this.props.children;
    }

    return (
      <StudioScreen className="justify-center" edges={['top', 'left', 'right', 'bottom']}>
        <StudioPanel className="items-center gap-4 py-8">
          <Text className="text-xs uppercase tracking-[0.28em] text-mute">Startup guard</Text>
          <Text className="text-center text-2xl font-semibold text-text">
            Falha ao iniciar o app
          </Text>
          <Text className="text-center leading-6 text-mute">{this.state.errorMessage}</Text>
        </StudioPanel>
      </StudioScreen>
    );
  }
}

function AppNavigator() {
  const pathname = usePathname();
  const router = useRouter();
  const authReady = useAuthSession((state) => state.ready);
  const user = useAuthSession((state) => state.user);
  const isAuthRoute = pathname === '/auth' || pathname.startsWith('/auth/');

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
    registerBackgroundUploadTask().catch((error) => {
      console.warn('[bg] failed to register upload task', error);
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StartupErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="light" />
            <AppNavigator />
          </QueryClientProvider>
        </StartupErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
