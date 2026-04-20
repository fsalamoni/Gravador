import { ThemeProvider } from '@/components/theme-provider';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google';
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
    default: 'Nexus',
    template: '%s | Nexus',
  },
  description:
    'Grave no celular, processe com IA e entregue tudo no workspace web. Download Android de teste e acesso web em um unico hub.',
  applicationName: 'Nexus',
  manifest: '/manifest.webmanifest',
  alternates: {
    canonical: '/',
  },
  keywords: ['Nexus', 'audio workspace', 'AI notes', 'voice recorder', 'transcription'],
  openGraph: {
    title: 'Nexus',
    description:
      'Grave no celular, processe com IA e acesse transcript, resumo, acoes e busca sem sair do navegador.',
    url: appUrl,
    siteName: 'Nexus',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Nexus',
    description:
      'Open-source AI audio workspace com download Android de teste e workspace web ao vivo.',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Nexus',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  // Inline script runs before React hydrates to apply the persisted theme, avoiding
  // flash-of-wrong-theme. Defaults to "claro" when no preference is stored.
  const themeBootstrap = `
(function(){try{var t=localStorage.getItem('nexus-theme');var v=['claro','terra','oceano','floresta','noite','aurora','artico','vulcao','solaris'];if(!t||v.indexOf(t)===-1){t='claro';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','claro');}})();
`;
  return (
    <html lang={locale} data-theme="claro" className={`${sans.variable} ${display.variable}`}>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: inline theme bootstrap to avoid FOUC */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
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
