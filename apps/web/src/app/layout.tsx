import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://anotes.web.app';
const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});
const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Gravador',
    template: '%s | Gravador',
  },
  description:
    'Grave no celular, processe com IA e entregue tudo no workspace web. Download Android de teste e acesso web em um unico hub.',
  applicationName: 'Gravador',
  manifest: '/manifest.webmanifest',
  alternates: {
    canonical: '/',
  },
  keywords: ['Gravador', 'audio workspace', 'AI notes', 'voice recorder', 'transcription'],
  openGraph: {
    title: 'Gravador',
    description:
      'Grave no celular, processe com IA e acesse transcript, resumo, acoes e busca sem sair do navegador.',
    url: appUrl,
    siteName: 'Gravador',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Gravador',
    description:
      'Open-source AI audio workspace com download Android de teste e workspace web ao vivo.',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Gravador',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={`dark ${sans.variable} ${display.variable}`}>
      <body className="min-h-screen bg-bg font-sans text-text antialiased">
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
