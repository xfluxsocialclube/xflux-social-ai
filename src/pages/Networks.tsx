import { useCallback, useEffect, useState } from 'react';
import { ConfirmModal } from '../components/ConfirmModal';
import { Modal } from '../components/Modal';
import { Notice } from '../components/Notice';
import { useI18n } from '../i18n/I18nContext';
import { fmt } from '../i18n/format';
import type { TranslationKey } from '../i18n/pt';
import { connectionOf, emptySnapshot, loadSnapshot, refreshSnapshot, type BackendSnapshot } from '../services/backend/accounts';
import { BackendError, disconnectAccount, getBackendUrl, getSessionToken, setBackendUrl, setSessionToken, startOAuth, validateBackendUrl } from '../services/backend/client';
import { ADAPTERS } from '../services/publishing/adapters';
import { getFacts } from '../services/publishing/catalog';
import { planRoute } from '../services/publishing/delivery';
import type { ConnectionView } from '../services/publishing/types';
import { getPlanNetworks, setPlanNetworks } from '../services/planner/plans';

const pillClass = (v: ConnectionView) => (v === 'connected' ? 'ok' : v === 'not-connected' ? 'off' : v === 'expiring' ? 'warn' : 'err');

/** Central de integrações: servidor, contas, o que cada plataforma oferece oficialmente e o que falta para automatizar. */
export function Networks() {
  const { t, locale } = useI18n();
  const [chosen, setChosen] = useState<string[]>(() => getPlanNetworks());
  const [snap, setSnap] = useState<BackendSnapshot>(() => loadSnapshot());
  const [url, setUrl] = useState(getBackendUrl()); const [token, setToken] = useState(getSessionToken());
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [oauth, setOauth] = useState<{ network: string; url: string; host: string } | null>(null);
  const [disc, setDisc] = useState<{ id: string; name: string } | null>(null);
  const [serverOpen, setServerOpen] = useState(() => Boolean(getBackendUrl()));

  const check = useCallback(async () => { setBusy(true); try { setSnap(await refreshSnapshot()); } finally { setBusy(false); } }, []);
  useEffect(() => { if (getBackendUrl()) void check(); }, [check]);

  const toggle = (id: string) => { const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]; setChosen(next); setPlanNetworks(next); };
  const saveServer = async () => {
    setErr(null); setMsg(null);
    if (url.trim() && !validateBackendUrl(url)) { setErr(t('pub.srv.invalid')); return; }
    setBackendUrl(url); setSessionToken(token.trim());
    setSnap(emptySnapshot()); if (url.trim()) await check(); else setSnap(await refreshSnapshot());
  };
  const errText = (e: unknown) => t(`pub.srv.err.${e instanceof BackendError ? e.kind : 'unreachable'}` as TranslationKey);
  const connect = async (network: string, reconnectId?: string) => {
    setErr(null); setBusy(true);
    try { const r = await startOAuth(network, reconnectId); setOauth({ network, url: r.authorizationUrl, host: new URL(r.authorizationUrl).host }); }
    catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  const doDisconnect = async () => { if (!disc) return; const id = disc.id; setDisc(null); setBusy(true); try { await disconnectAccount(id); setSnap(await refreshSnapshot()); } catch (e) { setErr(errText(e)); } finally { setBusy(false); } };

  const srvState = !snap.url ? 'none' : snap.reachable === true ? 'ok' : snap.reachable === false ? 'down' : 'unknown';
  const d = (iso: string) => new Date(iso).toLocaleString(locale);
  return (
    <div className="stack">
      <h2 style={{ margin: 0 }}>{t('pub.int.title')}</h2>
      <Notice>{t('net.intro')}</Notice>
      <Notice>{t('net.assistedIntro')}</Notice>
      {err && <Notice tone="warn">{err}</Notice>}
      {msg && <Notice>{msg}</Notice>}

      <section className="card stack">
        <div className="row between"><h2 style={{ margin: 0 }}>{t('pub.srv.title')}</h2><span className={`pill ${srvState === 'ok' ? 'ok' : srvState === 'down' ? 'err' : 'off'}`}>{t(`pub.srv.state.${srvState}` as TranslationKey)}</span></div>
        <small className="muted">{t('pub.srv.desc')}</small>
        <button className="btn ghost" type="button" aria-expanded={serverOpen} aria-controls="xflux-server-advanced" onClick={() => setServerOpen((value) => !value)}>
          {serverOpen ? t('pub.srv.hideAdvanced') : t('pub.srv.showAdvanced')}
        </button>
        {serverOpen && <div id="xflux-server-advanced" className="stack">
          <div className="form">
            <label className="wide">{t('pub.srv.url')}<input className="search" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
            <label className="wide">{t('pub.srv.token')}<input className="search" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} /><small className="muted">{t('pub.srv.tokenHint')}</small></label>
          </div>
          <div className="toolbar"><button className="btn" disabled={busy} onClick={saveServer}>{t('pub.srv.save')}</button><button className="btn ghost" disabled={busy || !snap.url} onClick={check}>{t('pub.srv.test')}</button></div>
        </div>}
        {snap.url && snap.reachable === true && <small className="good">{t('pub.srv.ok')} {fmt(t('pub.srv.caps'), { c: snap.health?.capabilities.join(', ') || '—' })}</small>}
        {snap.url && snap.reachable === false && <Notice tone="warn">{t(`pub.srv.err.${snap.error ?? 'unreachable'}` as TranslationKey)} {t('pub.srv.stale')}</Notice>}
        {snap.fetchedAt && <small className="muted">{fmt(t('pub.srv.checked'), { d: d(snap.fetchedAt) })}</small>}
        {!snap.url && <small className="muted">{t('pub.srv.none')}</small>}
      </section>

      <div className="grid nets">
        {ADAPTERS.map((n) => {
          const facts = getFacts(n.id); const c = connectionOf(n.id, snap); const route = planRoute(n.id, snap);
          const prov = snap.health?.providers.find((p) => p.network === n.id);
          // Snapshot antigo não pode habilitar OAuth se o endereço do servidor foi removido.
          const hasServer = Boolean(getBackendUrl().trim()) && Boolean(snap.url);
          const canOauth = hasServer && snap.reachable === true && !!prov?.oauth;
          const why = !hasServer ? t('pub.cant.noServer') : snap.reachable !== true ? t('pub.cant.unreachable') : !prov?.oauth ? t('pub.cant.provider') : '';
          return (
            <div className="card net" key={n.id} style={{ alignItems: 'stretch', textAlign: 'left' }}>
              <div className="row"><div className="net-dot" style={{ background: n.color }}>{n.name[0]}</div><strong>{n.priority}. {n.name}</strong></div>
              <div className="row"><span className={`pill ${pillClass(c.view)}`}>{t(`pub.conn.${c.view}` as TranslationKey)}</span>{c.account && !c.verified && <small className="muted">{t('pub.conn.unverified')}</small>}</div>
              {c.account && <small className="muted">{fmt(t('pub.acc.line'), { name: c.account.displayName, n: c.account.scopes.length })}{c.account.expiresAt ? ` · ${fmt(t('pub.acc.expires'), { d: d(c.account.expiresAt) })}` : ''}{c.account.lastError ? ` · ${fmt(t('pub.acc.error'), { m: c.account.lastError.message })}` : ''}</small>}
              {facts && <div className="stack" style={{ gap: '.2rem' }}>
                <small className="muted">{t(`pub.avail.${facts.directPublish}` as TranslationKey)}</small>
                <small className="muted">{t(`pub.sched.${facts.nativeSchedule}` as TranslationKey)}</small>
                <small className="muted">{t(`pub.unat.${facts.unattended}` as TranslationKey)}</small>
              </div>}
              <span className="pill">{t(route.route === 'api' ? 'pub.route.api' : 'pub.route.assisted')}</span>
              <div className="toolbar">
                {c.view === 'not-connected' && <button className="btn small" disabled={!canOauth || busy} title={why} onClick={() => connect(n.id)}>{t('pub.act.connect')}</button>}
                {(c.view === 'expired' || c.view === 'expiring' || c.view === 'revoked' || c.view === 'error') && <button className="btn small" disabled={!canOauth || busy} title={why} onClick={() => connect(n.id, c.account?.id)}>{t('pub.act.reconnect')}</button>}
                {c.account && <button className="btn ghost small" disabled={snap.reachable !== true || busy} onClick={() => setDisc({ id: c.account!.id, name: n.name })}>{t('pub.act.disconnect')}</button>}
                <button className="btn ghost small" onClick={() => setOpen(open === n.id ? null : n.id)}>{open === n.id ? t('pub.hide') : t('pub.details')}</button>
              </div>
              {!canOauth && c.view === 'not-connected' && <small className="muted">{why}</small>}
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

      {oauth && (
        <Modal title={t('pub.oauth.title')} onClose={() => setOauth(null)}>
          <p>{fmt(t('pub.oauth.text'), { host: oauth.host })}</p>
          <p className="muted">{t('pub.oauth.after')}</p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setOauth(null)}>{t('lib.cancel')}</button>
            <button className="btn" onClick={() => { window.open(oauth.url, '_blank', 'noopener,noreferrer'); setOauth(null); setMsg(t('pub.oauth.after')); }}>{t('pub.oauth.open')}</button>
          </div>
        </Modal>
      )}
      {disc && <ConfirmModal title={`${t('pub.act.disconnect')} ${disc.name}`} text={t('pub.disc.text')} confirmLabel={t('pub.act.disconnect')} onCancel={() => setDisc(null)} onConfirm={doDisconnect} />}
    </div>
  );
}
