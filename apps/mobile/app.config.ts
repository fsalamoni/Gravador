import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Audio Notes Pro',
  slug: 'gravador',
  scheme: 'gravador',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'ai.gravador.app',
    buildNumber: '1',
    infoPlist: {
      NSMicrophoneUsageDescription:
        'Audio Notes Pro precisa acessar o microfone para capturar seus áudios.',
      NSLocationWhenInUseUsageDescription:
        'Opcional: anotar a localização aproximada das gravações.',
      UIBackgroundModes: ['audio', 'fetch', 'processing'],
      ITSAppUsesNonExemptEncryption: false,
    },
    entitlements: {
      'com.apple.security.application-groups': ['group.ai.gravador.shared'],
    },
  },
  android: {
    package: 'ai.gravador.app',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0b0e14',
    },
    permissions: [
      'RECORD_AUDIO',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_MICROPHONE',
      'POST_NOTIFICATIONS',
      'WAKE_LOCK',
      'ACCESS_COARSE_LOCATION',
    ],
  },
  plugins: [
    'expo-router',
    [
      'expo-audio',
      {
        microphonePermission: 'Permitir Audio Notes Pro acessar o microfone?',
      },
    ],
    [
      'expo-notifications',
      {
        color: '#7c5cff',
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission: 'Opcional: geotag das gravações.',
      },
    ],
    'expo-local-authentication',
    './plugins/quick-settings-tile',
    'expo-share-intent',
  ],
  experiments: {
    typedRoutes: true,
    tsconfigPaths: true,
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
  },
  runtimeVersion: { policy: 'appVersion' },
  updates: { url: 'https://u.expo.dev/replace-me' },
};

export default config;
