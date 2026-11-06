import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { pt, type Dictionary, type TranslationKey } from './pt';
import { en } from './en';
import { es } from './es';
import { loadSetting, saveSetting } from '../services/settings';

export type Locale = 'pt-BR' | 'en' | 'es';
export const LOCALES: { code: Locale; label: string }[] = [
  { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];
const dictionaries: Record<Locale, Dictionary> = { 'pt-BR': pt, en, es };

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey) => string;
}
const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = loadSetting<Locale>('locale', 'pt-BR');
    return saved in dictionaries ? saved : 'pt-BR';
  });
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    saveSetting('locale', l);
    document.documentElement.lang = l;
  }, []);
  const t = useCallback((key: TranslationKey) => dictionaries[locale][key] ?? pt[key], [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n deve ser usado dentro de I18nProvider');
  return ctx;
}
