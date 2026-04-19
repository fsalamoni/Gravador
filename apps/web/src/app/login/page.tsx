'use client';

import { auth } from '@/lib/firebase-browser';
import {
  GoogleAuthProvider,
  type User,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { ArrowUpRight, AudioWaveform, ShieldCheck, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const POPUP_REDIRECT_ERROR_CODES = new Set([
  'auth/popup-blocked',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
]);

const MOBILE_USER_AGENT = /android|iphone|ipad|ipod|mobile/i;

function buildGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

function getSafeNextPath(rawPath: string | null) {
  if (!rawPath || !rawPath.startsWith('/')) return '/workspace';
  if (rawPath.startsWith('/login') || rawPath.startsWith('/signup')) return '/workspace';
  return rawPath;
}

function getErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return 'unknown';
  }

  if ('code' in error && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }

  if ('message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }

  return 'unknown';
}

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nextPath = getSafeNextPath(searchParams.get('next'));

  const getAuthErrorMessage = useCallback(
    (code: string) => {
      if (code === 'provider_not_allowed') return t('auth.googleRequiredError');
      if (code === 'auth/popup-closed-by-user') return t('auth.googlePopupClosed');
      if (code === 'auth/popup-blocked') return t('auth.googlePopupBlocked');
      if (code === 'auth/unauthorized-domain') return t('auth.googleUnauthorizedDomain');
      if (code === 'auth/operation-not-allowed') return t('auth.googleOperationNotAllowed');
      if (code === 'invalid_token' || code === 'session_failed') {
        return t('auth.googleSessionError');
      }
      return t('auth.googleGenericError');
    },
    [t],
  );

  const createServerSession = useCallback(async (user: User) => {
    const idToken = await user.getIdToken();
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (response.ok) return;

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    const errorCode = body?.error ?? 'session_failed';
    if (errorCode === 'provider_not_allowed') {
      await signOut(auth);
    }

    throw new Error(errorCode);
  }, []);

  useEffect(() => {
    let active = true;

    async function restoreGoogleSession() {
      setLoading(true);
      setError(null);

      try {
        const redirectResult = await getRedirectResult(auth);

        if (redirectResult?.user) {
          await createServerSession(redirectResult.user);
          router.replace(nextPath);
          return;
        }

        if (auth.currentUser) {
          await createServerSession(auth.currentUser);
          router.replace(nextPath);
          return;
        }
      } catch (err: unknown) {
        if (active) {
          setError(getAuthErrorMessage(getErrorCode(err)));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    restoreGoogleSession().catch(() => undefined);

    return () => {
      active = false;
    };
  }, [createServerSession, getAuthErrorMessage, nextPath, router]);

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    const provider = buildGoogleProvider();

    try {
      if (MOBILE_USER_AGENT.test(window.navigator.userAgent)) {
        await signInWithRedirect(auth, provider);
        return;
      }

      const result = await signInWithPopup(auth, provider);
      await createServerSession(result.user);
      router.replace(nextPath);
    } catch (err: unknown) {
      const errorCode = getErrorCode(err);

      if (POPUP_REDIRECT_ERROR_CODES.has(errorCode)) {
        await signInWithRedirect(auth, provider);
        return;
      }

      console.error('[login] Google sign-in failed:', errorCode, err);
      setError(getAuthErrorMessage(errorCode));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-5 lg:grid-cols-[1.02fr_0.98fr]">
        <section className="ambient-shell card relative overflow-hidden px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          <div className="soft-orb -left-10 top-16 h-36 w-36 bg-accent/25" />
          <div className="soft-orb right-8 top-28 h-28 w-28 bg-[#60d4c7]/12" />

          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-accent text-onAccent shadow-[0_14px_36px_var(--accent-shadow)]">
              <AudioWaveform className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-mute">Secure studio access</p>
              <div className="display-title text-3xl">Nexus</div>
            </div>
          </div>

          <div className="mt-10 max-w-2xl">
            <span className="eyebrow">{t('auth.googleOnly')}</span>
            <h1 className="display-title mt-6 text-5xl leading-[0.95] sm:text-6xl">
              Entre no workspace como quem entra numa cabine de controle.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-mute sm:text-lg">
              {t('auth.googleDescription')}
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[24px] border border-border bg-bg/55 p-4">
              <ShieldCheck className="h-5 w-5 text-ok" />
              <div className="mt-4 text-lg font-semibold text-text">Sessão segura</div>
              <p className="mt-2 text-sm leading-6 text-mute">
                Cookie do servidor e Google-only auth para manter o acesso consistente entre web e
                mobile.
              </p>
            </div>
            <div className="rounded-[24px] border border-border bg-bg/55 p-4">
              <Sparkles className="h-5 w-5 text-accent" />
              <div className="mt-4 text-lg font-semibold text-text">IA no centro</div>
              <p className="mt-2 text-sm leading-6 text-mute">
                Transcript, resumo, capítulos, mapa mental e busca entregues no mesmo fluxo.
              </p>
            </div>
            <div className="rounded-[24px] border border-border bg-bg/55 p-4">
              <ArrowUpRight className="h-5 w-5 text-accentSoft" />
              <div className="mt-4 text-lg font-semibold text-text">Backend ao vivo</div>
              <p className="mt-2 text-sm leading-6 text-mute">
                Firebase Auth, Firestore nomeado e Cloud Run já conectados ao domínio público.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-[26px] border border-border bg-surfaceAlt/70 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-mute">Flow</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-bg/55 px-4 py-3 text-sm text-text">
                1. Login Google
              </div>
              <div className="rounded-2xl bg-bg/55 px-4 py-3 text-sm text-text">
                2. Sessão do workspace
              </div>
              <div className="rounded-2xl bg-bg/55 px-4 py-3 text-sm text-text">
                3. Gravações e IA
              </div>
            </div>
          </div>
        </section>

        <section className="ambient-shell card flex items-center px-5 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-md">
            <div className="rounded-[28px] border border-border bg-bg/60 p-6 sm:p-7">
              <div className="text-xs uppercase tracking-[0.28em] text-mute">Google Auth</div>
              <h2 className="display-title mt-4 text-4xl">{t('auth.signIn')}</h2>
              <p className="mt-4 leading-7 text-mute">{t('auth.googleDescription')}</p>

              {error ? (
                <div className="mt-6 rounded-[22px] border border-danger/30 bg-danger/10 px-4 py-4 text-sm leading-6 text-danger">
                  {error}
                </div>
              ) : null}

              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={loading}
                className="mt-8 flex w-full items-center justify-center gap-3 rounded-[24px] bg-accent px-5 py-4 font-semibold text-onAccent transition hover:bg-accentSoft disabled:cursor-not-allowed disabled:opacity-70"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
                  <path
                    d="M21.81 10.04H12.2v3.92h5.5c-.24 1.27-.97 2.34-2.06 3.05v2.53h3.33c1.95-1.8 3.07-4.47 3.07-7.64 0-.64-.08-1.27-.23-1.86Z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12.2 22c2.78 0 5.11-.92 6.82-2.46l-3.33-2.53c-.93.63-2.12 1-3.49 1-2.68 0-4.96-1.8-5.78-4.23H3.01v2.61A10.31 10.31 0 0 0 12.2 22Z"
                    fill="#34A853"
                  />
                  <path
                    d="M6.42 13.78A6.2 6.2 0 0 1 6.09 12c0-.62.12-1.21.33-1.78V7.61H3.01A10.3 10.3 0 0 0 1.9 12c0 1.64.39 3.19 1.11 4.39l3.41-2.61Z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12.2 5.99c1.51 0 2.86.52 3.92 1.53l2.95-2.95C17.3 2.93 14.98 2 12.2 2A10.31 10.31 0 0 0 3.01 7.61l3.41 2.61c.82-2.43 3.1-4.23 5.78-4.23Z"
                    fill="#EA4335"
                  />
                </svg>
                <span>{loading ? t('auth.googleRedirecting') : t('auth.continueWithGoogle')}</span>
              </button>

              <div className="mt-6 rounded-[22px] border border-border bg-surfaceAlt/70 px-4 py-4 text-sm leading-6 text-mute">
                {t('auth.googleOnly')}. O mesmo login alimenta a sessão do workspace web e o acesso
                mobile.
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
