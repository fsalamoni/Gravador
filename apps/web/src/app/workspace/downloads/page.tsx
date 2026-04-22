import { DownloadQRSection } from '@/app/download/download-qr-section';
import { featureFlags } from '@/lib/feature-flags';
import { ArrowUpRight, Download, FileText, Smartphone } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function WorkspaceDownloadsPage() {
  if (!featureFlags.workspaceDownloads) {
    redirect('/workspace/settings');
  }

  const t = await getTranslations();
  const androidPreviewUrl = process.env.ANDROID_PREVIEW_URL?.trim() ?? null;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://gravador.app';
  const hasAndroidPreview = Boolean(androidPreviewUrl);

  return (
    <div className="space-y-5">
      <section className="ambient-shell card overflow-hidden px-6 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="eyebrow">Workspace</p>
            <h1 className="display-title mt-5 text-5xl leading-[0.94] sm:text-6xl">
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
            <Smartphone className="h-5 w-5 text-accent" />
            <div className="mt-3 text-lg font-semibold text-text">Android APK</div>
            <p className="mt-2 text-sm leading-6 text-mute">
              Distribuicao interna com QR code para instalar direto no dispositivo.
            </p>
          </div>
          <div className="rounded-[24px] border border-border bg-bg/55 p-4">
            <FileText className="h-5 w-5 text-[#8be3d7]" />
            <div className="mt-3 text-lg font-semibold text-text">Runbook</div>
            <p className="mt-2 text-sm leading-6 text-mute">
              Checklist de release mobile/web e validacao operacional centralizada.
            </p>
          </div>
          <div className="rounded-[24px] border border-border bg-bg/55 p-4">
            <ArrowUpRight className="h-5 w-5 text-accentSoft" />
            <div className="mt-3 text-lg font-semibold text-text">Web fallback</div>
            <p className="mt-2 text-sm leading-6 text-mute">
              Caso o APK esteja pendente, o workspace web continua como caminho oficial.
            </p>
          </div>
        </div>
      </section>

      <DownloadQRSection androidUrl={androidPreviewUrl} webAppUrl={baseUrl} />

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card p-6 sm:p-7">
          <p className="text-xs uppercase tracking-[0.24em] text-mute">Android</p>
          <h2 className="mt-3 text-3xl font-semibold text-text">{t('download.androidTitle')}</h2>
          <p className="mt-4 leading-8 text-mute">
            {hasAndroidPreview ? t('download.androidReadyBody') : t('download.androidPendingBody')}
          </p>
          {hasAndroidPreview ? (
            <a
              href={androidPreviewUrl ?? '#'}
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
        </article>

        <article className="card p-6 sm:p-7">
          <p className="text-xs uppercase tracking-[0.24em] text-mute">Release docs</p>
          <h2 className="mt-3 text-3xl font-semibold text-text">{t('download.docsTitle')}</h2>
          <p className="mt-4 leading-8 text-mute">{t('download.docsBody')}</p>
          <Link
            href="/docs"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-surfaceAlt/70 px-6 py-3 font-semibold transition hover:text-text"
          >
            {t('download.docsCta')}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </article>
      </section>
    </div>
  );
}
