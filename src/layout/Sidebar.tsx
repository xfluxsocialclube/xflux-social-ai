import { NAV_ITEMS, type PageId } from '../config/nav';
import { Icon } from '../icons/Icon';
import { useI18n } from '../i18n/I18nContext';

interface Props { current: PageId; onNavigate: (p: PageId) => void; open: boolean; alerts?: PageId[]; }

export function Sidebar({ current, onNavigate, open, alerts = [] }: Props) {
  const { t } = useI18n();
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <div className="brand-logo">X</div>
        <div><strong>XFLUX</strong><small>Social AI</small></div>
      </div>
      <nav>
        {NAV_ITEMS.map((item) => (
          <button key={item.id} className={`nav-item ${current === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id)} aria-current={current === item.id ? 'page' : undefined}>
            <Icon name={item.id} /><span>{t(item.labelKey)}</span>{alerts.includes(item.id) && <i className="nav-alert" aria-hidden="true" />}
          </button>
        ))}
      </nav>
      <p className="slogan">{t('app.slogan')}</p>
    </aside>
  );
}
