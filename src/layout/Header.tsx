import { Icon } from '../icons/Icon';
import { LanguageSelect } from '../components/LanguageSelect';
import { useI18n } from '../i18n/I18nContext';
import { NAV_ITEMS, type PageId } from '../config/nav';
import type { TranslationKey } from '../i18n/pt';

export function Header({ titleKey, currentPage, onNavigate, onMenu }: { titleKey: TranslationKey; currentPage: PageId; onNavigate: (page: PageId) => void; onMenu: () => void }) {
  const { t } = useI18n();
  const index = NAV_ITEMS.findIndex((item) => item.id === currentPage);
  const previous = NAV_ITEMS[index - 1];
  const next = NAV_ITEMS[index + 1];
  return (
    <header className="header">
      <button className="menu-btn" onClick={onMenu} aria-label={t('menu.open')}><Icon name="menu" /></button>
      <h1>{t(titleKey)}</h1>
      <nav className="header-navigation" aria-label={t('nav.quickNavigation')}>
        <button className="nav-step-btn" disabled={!previous} onClick={() => previous && onNavigate(previous.id)} aria-label={t('nav.previous')} title={t('nav.previous')}>
          <Icon name="back" /><span>{t('nav.previous')}</span>
        </button>
        <button className="nav-step-btn" onClick={() => onNavigate('overview')} aria-label={t('nav.home')} title={t('nav.home')}>
          <Icon name="home" /><span>{t('nav.home')}</span>
        </button>
        <button className="nav-step-btn" disabled={!next} onClick={() => next && onNavigate(next.id)} aria-label={t('nav.next')} title={t('nav.next')}>
          <span>{t('nav.next')}</span><Icon name="next" />
        </button>
      </nav>
      <LanguageSelect />
    </header>
  );
}
