import 'server-only';

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
import { cookies } from 'next/headers';

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
    _app = initializeApp();
  }
  return _app;
}

export function getServerDb(): Firestore {
  return getFirestore(getAdminApp(), FIRESTORE_DATABASE_ID);
}

export function getServerAuth() {
  return getAuth(getAdminApp());
}

export function getServerStorage() {
  return getStorage(getAdminApp());
}

/**
 * Verify the Firebase session cookie and return the decoded token.
 * Returns null if no valid session cookie is found.
 */
export async function getSessionUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await getServerAuth().verifySessionCookie(sessionCookie, true);
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Get the current user's UID from the session cookie.
 * Returns null if not authenticated.
 */
export async function getSessionUserId(): Promise<string | null> {
  const user = await getSessionUser();
  return user?.uid ?? null;
}
