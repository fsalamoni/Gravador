import {
  type App,
  type ServiceAccount,
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { type Firestore, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID ?? 'anotes';

let _app: App | undefined;

function getAdminAppOptions() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GCLOUD_PROJECT;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  return {
    ...(projectId ? { projectId } : {}),
    ...(storageBucket ? { storageBucket } : {}),
  };
}

/**
 * Get or initialize the Firebase Admin app (singleton).
 * Uses FIREBASE_SERVICE_ACCOUNT_KEY env var (JSON string) or
 * GOOGLE_APPLICATION_CREDENTIALS file path for auth.
 */
function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApp();
    return _app;
  }

  const appOptions = getAdminAppOptions();
  const keyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (keyJson) {
    const serviceAccount = JSON.parse(keyJson) as ServiceAccount;
    _app = initializeApp({ ...appOptions, credential: cert(serviceAccount) });
  } else if (Object.keys(appOptions).length > 0) {
    _app = initializeApp({ ...appOptions, credential: applicationDefault() });
  } else {
    // Falls back to GOOGLE_APPLICATION_CREDENTIALS or default credentials
    _app = initializeApp();
  }
  return _app;
}

/**
 * Get the Firestore instance for the dedicated `anotes` named database.
 * All Gravador data lives here, isolated from other apps in the project.
 */
export function getDb(): Firestore {
  return getFirestore(getAdminApp(), FIRESTORE_DATABASE_ID);
}

/**
 * Get the Firebase Admin Auth instance.
 */
export function getAdminAuth() {
  return getAuth(getAdminApp());
}

/**
 * Get the Firebase Admin Storage instance.
 */
export function getAdminStorage() {
  return getStorage(getAdminApp());
}

/**
 * Re-export for convenience.
 */
export { getAdminApp };
