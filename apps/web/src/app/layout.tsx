import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { cookies } from 'next/headers';
import './globals.css';
import { ThemeProvider } from './theme-provider';

export const metadata: Metadata = {
  title: 'Gravador',
  description: 'Grave, transcreva, transforme em conhecimento. Open-source AI audio workspace.',
  applicationName: 'Gravador',
  manifest: '/manifest.webmanifest',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const cookieStore = await cookies();
  const theme = cookieStore.get('theme')?.value ?? 'light';
  return (
    <html lang={locale} className={theme === 'dark' ? 'dark' : ''} suppressHydrationWarning>
      <body className="bg-bg text-text min-h-screen font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider initialTheme={theme as 'light' | 'dark'}>
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
