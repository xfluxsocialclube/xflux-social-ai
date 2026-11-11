import { useState } from 'react';
import { ConfirmModal } from '../components/ConfirmModal';
import { Notice } from '../components/Notice';
import { useI18n } from '../i18n/I18nContext';
import { fmt } from '../i18n/format';
import type { TranslationKey } from '../i18n/pt';
import { connectionOf, isLoginImplemented, removeLocalAccount } from '../services/accounts/local';
import { ADAPTERS } from '../services/publishing/adapters';
import { getFacts } from '../services/publishing/catalog';
import { planRoute } from '../services/publishing/delivery';
import type { ConnectionView } from '../services/publishing/types';
import { getPlanNetworks, setPlanNetworks } from '../services/planner/plans';

const pillClass = (value: ConnectionView) => (
  value === 'connected' ? 'ok' : value === 'not-connected' ? 'off' : value === 'expiring' ? 'warn' : 'err'
);

/** Central de integrações local-first: contas guardadas neste computador, sem servidor XFLUX. */
export function Networks() {
  const { t, locale } = useI18n();
  const [chosen, setChosen] = useState<string[]>(() => getPlanNetworks());
  const [open, setOpen] = useState<string | null>(null);
  const [disconnect, setDisconnect] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const toggle = (id: string) => {
    const next = chosen.includes(id) ? chosen.filter((item) => item !== id) : [...chosen, id];
    setChosen(next);
    setPlanNetworks(next);
  };
  const doDisconnect = async () => {
    if (!disconnect) return;
    const id = disconnect.id;
    setDisconnect(null);
    setBusy(true);
    setError(null);
    try {
      await removeLocalAccount(id);
      setTick((value) => value + 1);
    } catch {
      setError(t('cb.err.save'));
    } finally {
      setBusy(false);
    }
  };
  const formatDate = (iso: string) => new Date(iso).toLocaleString(locale);

  return (
    <div className="stack">
      <h2 style={{ margin: 0 }}>{t('pub.int.title')}</h2>
      <Notice>{t('net.intro')}</Notice>
      <Notice>{t('net.assistedIntro')}</Notice>
      {error && <Notice tone="warn">{error}</Notice>}

      <div className="grid nets">
        {ADAPTERS.map((network) => {
          const facts = getFacts(network.id);
          const connection = connectionOf(network.id);
          const route = planRoute(network.id);
          const canLogin = isLoginImplemented(network.id);
          const why = canLogin ? '' : t('pub.cant.provider');
          return (
            <div className="card net" key={network.id} style={{ alignItems: 'stretch', textAlign: 'left' }}>
              <div className="row"><div className="net-dot" style={{ background: network.color }}>{network.name[0]}</div><strong>{network.priority}. {network.name}</strong></div>
              <div className="row"><span className={`pill ${pillClass(connection.view)}`}>{t(`pub.conn.${connection.view}` as TranslationKey)}</span></div>
              {connection.account && <small className="muted">
                {fmt(t('pub.acc.line'), { name: connection.account.displayName, n: connection.account.scopes.length })}
                {connection.account.expiresAt ? ` · ${fmt(t('pub.acc.expires'), { d: formatDate(connection.account.expiresAt) })}` : ''}
                {connection.account.lastError ? ` · ${fmt(t('pub.acc.error'), { m: connection.account.lastError.message })}` : ''}
              </small>}
              {facts && <div className="stack" style={{ gap: '.2rem' }}>
                <small className="muted">{t(`pub.avail.${facts.directPublish}` as TranslationKey)}</small>
                <small className="muted">{t(`pub.sched.${facts.nativeSchedule}` as TranslationKey)}</small>
                <small className="muted">{t(`pub.unat.${facts.unattended}` as TranslationKey)}</small>
              </div>}
              <span className="pill">{t(route.route === 'api' ? 'pub.route.api' : 'pub.route.assisted')}</span>
              {route.blockers[0] && <small className="muted">{t('pub.route.missing')}: {t(`pub.blk.${route.blockers[0]}` as TranslationKey)}</small>}
              <div className="toolbar">
                {connection.view === 'not-connected' && <button className="btn small" disabled={!canLogin || busy} title={why}>{t('pub.act.connect')}</button>}
                {(connection.view === 'expired' || connection.view === 'expiring' || connection.view === 'revoked' || connection.view === 'error') && <button className="btn small" disabled={!canLogin || busy} title={why}>{t('pub.act.reconnect')}</button>}
                {connection.account && <button className="btn ghost small" disabled={busy} onClick={() => setDisconnect({ id: connection.account!.id, name: network.name })}>{t('pub.act.disconnect')}</button>}
                <button className="btn ghost small" onClick={() => setOpen(open === network.id ? null : network.id)}>{open === network.id ? t('pub.hide') : t('pub.details')}</button>
              </div>
              {!canLogin && connection.view === 'not-connected' && <small className="muted">{why}</small>}
              <label className="switch-row"><input type="checkbox" checked={chosen.includes(network.id)} onChange={() => toggle(network.id)} /><span>{t('net.usePlan')}</span></label>
              {open === network.id && facts && (
                <div className="stack" style={{ gap: '.4rem' }}>
                  <strong>{t('pub.route.missing')}</strong>
                  <ul className="list">{route.blockers.map((blocker) => <li key={blocker}><small>{t(`pub.blk.${blocker}` as TranslationKey)}</small></li>)}</ul>
                  <strong>{t('pub.details')}</strong>
                  <ul className="list">{facts.facts.map((fact) => <li key={fact}><small>{t(fact)}</small></li>)}</ul>
                  <small className="muted">{fmt(t('pub.checkedOn'), { d: new Date(`${facts.checkedOn}T12:00:00`).toLocaleDateString(locale) })}</small>
                  <small>{t('pub.sources')}: {facts.sources.map((source, index) => <span key={source.url}>{index ? ' · ' : ''}<a href={source.url} target="_blank" rel="noopener noreferrer"><u>{source.label}</u></a></span>)}</small>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {disconnect && <ConfirmModal title={`${t('pub.act.disconnect')} ${disconnect.name}`} text={t('pub.disc.text')} confirmLabel={t('pub.act.disconnect')} onCancel={() => setDisconnect(null)} onConfirm={doDisconnect} />}
    </div>
  );
}
