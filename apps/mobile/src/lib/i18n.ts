import type { Locale } from '@gravador/core';
import { type Messages, detectLocale, getMessages } from '@gravador/i18n';
import * as Localization from 'expo-localization';
import { create } from 'zustand';

interface I18nState {
  locale: Locale;
  messages: Messages;
  setLocale: (locale: Locale) => void;
}

function resolveInitialLocale(): Locale {
  try {
    const locales = Localization.getLocales();
    return detectLocale(locales[0]?.languageTag ?? 'pt-BR');
  } catch (error) {
    console.warn('[i18n] locale detection failed, using pt-BR fallback', error);
    return 'pt-BR';
  }
}

const initial: Locale = resolveInitialLocale();

export const useI18n = create<I18nState>((set) => ({
  locale: initial,
  messages: getMessages(initial),
  setLocale: (locale) => set({ locale, messages: getMessages(locale) }),
}));

export function t(path: string): string {
  try {
    const msgs = useI18n.getState().messages as unknown as Record<string, unknown>;
    const parts = path.split('.');
    let value: unknown = msgs;
    for (const p of parts) {
      if (value && typeof value === 'object' && p in (value as object)) {
        value = (value as Record<string, unknown>)[p];
      } else return path;
    }
    return typeof value === 'string' ? value : path;
  } catch (error) {
    console.warn('[i18n] translation lookup failed', { path, error });
    return path;
  }
}
