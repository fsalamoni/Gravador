import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, getAuth, initializeAuth } from 'firebase/auth';
// @ts-expect-error — getReactNativePersistence is exported in the react-native bundle but not in the default types
import { getReactNativePersistence } from 'firebase/auth';
import { type Firestore, getFirestore, initializeFirestore } from 'firebase/firestore';
import { type FirebaseStorage, getStorage } from 'firebase/storage';

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDFV2iOMhhg3EAwQ6J72Zpx2kfe4WyDLLw',
  authDomain: 'hocapp-44760.firebaseapp.com',
  projectId: 'hocapp-44760',
  storageBucket: 'hocapp-44760.firebasestorage.app',
  messagingSenderId: '143237037612',
  appId: '1:143237037612:web:847190a1071da92c031b89',
} as const;

type FirebaseSingletonCache = {
  __gravadorAuth?: Auth;
  __gravadorDb?: Firestore;
  __gravadorStorage?: FirebaseStorage;
};

const firebaseConfig = {
  apiKey:
    (Constants.expoConfig?.extra?.firebaseApiKey as string | undefined) ??
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ??
    DEFAULT_FIREBASE_CONFIG.apiKey,
  authDomain:
    (Constants.expoConfig?.extra?.firebaseAuthDomain as string | undefined) ??
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    DEFAULT_FIREBASE_CONFIG.authDomain,
  projectId:
    (Constants.expoConfig?.extra?.firebaseProjectId as string | undefined) ??
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ??
    DEFAULT_FIREBASE_CONFIG.projectId,
  storageBucket:
    (Constants.expoConfig?.extra?.firebaseStorageBucket as string | undefined) ??
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    DEFAULT_FIREBASE_CONFIG.storageBucket,
  messagingSenderId:
    (Constants.expoConfig?.extra?.firebaseMessagingSenderId as string | undefined) ??
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??
    DEFAULT_FIREBASE_CONFIG.messagingSenderId,
  appId:
    (Constants.expoConfig?.extra?.firebaseAppId as string | undefined) ??
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID ??
    DEFAULT_FIREBASE_CONFIG.appId,
};

const firestoreDatabaseId =
  (Constants.expoConfig?.extra?.firestoreDatabaseId as string | undefined) ??
  process.env.EXPO_PUBLIC_FIRESTORE_DATABASE_ID ??
  'anotes';

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingKeys.length > 0) {
  throw new Error(`[firebase] Missing required config keys: ${missingKeys.join(', ')}`);
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const globalCache = globalThis as typeof globalThis & FirebaseSingletonCache;

if (!globalCache.__gravadorAuth) {
  try {
    globalCache.__gravadorAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    console.warn('[firebase] reusing existing auth instance', error);
    globalCache.__gravadorAuth = getAuth(app);
  }
}

if (!globalCache.__gravadorDb) {
  try {
    globalCache.__gravadorDb = initializeFirestore(app, {}, firestoreDatabaseId);
  } catch (error) {
    console.warn('[firebase] reusing existing firestore instance', error);
    globalCache.__gravadorDb = getFirestore(app, firestoreDatabaseId);
  }
}

if (!globalCache.__gravadorStorage) {
  globalCache.__gravadorStorage = getStorage(app);
}

const auth: Auth = globalCache.__gravadorAuth;
const db: Firestore = globalCache.__gravadorDb;
const storage: FirebaseStorage = globalCache.__gravadorStorage;

export { app, db, auth, storage };
