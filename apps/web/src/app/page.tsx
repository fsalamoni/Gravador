import { ArrowUpRight, AudioWaveform, Mic, ShieldCheck, Sparkles } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function LandingPage() {
  const t = await getTranslations();
  return (
    <main className="min-h-screen px-4 pb-8 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="ambient-shell card flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-[#120d0a] shadow-[0_12px_32px_rgba(243,138,55,0.35)]">
              <AudioWaveform className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-mute">
                Studio-grade notes
              </p>
              <div className="display-title text-2xl">{t('app.name')}</div>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-2 text-sm sm:gap-3">
            <Link
              href="/download"
              className="rounded-full border border-border bg-surfaceAlt/60 px-4 py-2 text-mute transition hover:text-text"
            >
              {t('nav.download')}
            </Link>
            <Link
              href="/docs"
              className="rounded-full border border-border bg-surfaceAlt/60 px-4 py-2 text-mute transition hover:text-text"
            >
              {t('nav.docs')}
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-border bg-surfaceAlt/60 px-4 py-2 text-mute transition hover:text-text"
            >
              {t('auth.signIn')}
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 font-semibold text-[#120d0a] transition hover:bg-accentSoft"
            >
              {t('auth.continueWithGoogle')}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </nav>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.02fr_0.98fr] lg:items-end">
          <div className="ambient-shell card overflow-hidden px-6 py-8 sm:px-8 sm:py-10 lg:min-h-[680px] lg:px-10 lg:py-12">
            <div className="soft-orb -left-10 top-10 h-32 w-32 bg-accent/25" />
            <div className="soft-orb right-10 top-24 h-28 w-28 bg-[#60d4c7]/10" />

            <span className="eyebrow">{t('landing.eyebrow')}</span>
            <h1 className="display-title mt-6 max-w-4xl text-5xl leading-[0.92] sm:text-6xl lg:text-7xl">
              {t('app.tagline')}
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-mute sm:text-lg">
              {t('landing.description')}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-[#120d0a] transition hover:bg-accentSoft"
              >
                {t('auth.continueWithGoogle')}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link
                href="/download"
                className="rounded-full border border-border bg-surfaceAlt/70 px-6 py-3 text-sm font-semibold transition hover:text-text"
              >
                {t('landing.downloadCta')}
              </Link>
              <a
                href="https://github.com/fsalamoni/gravador"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-border bg-surfaceAlt/70 px-6 py-3 text-sm font-semibold transition hover:text-text"
              >
                {t('landing.githubCta')}
              </a>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-border bg-[#100c09]/55 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-mute">Backend</div>
                <div className="mt-2 text-3xl font-semibold text-text">Live</div>
                <div className="mt-1 text-sm text-mute">Firebase + Cloud Run</div>
              </div>
              <div className="rounded-[24px] border border-border bg-[#100c09]/55 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-mute">Access</div>
                <div className="mt-2 text-3xl font-semibold text-text">Google</div>
                <div className="mt-1 text-sm text-mute">Auth-only workspace</div>
              </div>
              <div className="rounded-[24px] border border-border bg-[#100c09]/55 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-mute">Delivery</div>
                <div className="mt-2 text-3xl font-semibold text-text">Web + APK</div>
                <div className="mt-1 text-sm text-mute">Hub de acesso e teste</div>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-3 rounded-[24px] border border-border bg-surfaceAlt/65 px-4 py-4 text-sm text-mute">
              <ShieldCheck className="h-5 w-5 text-ok" />
              <span>{t('landing.mobileStatus')}</span>
            </div>
          </div>

          <div className="grid gap-5">
            <div className="ambient-shell card overflow-hidden p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-mute">
                    Workspace preview
                  </div>
                  <h2 className="display-title mt-2 text-3xl">
                    Uma mesa de controle, não um arquivo solto.
                  </h2>
                </div>
                <Sparkles className="h-6 w-6 text-accent" />
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
                <div className="rounded-[24px] border border-border bg-[#100c09]/60 p-4">
                  <div className="flex items-center justify-between text-sm text-mute">
                    <span>Recent capture</span>
                    <Mic className="h-4 w-4 text-accent" />
                  </div>
                  <div className="mt-4 rounded-[20px] border border-border bg-surfaceAlt/75 p-4">
                    <div className="text-sm font-medium text-text">Reunião de produto</div>
                    <div className="mt-2 flex gap-2 text-xs text-mute">
                      <span className="rounded-full border border-border px-2 py-1">47 min</span>
                      <span className="rounded-full border border-border px-2 py-1">pt-BR</span>
                    </div>
                    <div className="mt-4 flex h-28 items-end gap-1">
                      {[
                        ['bar-1', 18],
                        ['bar-2', 24],
                        ['bar-3', 42],
                        ['bar-4', 56],
                        ['bar-5', 48],
                        ['bar-6', 64],
                        ['bar-7', 36],
                        ['bar-8', 52],
                        ['bar-9', 70],
                        ['bar-10', 44],
                        ['bar-11', 28],
                        ['bar-12', 18],
                      ].map(([barId, height]) => (
                        <span
                          key={barId}
                          className="flex-1 rounded-full bg-accent/75"
                          style={{ height }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[24px] border border-border bg-surfaceAlt/75 p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-mute">Summary</div>
                    <div className="mt-3 space-y-2 text-sm leading-7 text-mute">
                      <p>
                        A equipe alinhou o roadmap, destravou a dependência de autenticação e
                        priorizou a distribuição Android.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-accent/15 px-3 py-1 text-xs text-accent">
                          Action items
                        </span>
                        <span className="rounded-full bg-[#60d4c7]/12 px-3 py-1 text-xs text-[#8be3d7]">
                          Search
                        </span>
                        <span className="rounded-full bg-white/6 px-3 py-1 text-xs text-text">
                          Mind map
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[24px] border border-border bg-[#100c09]/60 p-4">
                      <div className="text-xs uppercase tracking-[0.24em] text-mute">Pipeline</div>
                      <div className="mt-3 space-y-2 text-sm text-mute">
                        <div className="rounded-2xl bg-surfaceAlt/75 px-3 py-2 text-text">
                          Transcript ready
                        </div>
                        <div className="rounded-2xl bg-surfaceAlt/75 px-3 py-2">
                          Action items extracted
                        </div>
                        <div className="rounded-2xl bg-surfaceAlt/75 px-3 py-2">
                          Shareable in browser
                        </div>
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-border bg-[#100c09]/60 p-4">
                      <div className="text-xs uppercase tracking-[0.24em] text-mute">
                        Capture modes
                      </div>
                      <div className="mt-3 space-y-3 text-sm text-mute">
                        <div className="flex items-center justify-between rounded-2xl bg-surfaceAlt/75 px-3 py-2">
                          <span>Meeting</span>
                          <span className="text-ok">AI on</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-surfaceAlt/75 px-3 py-2">
                          <span>Voice memo</span>
                          <span className="text-accent">Fast</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-surfaceAlt/75 px-3 py-2">
                          <span>Call recap</span>
                          <span className="text-accentSoft">Sync</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <article className="card p-6 text-left">
                <p className="text-xs uppercase tracking-[0.24em] text-mute">
                  {t('landing.captureLabel')}
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-text">
                  {t('landing.captureTitle')}
                </h2>
                <p className="mt-3 leading-7 text-mute">{t('landing.captureBody')}</p>
              </article>
              <article className="card p-6 text-left">
                <p className="text-xs uppercase tracking-[0.24em] text-mute">
                  {t('landing.aiLabel')}
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-text">{t('landing.aiTitle')}</h2>
                <p className="mt-3 leading-7 text-mute">{t('landing.aiBody')}</p>
              </article>
              <article className="card p-6 text-left">
                <p className="text-xs uppercase tracking-[0.24em] text-mute">
                  {t('landing.syncLabel')}
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-text">{t('landing.syncTitle')}</h2>
                <p className="mt-3 leading-7 text-mute">{t('landing.syncBody')}</p>
              </article>
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 px-2 py-2 text-sm text-mute sm:px-3">
          <span>© 2026 Gravador · AGPL-3.0</span>
          <div className="flex items-center gap-4">
            <Link href="/download" className="transition hover:text-text">
              {t('nav.download')}
            </Link>
            <Link href="/docs" className="transition hover:text-text">
              {t('nav.docs')}
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
