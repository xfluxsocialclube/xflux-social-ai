import { LOCALES, useI18n, type Locale } from '../i18n/I18nContext';

export function LanguageSelect() {
  const { locale, setLocale, t } = useI18n();
  return (
    <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} aria-label={t('common.language')}>
      {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
    </select>
  );
}
