import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Component, type ReactNode, useEffect } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../src/global.css';
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
            backgroundColor: '#f8fafc',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 32,
          }}
        >
          <ScrollView contentContainerStyle={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
              Erro ao iniciar o app
            </Text>
            <Text style={{ color: '#64748b', textAlign: 'center', lineHeight: 22, fontSize: 14 }}>
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
      <View
        style={{
          flex: 1,
          backgroundColor: '#f8fafc',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 30,
            borderWidth: 1,
            borderColor: '#cbd5e1',
            padding: 32,
            alignItems: 'center',
            width: '100%',
            gap: 16,
          }}
        >
          <View
            style={{
              height: 80,
              width: 80,
              borderRadius: 40,
              backgroundColor: 'rgba(59,130,246,0.12)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
          <Text
            style={{
              fontSize: 11,
              color: '#64748b',
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            Workspace boot
          </Text>
          <Text
            style={{ fontSize: 22, fontWeight: '600', color: '#0f172a', textAlign: 'center' }}
          >
            {t('auth.mobilePreparing')}
          </Text>
          <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22 }}>
            Restaurando sessão e preparando o app.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#f8fafc' },
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
            <StatusBar style="dark" />
            <AppNavigator />
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
