import { Icon } from '../icons/Icon';
import { LanguageSelect } from '../components/LanguageSelect';
import { useI18n } from '../i18n/I18nContext';
import type { TranslationKey } from '../i18n/pt';

export function Header({ titleKey, onMenu }: { titleKey: TranslationKey; onMenu: () => void }) {
  const { t } = useI18n();
  return (
    <header className="header">
      <button className="menu-btn" onClick={onMenu} aria-label={t('menu.open')}><Icon name="menu" /></button>
      <h1>{t(titleKey)}</h1>
      <LanguageSelect />
    </header>
  );
}
