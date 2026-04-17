import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Gravador',
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
        'Gravador precisa acessar o microfone para capturar seus áudios.',
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
        microphonePermission: 'Permitir Gravador acessar o microfone?',
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
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
  },
  runtimeVersion: { policy: 'appVersion' },
  updates: { url: 'https://u.expo.dev/replace-me' },
};

export default config;
