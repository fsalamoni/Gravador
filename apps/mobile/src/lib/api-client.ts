import Constants from 'expo-constants';
import { auth } from './firebase';

function normalizeBaseUrl(raw: string | undefined): string {
  const fallback = 'https://anotes.web.app';
  const value = raw?.trim() || fallback;
  return value.replace(/\/+$/, '');
}

export function getApiBaseUrl() {
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  return normalizeBaseUrl(extra?.apiUrl ?? process.env.EXPO_PUBLIC_API_URL);
}

export async function authedApiFetch(path: string, init: RequestInit = {}) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Usuário não autenticado no mobile.');
  }

  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return fetch(`${getApiBaseUrl()}${normalizedPath}`, {
    ...init,
    headers,
  });
}
