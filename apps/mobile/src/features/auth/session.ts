import { type User, onAuthStateChanged } from 'firebase/auth';
import { useEffect } from 'react';
import { create } from 'zustand';
import { auth } from '../../lib/firebase';

const AUTH_BOOT_TIMEOUT_MS = 5000;

interface AuthSessionState {
  ready: boolean;
  user: User | null;
  setAuthState: (user: User | null) => void;
}

export const useAuthSession = create<AuthSessionState>((set) => ({
  ready: false,
  user: auth.currentUser,
  setAuthState: (user) => set({ ready: true, user }),
}));

export function useSyncAuthSession() {
  const setAuthState = useAuthSession((state) => state.setAuthState);

  useEffect(() => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn('[auth] onAuthStateChanged timeout fallback applied');
      setAuthState(auth.currentUser ?? null);
    }, AUTH_BOOT_TIMEOUT_MS);

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        setAuthState(user);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        console.error('[auth] failed to restore session', error);
        setAuthState(auth.currentUser ?? null);
      },
    );

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [setAuthState]);
}
