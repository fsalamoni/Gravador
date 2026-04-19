import { ArrowUpRight, Download, FileText, Globe, Smartphone } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DownloadPage() {
  const t = await getTranslations();
  const androidPreviewUrl = process.env.ANDROID_PREVIEW_URL?.trim();
  const hasAndroidPreview = Boolean(androidPreviewUrl);

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="ambient-shell card overflow-hidden px-6 py-8 sm:px-8 sm:py-10 lg:px-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Link href="/" className="eyebrow">
                {t('nav.home')}
              </Link>
              <h1 className="display-title mt-6 text-5xl leading-[0.94] sm:text-6xl">
                {t('download.title')}
              </h1>
              <p className="mt-5 text-lg leading-8 text-mute">{t('download.description')}</p>
            </div>
            <div className="rounded-full border border-border bg-surfaceAlt/70 px-5 py-3 text-sm font-semibold text-mute">
              {hasAndroidPreview ? t('download.statusReady') : t('download.statusPending')}
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[24px] border border-border bg-bg/55 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-mute">Route</div>
              <div className="mt-2 text-2xl font-semibold text-text">Web + Android</div>
              <p className="mt-2 text-sm leading-6 text-mute">
                Acesso imediato no navegador e, quando disponível, download direto do APK.
              </p>
            </div>
            <div className="rounded-[24px] border border-border bg-bg/55 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-mute">Auth</div>
              <div className="mt-2 text-2xl font-semibold text-text">Google</div>
              <p className="mt-2 text-sm leading-6 text-mute">
                A mesma conta serve como ponte entre o mobile e o workspace web.
              </p>
            </div>
            <div className="rounded-[24px] border border-border bg-bg/55 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-mute">Release</div>
              <div className="mt-2 text-2xl font-semibold text-text">Ops-first</div>
              <p className="mt-2 text-sm leading-6 text-mute">
                Documentação pública, health check real e handoff operacional visível.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.9fr_0.9fr]">
          <article className="card p-6 sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-mute">Android</p>
                <h2 className="mt-3 text-3xl font-semibold text-text">
                  {t('download.androidTitle')}
                </h2>
              </div>
              <Smartphone className="h-6 w-6 text-accent" />
            </div>
            <p className="mt-4 max-w-2xl leading-8 text-mute">
              {hasAndroidPreview
                ? t('download.androidReadyBody')
                : t('download.androidPendingBody')}
            </p>
            {hasAndroidPreview ? (
              <a
                href={androidPreviewUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-onAccent transition hover:bg-accentSoft"
              >
                <Download className="h-4 w-4" />
                {t('download.androidCta')}
              </a>
            ) : (
              <Link
                href="/docs"
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-surfaceAlt/70 px-6 py-3 font-semibold transition hover:text-text"
              >
                <FileText className="h-4 w-4" />
                {t('download.androidPendingCta')}
              </Link>
            )}
            <div className="mt-6 rounded-[24px] border border-border bg-bg/55 px-4 py-4 text-sm leading-6 text-mute">
              {t('download.androidInstallHint')}
            </div>
          </article>

          <article className="card p-6">
            <Globe className="h-6 w-6 text-[#8be3d7]" />
            <p className="mt-4 text-xs uppercase tracking-[0.24em] text-mute">Web</p>
            <h2 className="mt-3 text-2xl font-semibold text-text">{t('download.webTitle')}</h2>
            <p className="mt-4 leading-7 text-mute">{t('download.webBody')}</p>
            <Link
              href="/login?next=/workspace"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-surfaceAlt/70 px-5 py-3 font-semibold transition hover:text-text"
            >
              {t('download.webCta')}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </article>

          <article className="card p-6">
            <FileText className="h-6 w-6 text-accentSoft" />
            <p className="mt-4 text-xs uppercase tracking-[0.24em] text-mute">Docs</p>
            <h2 className="mt-3 text-2xl font-semibold text-text">{t('download.docsTitle')}</h2>
            <p className="mt-4 leading-7 text-mute">{t('download.docsBody')}</p>
            <Link
              href="/docs"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-surfaceAlt/70 px-5 py-3 font-semibold transition hover:text-text"
            >
              {t('download.docsCta')}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </article>
        </section>

        <article className="card p-6 sm:p-7">
          <p className="text-xs uppercase tracking-[0.24em] text-mute">iOS</p>
          <h2 className="mt-3 text-3xl font-semibold text-text">{t('download.iosTitle')}</h2>
          <p className="mt-4 max-w-3xl leading-8 text-mute">{t('download.iosBody')}</p>
        </article>
      </div>
    </main>
  );
}
