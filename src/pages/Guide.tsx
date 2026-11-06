import { useEffect } from 'react';
import { FluxMascot } from '../components/FluxMascot';
import { Notice } from '../components/Notice';
import { Progress } from '../components/Progress';
import { useI18n } from '../i18n/I18nContext';
import { fmt } from '../i18n/format';
import type { TranslationKey } from '../i18n/pt';
import type { PageId } from '../config/nav';
import { useGuide } from './useGuide';

export const STEP_PAGES: PageId[] = ['library', 'captions', 'pairing', 'networks', 'schedule', 'autopilot', 'schedule', 'schedule'];

/** Guia do FLUX: 8 etapas, progresso salvo, pode ser pausado e retomado. Não é um chatbot. */
export function Guide({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const { t } = useI18n();
  const g = useGuide();
  useEffect(() => { g.refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!g.status) return <p className="muted">{t('lib.loading')}</p>;
  const cur = Math.min(Math.max(g.state.current, 0), g.total - 1);
  const k = (n: number, part: string) => `guide.s${n + 1}.${part}` as TranslationKey;
  const s = g.status; const c = s.counts;
  const facts = [c.media, c.captions, c.confirmed, c.networks, 0, 0, c.posts, 0][cur];
  const factKey = (['guide.f.media', 'guide.f.captions', 'guide.f.confirmed', 'guide.f.networks', '', '', 'guide.f.posts', ''] as (TranslationKey | '')[])[cur];
  const allDone = g.doneCount === g.total;
  return (
    <div className="stack">
      <section className="card welcome">
        <FluxMascot size={110} />
        <div className="welcome-text">
          <p className="bubble">{allDone ? t('guide.allDone') : g.state.paused ? t('guide.paused') : t(k(g.firstOpen, 'say'))}</p>
          <div className="row" style={{ width: '100%' }}><div style={{ flex: 1, minWidth: 160 }}><Progress pct={(g.doneCount / g.total) * 100} label={t('guide.progress')} /></div><small className="muted">{fmt(t('guide.of'), { n: g.doneCount, total: g.total })}</small></div>
          {!allDone && <div className="row">
            {g.state.paused ? <button className="btn" onClick={() => g.update({ current: g.firstOpen, paused: false })}>{t('guide.resume')}</button> : <button className="btn ghost" onClick={() => g.update({ ...g.state, current: g.state.current, paused: true })}>{t('guide.pause')}</button>}
          </div>}
        </div>
      </section>
      <Notice>{t('guide.noRequirement')}</Notice>
      <div className="guide">
        <div className="steps">
          {Array.from({ length: g.total }, (_, i) => (
            <button key={i} className={`step ${s.done[i] ? 'done' : ''} ${i === cur ? 'cur' : ''}`} onClick={() => g.update({ ...g.state, current: i })} aria-current={i === cur ? 'step' : undefined}>
              <span className="step-dot">{s.done[i] ? '✓' : i + 1}</span><span>{t(k(i, 'title'))}</span>
            </button>
          ))}
        </div>
        <section className="card stack">
          <h2>{fmt(t('guide.stepOf'), { n: cur + 1, total: g.total })}: {t(k(cur, 'title'))} <span className={`pill ${s.done[cur] ? 'ok' : 'warn'}`}>{t(s.done[cur] ? 'guide.done' : 'guide.todo')}</span></h2>
          <p style={{ margin: 0 }}>{t(k(cur, 'desc'))}</p>
          {factKey && <small className="muted">{fmt(t(factKey), { n: facts })}</small>}
          <div className="row">
            <button className="btn" onClick={() => onNavigate(STEP_PAGES[cur])}>{t(k(cur, 'action'))}</button>
            <button className="btn ghost" disabled={cur === 0} onClick={() => g.update({ ...g.state, current: cur - 1 })}>{t('cb.prev')}</button>
            <button className="btn ghost" disabled={cur >= g.total - 1} onClick={() => g.update({ ...g.state, current: cur + 1 })}>{t('cb.next')}</button>
          </div>
        </section>
      </div>
    </div>
  );
}
