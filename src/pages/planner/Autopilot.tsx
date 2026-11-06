import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { NetTag } from '../../components/NetTag';
import { Notice } from '../../components/Notice';
import { Progress } from '../../components/Progress';
import { useI18n } from '../../i18n/I18nContext';
import { fmt } from '../../i18n/format';
import type { TranslationKey } from '../../i18n/pt';
import { getAdapter } from '../../services/publishing/adapters';
import { addDays, isValidYmd, parseYmd } from '../../services/planner/dates';
import { continuePlan, CYCLE_DAYS, finishPlan, getAlertDays, listPlans, listPosts, loadConfig, loadFlags, MAX_CUSTOM_DAYS, pausePlan, resumePlan, saveConfig, saveFlags, summarize } from '../../services/planner/plans';
import type { CycleKind, Plan, PlannedPost } from '../../services/planner/types';
import type { PageId } from '../../config/nav';

const KINDS: CycleKind[] = ['1w', '2w', '3w', '4w', 'custom'];

export function Autopilot({ onNavigate, onChanged }: { onNavigate: (p: PageId) => void; onChanged: () => void }) {
  const { t, locale } = useI18n();
  const [plans, setPlans] = useState<Plan[] | null>(null); const [posts, setPosts] = useState<PlannedPost[]>([]);
  const [cfg, setCfg] = useState(() => loadConfig()); const [saved, setSaved] = useState(false); const [msg, setMsg] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const [ask, setAsk] = useState<'finish' | 'continue' | null>(null); const [renew, setRenew] = useState(false); const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => { try { const [p, po] = await Promise.all([listPlans(), listPosts()]); setPlans(p); setPosts(po); } catch { setErr(t('cb.err.load')); setPlans([]); } onChanged(); }, [t, onChanged]);
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const current = useMemo(() => (plans ?? []).find((p) => p.status === 'active' || p.status === 'paused'), [plans]);
  const history = useMemo(() => (plans ?? []).filter((p) => p.status === 'finished').sort((a, b) => b.startDate.localeCompare(a.startDate)), [plans]);
  const sum = current ? summarize(current, posts) : null;
  const d = (iso: string) => new Date(parseYmd(iso)).toLocaleDateString(locale);

  const setKind = (kind: CycleKind) => { setCfg({ ...cfg, cycleKind: kind, lengthDays: kind === 'custom' ? Math.min(MAX_CUSTOM_DAYS, Math.max(1, cfg.lengthDays)) : CYCLE_DAYS[kind] }); setSaved(false); };
  const saveCycle = () => {
    if (!isValidYmd(cfg.startDate) || cfg.lengthDays < 1 || cfg.lengthDays > MAX_CUSTOM_DAYS) { setErr(t('pl.err.badLength')); return; }
    setErr(null); saveConfig({ ...loadConfig(), startDate: cfg.startDate, cycleKind: cfg.cycleKind, lengthDays: cfg.lengthDays }); saveFlags({ ...loadFlags(), cycle: true }); setSaved(true);
  };
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); setErr(null); try { await fn(); await refresh(); } catch { setErr(t('cb.err.save')); } finally { setBusy(false); } };
  const doContinue = () => act(async () => {
    const r = await continuePlan(current!);
    setMsg(r.plan.status === 'active' ? t('ap.contActive') : fmt(t('ap.contDraft'), { n: r.pending })); if (r.plan.status !== 'active') onNavigate('schedule');
  });

  if (plans === null) return <p className="muted">{t('lib.loading')}</p>;
  const nearEnd = !!sum && sum.daysLeft <= getAlertDays();
  const nextRenewal = current ? addDays(current.endDate, 1) : '';
  return (
    <div className="stack">
      {err && <Notice tone="warn">{err}</Notice>}
      {msg && <Notice>{msg}</Notice>}
      <Notice>{t('ap.honest')}</Notice>

      <section className="card stack">
        <h2>{t('ap.cycleTitle')}</h2>
        <small className="muted">{t('ap.cycleHint')}</small>
        {current && <Notice tone="warn">{t('ap.cycleLocked')}</Notice>}
        <div className="chips">{KINDS.map((k) => <button key={k} className={`chip ${cfg.cycleKind === k ? 'on' : ''}`} aria-pressed={cfg.cycleKind === k} onClick={() => setKind(k)}>{t(`ap.kind.${k}` as TranslationKey)}</button>)}</div>
        <div className="row">
          {cfg.cycleKind === 'custom' && <label className="row"><input type="number" min={1} max={MAX_CUSTOM_DAYS} value={cfg.lengthDays} onChange={(e) => { setCfg({ ...cfg, lengthDays: Math.max(1, Math.floor(Number(e.target.value) || 1)) }); setSaved(false); }} /> {t('set.days')}</label>}
          <label className="row">{t('ap.start')}: <input type="date" value={cfg.startDate} onChange={(e) => { setCfg({ ...cfg, startDate: e.target.value }); setSaved(false); }} /></label>
          <button className="btn" onClick={saveCycle}>{t('ap.saveCycle')}</button>
        </div>
        {saved && <Notice>{t('ap.cycleSaved')}</Notice>}
      </section>

      {!current || !sum ? (
        <div className="card stack"><EmptyState title={t('ap.noneTitle')} description={t('ap.noneDesc')} /><div className="center row"><button className="btn" onClick={() => onNavigate('schedule')}>{t('nav.schedule')}</button><button className="btn ghost" onClick={() => onNavigate('guide')}>{t('nav.guide')}</button></div></div>
      ) : (<>
        {nearEnd && <Notice tone="warn">{sum.ended ? t('ap.alertEnded') : fmt(t('ap.alertSoon'), { n: sum.daysLeft })}</Notice>}
        <section className="card stack">
          <div className="row between"><h2 style={{ margin: 0 }}>{d(current.startDate)} – {d(current.endDate)}</h2><span className={`pill ${current.status === 'active' ? 'ok' : 'warn'}`}>{t(current.status === 'active' ? 'pl.plan.active' : 'pl.plan.paused')}</span></div>
          <Progress pct={sum.progressPct} label={t('ap.progress')} /><small className="muted">{fmt(t('ap.progressText'), { p: sum.progressPct })}</small>
          <div className="num-grid">
            <div><small className="muted">{t('ap.planned')}</small><span className="big-num">{sum.total - sum.pending}</span></div>
            <div><small className="muted">{t('ap.published')}</small><span className="big-num good">{sum.published}</span></div>
            <div><small className="muted">{t('ap.remaining')}</small><span className="big-num">{sum.remaining}</span></div>
            <div><small className="muted">{t('ap.missing')}</small><span className={`big-num ${sum.pending ? 'bad' : ''}`}>{sum.pending}</span></div>
            <div><small className="muted">{t('ap.overdue')}</small><span className={`big-num ${sum.overdue ? 'bad' : ''}`}>{sum.overdue}</span></div>
          </div>
          {sum.pending > 0 && <small className="warn-text">{t('ap.missingHint')}</small>}
          {sum.overdue > 0 && <small className="warn-text">{t('ap.overdueHint')}</small>}
          <small className="muted">{t('ap.nextRenewal')}: <strong>{d(nextRenewal)}</strong> · {sum.ended ? t('ap.ended') : fmt(t('ap.daysLeft'), { n: sum.daysLeft })}</small>
          <div className="toolbar">
            {current.status === 'active' ? <button className="btn ghost" disabled={busy} onClick={() => act(() => pausePlan(current))}>{t('ap.pause')}</button> : <button className="btn" disabled={busy} onClick={() => act(() => resumePlan(current))}>{t('ap.resume')}</button>}
            <button className="btn ghost" onClick={() => onNavigate('schedule')}>{t('nav.schedule')}</button>
          </div>
        </section>
        <section className="card stack">
          <h2>{t('ap.networksTitle')}</h2>
          <ul className="list">{sum.perNetwork.map((n) => <li key={n.id}><span className="row"><NetTag id={n.id} /><span className="pill off">{t(`pub.conn.${getAdapter(n.id)?.connection() ?? 'not-connected'}` as TranslationKey)}</span><span className="pill">{t(getAdapter(n.id)?.stageKey ?? 'net.stage.validate')}</span></span><span>{fmt(t('ap.netCounts'), { p: n.planned, d: n.published })}</span></li>)}</ul>
        </section>
        {(nearEnd || sum.ended) && (
          <section className="card stack">
            <h2>{t('ap.endTitle')}</h2><small className="muted">{t('ap.endHint')}</small>
            <div className="cycle-opts">
              <button className="btn" disabled={busy} onClick={() => setAsk('continue')}>{t('ap.optContinue')}</button>
              <button className="btn ghost" onClick={() => setRenew(true)}>{t('ap.optRenew')}</button>
              <button className="btn ghost" onClick={() => onNavigate('schedule')}>{t('ap.optChange')}</button>
              <button className="btn ghost" disabled={busy || current.status === 'paused'} onClick={() => act(() => pausePlan(current))}>{t('ap.optPause')}</button>
              <button className="btn ghost" disabled={busy} onClick={() => setAsk('finish')}>{t('ap.finish')}</button>
            </div>
          </section>
        )}
      </>)}

      {history.length > 0 && (
        <section className="card"><h2>{t('ap.history')}</h2>
          <ul className="list">{history.map((p) => { const s = summarize(p, posts); return <li key={p.id}><span>{d(p.startDate)} – {d(p.endDate)}</span><span className="muted">{fmt(t('ap.histCounts'), { p: s.published, n: s.total - s.pending })}</span></li>; })}</ul>
        </section>
      )}

      {ask === 'continue' && <ConfirmModal title={t('ap.optContinue')} text={t('ap.continueText')} confirmLabel={t('ap.optContinue')} onCancel={() => setAsk(null)} onConfirm={() => { setAsk(null); doContinue(); }} />}
      {ask === 'finish' && current && <ConfirmModal title={t('ap.finish')} text={t('ap.finishText')} confirmLabel={t('ap.finish')} onCancel={() => setAsk(null)} onConfirm={() => { setAsk(null); act(() => finishPlan(current)); }} />}
      {renew && (
        <Modal title={t('ap.optRenew')} onClose={() => setRenew(false)}>
          <p>{t('ap.renewText')}</p>
          <div className="row"><button className="btn ghost small" onClick={() => { setRenew(false); onNavigate('library'); }}>{t('nav.library')}</button><button className="btn ghost small" onClick={() => { setRenew(false); onNavigate('captions'); }}>{t('nav.captions')}</button><button className="btn ghost small" onClick={() => { setRenew(false); onNavigate('pairing'); }}>{t('nav.pairing')}</button></div>
          <div className="modal-actions"><button className="btn" onClick={() => setRenew(false)}>{t('lib.close')}</button></div>
        </Modal>
      )}
    </div>
  );
}
