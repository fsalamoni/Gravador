import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, initializeAuth } from 'firebase/auth';
// @ts-expect-error — getReactNativePersistence is exported in the react-native bundle but not in the default types
import { getReactNativePersistence } from 'firebase/auth';
import { type Firestore, initializeFirestore } from 'firebase/firestore';
import { type FirebaseStorage, getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey:
    (Constants.expoConfig?.extra?.firebaseApiKey as string | undefined) ??
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:
    (Constants.expoConfig?.extra?.firebaseAuthDomain as string | undefined) ??
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:
    (Constants.expoConfig?.extra?.firebaseProjectId as string | undefined) ??
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:
    (Constants.expoConfig?.extra?.firebaseStorageBucket as string | undefined) ??
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    (Constants.expoConfig?.extra?.firebaseMessagingSenderId as string | undefined) ??
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:
    (Constants.expoConfig?.extra?.firebaseAppId as string | undefined) ??
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn('[firebase] Missing EXPO_PUBLIC_FIREBASE_API_KEY / EXPO_PUBLIC_FIREBASE_PROJECT_ID');
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const auth: Auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Named database 'anotes' for isolation
const db: Firestore = initializeFirestore(app, {}, 'anotes');

const storage: FirebaseStorage = getStorage(app);

export { app, db, auth, storage };
