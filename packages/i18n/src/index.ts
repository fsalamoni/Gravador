import type { Locale } from '@gravador/core';
import en from './messages/en.json' with { type: 'json' };
import ptBR from './messages/pt-BR.json' with { type: 'json' };

export type Messages = typeof ptBR;

export const messages: Record<Locale, Messages> = {
  'pt-BR': ptBR,
  en,
};

export const defaultLocale: Locale = 'pt-BR';
export const supportedLocales: Locale[] = ['pt-BR', 'en'];

export function getMessages(locale: Locale): Messages {
  return messages[locale] ?? messages[defaultLocale];
}

export function detectLocale(input: string | null | undefined): Locale {
  if (!input) return defaultLocale;
  const lower = input.toLowerCase();
  if (lower.startsWith('pt')) return 'pt-BR';
  if (lower.startsWith('en')) return 'en';
  return defaultLocale;
}
