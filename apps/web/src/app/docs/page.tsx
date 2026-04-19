import { ArrowUpRight, BookOpenText, FileText, Github, ServerCog } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

const references = [
  {
    key: 'deploy',
    href: 'https://github.com/fsalamoni/gravador/blob/main/docs/deploy-setup.md',
  },
  {
    key: 'selfHost',
    href: 'https://github.com/fsalamoni/gravador/blob/main/docs/self-host.en.md',
  },
  {
    key: 'credits',
    href: 'https://github.com/fsalamoni/gravador/blob/main/docs/credits.md',
  },
  {
    key: 'repo',
    href: 'https://github.com/fsalamoni/gravador',
  },
] as const;

export default async function DocsPage() {
  const t = await getTranslations();
  const icons = {
    deploy: ServerCog,
    selfHost: BookOpenText,
    credits: FileText,
    repo: Github,
  } as const;

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="ambient-shell card px-6 py-8 sm:px-8 sm:py-10 lg:px-10">
          <Link href="/" className="eyebrow">
            {t('nav.home')}
          </Link>
          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="display-title text-5xl leading-[0.94] sm:text-6xl">
                {t('docs.title')}
              </h1>
              <p className="mt-5 text-lg leading-8 text-mute">{t('docs.description')}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-border bg-bg/55 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-mute">Ops</div>
                <div className="mt-2 text-2xl font-semibold text-text">Deploy</div>
                <div className="mt-1 text-sm text-mute">Setup, rollback e rotas públicas</div>
              </div>
              <div className="rounded-[24px] border border-border bg-bg/55 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-mute">Source</div>
                <div className="mt-2 text-2xl font-semibold text-text">Open</div>
                <div className="mt-1 text-sm text-mute">Runbooks, créditos e repositório</div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {references.map((reference) => {
            const Icon = icons[reference.key];

            return (
              <a
                key={reference.key}
                href={reference.href}
                target="_blank"
                rel="noreferrer"
                className="card group p-6 transition hover:border-accent/70"
              >
                <Icon className="h-6 w-6 text-accent" />
                <p className="mt-5 text-xs uppercase tracking-[0.24em] text-mute">Reference</p>
                <h2 className="mt-3 text-3xl font-semibold text-text">
                  {t(`docs.${reference.key}Title`)}
                </h2>
                <p className="mt-4 leading-8 text-mute">{t(`docs.${reference.key}Body`)}</p>
                <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-surfaceAlt/70 px-4 py-2 text-sm font-semibold transition group-hover:text-text">
                  {t('docs.openCta')}
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </a>
            );
          })}
        </section>

        <section className="card flex flex-col gap-4 p-6 sm:p-7 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="display-title text-3xl">{t('nav.download')}</h2>
            <p className="mt-3 max-w-2xl leading-8 text-mute">{t('download.description')}</p>
          </div>
          <Link
            href="/download"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-onAccent transition hover:bg-accentSoft"
          >
            {t('docs.downloadCta')}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </main>
  );
}
