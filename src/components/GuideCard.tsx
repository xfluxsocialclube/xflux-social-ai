import { Progress } from './Progress';
import { useI18n } from '../i18n/I18nContext';
import { fmt } from '../i18n/format';
import type { TranslationKey } from '../i18n/pt';
import { useGuide } from '../pages/useGuide';
import type { PageId } from '../config/nav';

/** Resumo do guia do FLUX na Visão geral: mostra o andamento e leva à próxima etapa. */
export function GuideCard({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const { t } = useI18n(); const g = useGuide();
  if (!g.status) return null;
  const all = g.doneCount === g.total;
  return (
    <section className="card stack">
      <h2>{t('guide.cardTitle')}</h2>
      <p style={{ margin: 0 }}>{all ? t('guide.allDone') : g.state.paused ? t('guide.paused') : t(`guide.s${g.firstOpen + 1}.say` as TranslationKey)}</p>
      <div className="row"><div style={{ flex: 1, minWidth: 160 }}><Progress pct={(g.doneCount / g.total) * 100} /></div><small className="muted">{fmt(t('guide.of'), { n: g.doneCount, total: g.total })}</small></div>
      <div><button className="btn" onClick={() => onNavigate('guide')}>{all ? t('nav.guide') : t('guide.continue')}</button></div>
    </section>
  );
}
