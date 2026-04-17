'use client';

import { auth } from '@/lib/firebase-browser';
import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
} from 'firebase/auth';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Handle email link sign-in callback
  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const savedEmail = window.localStorage.getItem('emailForSignIn') ?? '';
      if (savedEmail) {
        signInWithEmailLink(auth, savedEmail, window.location.href)
          .then(async (result) => {
            window.localStorage.removeItem('emailForSignIn');
            const idToken = await result.user.getIdToken();
            await fetch('/api/auth/session', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ idToken }),
            });
            router.push(searchParams.get('next') ?? '/workspace');
          })
          .catch((err) => setError(err.message));
      }
    }
  }, [router, searchParams]);

  const submitMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await sendSignInLinkToEmail(auth, email, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true,
      });
      window.localStorage.setItem('emailForSignIn', email);
      setSent(true);
    } catch (err: unknown) {
      setError((err as Error).message);
    }
    setLoading(false);
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      router.push(searchParams.get('next') ?? '/workspace');
    } catch (err: unknown) {
      setError((err as Error).message);
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm card p-8">
        <h1 className="text-2xl font-semibold mb-6">{t('auth.signIn')}</h1>
        {sent ? (
          <p className="text-mute">
            Enviamos um link para <span className="text-text">{email}</span>. Verifique sua caixa de
            entrada.
          </p>
        ) : (
          <>
            <form onSubmit={submitMagicLink} className="space-y-4">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.email')}
                className="w-full bg-surfaceAlt border border-border rounded-lg px-4 py-3 outline-none focus:border-accent"
              />
              {error ? <p className="text-danger text-sm">{error}</p> : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent text-white rounded-lg py-3 font-medium hover:bg-accentSoft disabled:opacity-50"
              >
                {t('auth.magicLink')}
              </button>
            </form>
            <div className="my-4 flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-mute text-xs">ou</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={loading}
              className="w-full border border-border rounded-lg py-3 font-medium hover:bg-surfaceAlt disabled:opacity-50"
            >
              Entrar com Google
            </button>
          </>
        )}
      </div>
    </main>
  );
}
