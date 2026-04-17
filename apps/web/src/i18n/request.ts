import type { Locale } from '@gravador/core';
import { defaultLocale, detectLocale, messages, supportedLocales } from '@gravador/i18n';
import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('locale')?.value as Locale | undefined;
  const acceptLang = (await headers()).get('accept-language');
  const locale: Locale =
    cookieLocale && supportedLocales.includes(cookieLocale)
      ? cookieLocale
      : detectLocale(acceptLang ?? undefined);
  return { locale, messages: messages[locale] ?? messages[defaultLocale] };
});
