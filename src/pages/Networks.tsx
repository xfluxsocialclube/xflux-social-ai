import { useState } from 'react';
import { ConfirmModal } from '../components/ConfirmModal';
import { ConnectWizard } from '../components/ConnectWizard';
import { Notice } from '../components/Notice';
import { useI18n } from '../i18n/I18nContext';
import { fmt } from '../i18n/format';
import type { TranslationKey } from '../i18n/pt';
import { connectionOf, isLoginImplemented, removeLocalAccount } from '../services/accounts/local';
import { disconnectYouTube, verifyYouTube } from '../services/oauth/youtube';
import { ADAPTERS } from '../services/publishing/adapters';
import { getFacts } from '../services/publishing/catalog';
import { planRoute } from '../services/publishing/delivery';
import type { ConnectionView } from '../services/publishing/types';
import { getPlanNetworks, setPlanNetworks } from '../services/planner/plans';

const pillClass = (v: ConnectionView) => (v === 'connected' ? 'ok' : v === 'not-connected' ? 'off' : v === 'expiring' ? 'warn' : 'err');

export function Networks() {
  const { t, locale } = useI18n();
  const [chosen, setChosen] = useState<string[]>(() => getPlanNetworks());
  const [open, setOpen] = useState<string | null>(null);
  const [disc, setDisc] = useState<{ id: string; name: string; network: string } | null>(null);
  const [wizard, setWizard] = useState<{ network: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const toggle = (id: string) => {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
    setChosen(next); setPlanNetworks(next);
  };
  const doDisconnect = async () => {
    if (!disc) return;
    const d = disc; setDisc(null); setBusy(true); setErr(null); setMsg(null);
    try {
      if (d.network === 'youtube') await disconnectYouTube(d.id);
      else await removeLocalAccount(d.id);
      refresh();
    } catch { setErr(t('cb.err.save')); }
    finally { setBusy(false); }
  };
  const verify = async (network: string, id: string) => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      if (network === 'youtube') await verifyYouTube(id);
      setMsg(t('wz.verifyOk'));
    } catch { setErr(t('wz.err.generic')); }
    finally { setBusy(false); refresh(); }
  };
  const d = (iso: string) => new Date(iso).toLocaleString(locale);

  return (
    <div className="stack">
      <h2 style={{ margin: 0 }}>{t('pub.int.title')}</h2>
      <Notice>{t('net.intro')}</Notice>
      <Notice>{t('net.assistedIntro')}</Notice>
      {err && <Notice tone="warn">{err}</Notice>}
      {msg && <Notice>{msg}</Notice>}
      <div className="grid nets">
        {ADAPTERS.map((n) => {
          const facts = getFacts(n.id), c = connectionOf(n.id), route = planRoute(n.id);
          const canLogin = isLoginImplemented(n.id);
          const why = canLogin ? '' : t('pub.cant.provider');
          return (
            <div className="card net" key={n.id} style={{ alignItems: 'stretch', textAlign: 'left' }}>
              <div className="row"><div className="net-dot" style={{ background: n.color }}>{n.name[0]}</div><strong>{n.priority}. {n.name}</strong></div>
              <div className="row"><span className={`pill ${pillClass(c.view)}`}>{t(`pub.conn.${c.view}` as TranslationKey)}</span></div>
              {c.account && <small className="muted">
                {fmt(t('pub.acc.line'), { name: c.account.displayName, n: c.account.scopes.length })}
                {c.account.expiresAt ? ` · ${fmt(t('pub.acc.expires'), { d: d(c.account.expiresAt) })}` : ''}
                {c.account.lastError ? ` · ${fmt(t('pub.acc.error'), { m: c.account.lastError.message })}` : ''}
              </small>}
              {facts && <div className="stack" style={{ gap: '.2rem' }}>
                <small className="muted">{t(`pub.avail.${facts.directPublish}` as TranslationKey)}</small>
                <small className="muted">{t(`pub.sched.${facts.nativeSchedule}` as TranslationKey)}</small>
                <small className="muted">{t(`pub.unat.${facts.unattended}` as TranslationKey)}</small>
              </div>}
              <span className="pill">{t(route.route === 'api' ? 'pub.route.api' : 'pub.route.assisted')}</span>
              {route.blockers[0] && <small className="muted">{t('pub.route.missing')}: {t(`pub.blk.${route.blockers[0]}` as TranslationKey)}</small>}
              <div className="toolbar">
                {c.view === 'not-connected' && <button className="btn small" disabled={!canLogin || busy} title={why} onClick={() => setWizard({ network: n.id, name: n.name })}>{t('pub.act.connect')}</button>}
                {(c.view === 'expired' || c.view === 'expiring' || c.view === 'revoked' || c.view === 'error') && <button className="btn small" disabled={!canLogin || busy} title={why} onClick={() => setWizard({ network: n.id, name: n.name })}>{t('pub.act.reconnect')}</button>}
                {c.account && canLogin && <button className="btn ghost small" disabled={busy} onClick={() => void verify(n.id, c.account!.id)}>{t('wz.verify')}</button>}
                {c.account && <button className="btn ghost small" disabled={busy} onClick={() => setDisc({ id: c.account!.id, name: n.name, network: n.id })}>{t('pub.act.disconnect')}</button>}
                <button className="btn ghost small" onClick={() => setOpen(open === n.id ? null : n.id)}>{open === n.id ? t('pub.hide') : t('pub.details')}</button>
              </div>
              {!canLogin && c.view === 'not-connected' && <small className="muted">{why}</small>}
              <label className="switch-row"><input type="checkbox" checked={chosen.includes(n.id)} onChange={() => toggle(n.id)} /><span>{t('net.usePlan')}</span></label>
              {open === n.id && facts && (
                <div className="stack" style={{ gap: '.4rem' }}>
                  <strong>{t('pub.route.missing')}</strong>
                  <ul className="list">{route.blockers.map((b) => <li key={b}><small>{t(`pub.blk.${b}` as TranslationKey)}</small></li>)}</ul>
                  <strong>{t('pub.details')}</strong>
                  <ul className="list">{facts.facts.map((f) => <li key={f}><small>{t(f)}</small></li>)}</ul>
                  <small className="muted">{fmt(t('pub.checkedOn'), { d: new Date(`${facts.checkedOn}T12:00:00`).toLocaleDateString(locale) })}</small>
                  <small>{t('pub.sources')}: {facts.sources.map((s, i) => <span key={s.url}>{i ? ' · ' : ''}<a href={s.url} target="_blank" rel="noopener noreferrer"><u>{s.label}</u></a></span>)}</small>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {wizard && <ConnectWizard name={wizard.name} onClose={() => setWizard(null)} onConnected={refresh} />}
      {disc && <ConfirmModal title={`${t('pub.act.disconnect')} ${disc.name}`} text={t('pub.disc.text')} confirmLabel={t('pub.act.disconnect')} onCancel={() => setDisc(null)} onConfirm={doDisconnect} />}
    </div>
  );
}
