import 'server-only';

import {
  type App,
  type ServiceAccount,
  cert,
  getApp,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { type Firestore, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { cookies } from 'next/headers';

const FIRESTORE_DATABASE = 'anotes';

let _app: App | undefined;

function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApp();
    return _app;
  }

  const keyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (keyJson) {
    const serviceAccount = JSON.parse(keyJson) as ServiceAccount;
    _app = initializeApp({ credential: cert(serviceAccount) });
  } else {
    _app = initializeApp();
  }
  return _app;
}

export function getServerDb(): Firestore {
  return getFirestore(getAdminApp(), FIRESTORE_DATABASE);
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
