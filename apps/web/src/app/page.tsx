import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function LandingPage() {
  const t = await getTranslations();
  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between border-b border-border">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          {t('app.name')}
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/login" className="text-mute hover:text-text">
            {t('auth.signIn')}
          </Link>
          <Link
            href="/signup"
            className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accentSoft"
          >
            {t('auth.signUp')}
          </Link>
        </nav>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tight max-w-4xl">
          {t('app.tagline')}
        </h1>
        <p className="text-mute mt-6 max-w-2xl">
          Open-source AI audio workspace — grave do bolso, trabalhe no desktop. Resumos, mapas
          mentais, ações e chat com qualquer gravação.
        </p>
        <div className="mt-10 flex gap-4">
          <Link
            href="/signup"
            className="bg-accent text-white px-6 py-3 rounded-xl font-medium hover:bg-accentSoft"
          >
            Começar grátis
          </Link>
          <Link
            href="https://github.com/fsalamoni/gravador"
            className="border border-border px-6 py-3 rounded-xl font-medium hover:bg-surface"
          >
            GitHub
          </Link>
        </div>
      </section>

      <footer className="px-8 py-6 border-t border-border text-sm text-mute flex justify-between">
        <span>© 2026 Audio Notes Pro · AGPL-3.0</span>
        <span>
          <Link href="/docs" className="hover:text-text">
            Docs
          </Link>
        </span>
      </footer>
    </main>
  );
}
