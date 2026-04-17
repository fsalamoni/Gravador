'use client';

import { supabase } from '@/lib/supabase-browser';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export default function LoginPage() {
  const t = useTranslations();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const callbackUrl =
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}/auth/callback?next=${encodeURIComponent('/workspace')}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl },
    });
    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm card p-8">
        <h1 className="text-2xl font-semibold mb-6">{t('auth.signIn')}</h1>
        {sent ? (
          <p className="text-mute">
            📬 Enviamos um link mágico para <span className="text-text">{email}</span>.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={loading}
              className="w-full border border-border rounded-lg py-3 font-medium hover:bg-surfaceAlt disabled:opacity-50"
            >
              {t('auth.continueWithGoogle')}
            </button>
            <div className="text-center text-xs uppercase tracking-[0.2em] text-mute">ou</div>
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
        )}
      </div>
    </main>
  );
}
