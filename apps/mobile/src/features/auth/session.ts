import { type User, onAuthStateChanged } from 'firebase/auth';
import { useEffect } from 'react';
import { create } from 'zustand';
import { auth } from '../../lib/firebase';

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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthState(user);
    });

    return unsubscribe;
  }, [setAuthState]);
}
