import type { ExpoConfig } from 'expo/config';

const defaultApiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'https://anotes.web.app';
const defaultFirestoreDatabaseId = process.env.EXPO_PUBLIC_FIRESTORE_DATABASE_ID ?? 'anotes';
const defaultGoogleWebClientId =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  '143237037612-a95vks10tuuaeeab9ekpk0kf4mng06r2.apps.googleusercontent.com';
const defaultGoogleIosClientId =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ??
  '143237037612-hc8jrc15e2ibh2vgg5d6uj4a0j7ejb4l.apps.googleusercontent.com';
const localDebugGoogleAndroidClientId =
  '143237037612-etj2lbdph46vk6u58taa7hm329fv99sm.apps.googleusercontent.com';
const easBuildGoogleAndroidClientId =
  '143237037612-likp7uaelm375jjk2pfg4tpi19r0c91a.apps.googleusercontent.com';
const defaultGoogleAndroidClientId =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ??
  (process.env.EAS_BUILD_PROFILE ? easBuildGoogleAndroidClientId : localDebugGoogleAndroidClientId);
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? process.env.EAS_PROJECT_ID;

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
      backgroundColor: '#120d0a',
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
    'expo-localization',
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
    googleAndroidClientId: defaultGoogleAndroidClientId,
    googleIosClientId: defaultGoogleIosClientId,
    googleWebClientId: defaultGoogleWebClientId,
    firestoreDatabaseId: defaultFirestoreDatabaseId,
    apiUrl: defaultApiUrl,
    eas: { projectId: easProjectId ?? '8165ca3d-ee27-4eef-9417-9318f5464d12' },
  },
  runtimeVersion: { policy: 'appVersion' },
  updates: { url: `https://u.expo.dev/${easProjectId ?? '8165ca3d-ee27-4eef-9417-9318f5464d12'}` },
};

export default config;
