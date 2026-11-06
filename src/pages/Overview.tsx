import { StatCard } from '../components/StatCard';
import { Notice } from '../components/Notice';
import { EmptyState } from '../components/EmptyState';
import { FluxMascot } from '../components/FluxMascot';
import { DEMO_NEXT, DEMO_STATS, DEMO_WEEK } from '../data/demo';
import { GuideCard } from '../components/GuideCard';
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { fmt } from '../i18n/format';
import { cycleAlert, type CycleAlert } from '../services/planner/guide';
import type { PageId } from '../config/nav';
import type { TranslationKey } from '../i18n/pt';

export function Overview({ showMascot, onHideMascot, onNavigate }: { showMascot: boolean; onHideMascot: () => void; onNavigate: (p: PageId) => void }) {
  const { t } = useI18n();
  const [alert, setAlert] = useState<CycleAlert | null>(null);
  useEffect(() => { cycleAlert().then(setAlert).catch(() => setAlert(null)); }, []);
  const max = Math.max(...DEMO_WEEK);
  const ex = t('common.example');
  const status: [TranslationKey, TranslationKey, boolean][] = [
    ['st.ui', 'st.uiOk', true], ['st.backend', 'st.backendNo', false],
    ['st.db', 'st.dbNo', false], ['st.integrations', 'st.integrationsNo', false],
  ];
  return (
    <div className="stack">
      {showMascot && (
        <section className="card welcome">
          <FluxMascot />
          <div className="welcome-text">
            <p className="bubble">{t('flux.greeting')}</p>
            <small className="muted">{t('flux.tip')}</small>
            <div><button className="btn ghost" onClick={onHideMascot}>{t('flux.hide')}</button></div>
          </div>
        </section>
      )}
      {alert && <Notice tone="warn">{alert.summary.ended ? t('ap.alertEnded') : fmt(t('ap.alertSoon'), { n: alert.summary.daysLeft })} <button className="link" onClick={() => onNavigate('autopilot')}><u>{t('nav.autopilot')}</u></button></Notice>}
      <GuideCard onNavigate={onNavigate} />
      <Notice tone="warn">{t('ov.demoNotice')}</Notice>
      <section className="grid stats">
        <StatCard label={t('ov.published')} value={DEMO_STATS.published} tag={ex} />
        <StatCard label={t('ov.scheduled')} value={DEMO_STATS.scheduled} tag={ex} />
        <StatCard label={t('ov.errors')} value={DEMO_STATS.errors} tag={ex} />
        <StatCard label={t('ov.connected')} value={0} />
        <StatCard label={t('ov.videos')} value={DEMO_STATS.videos} tag={ex} />
      </section>
      <section className="grid two">
        <div className="card">
          <h2>{t('ov.performance')} <span className="tag">{ex}</span></h2>
          <small className="muted">{t('ov.performanceHint')}</small>
          <div className="bars">
            {DEMO_WEEK.map((v, i) => (
              <div className="bar-col" key={i}>
                <div className="bar" style={{ height: `${(v / max) * 100}%` }} title={String(v)} />
                <span>{t(`days.${i}` as TranslationKey)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>{t('ov.next')} <span className="tag">{ex}</span></h2>
          {DEMO_NEXT.length === 0 ? <EmptyState title={t('ov.next')} description={t('ov.nextEmpty')} /> : (
            <ul className="list">
              {DEMO_NEXT.map((n) => (
                <li key={n.title}><strong>{n.title}</strong><span className="muted">{n.network} · {n.when}</span></li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <section className="card">
        <h2>{t('ov.status')}</h2>
        <ul className="list">
          {status.map(([label, value, ok]) => (
            <li key={label}><span>{t(label)}</span><span className={`pill ${ok ? 'ok' : 'off'}`}>{t(value)}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
