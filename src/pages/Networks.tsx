import { useState } from 'react';
import { Notice } from '../components/Notice';
import { useI18n } from '../i18n/I18nContext';
import type { TranslationKey } from '../i18n/pt';
import { ADAPTERS } from '../services/publishing/adapters';
import { getFacts } from '../services/publishing/catalog';
import { planRoute } from '../services/publishing/delivery';
import { getPlanNetworks, setPlanNetworks } from '../services/planner/plans';

/** Central local-first: não configura servidor e não envia credenciais/dados para infraestrutura XFLUX. */
export function Networks() {
  const { t, locale } = useI18n();
  const [chosen, setChosen] = useState<string[]>(() => getPlanNetworks());
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string) => {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
    setChosen(next); setPlanNetworks(next);
  };

  return (
    <div className="stack">
      <h2 style={{ margin: 0 }}>{t('pub.int.title')}</h2>
      <Notice>O XFLUX funciona no dispositivo do cliente. Vídeos, legendas, calendário, fila e histórico permanecem no armazenamento escolhido pelo próprio cliente. Não há conexão com servidor central XFLUX nesta versão.</Notice>
      <Notice>As conexões diretas com as contas e a publicação automática ainda estão em desenvolvimento. Nenhuma conta será marcada como conectada e nenhuma publicação será simulada. Enquanto isso, o XFLUX prepara o conteúdo para publicação assistida.</Notice>
      <div className="grid nets">
        {ADAPTERS.map((n) => {
          const facts = getFacts(n.id);
          const route = planRoute(n.id);
          return (
            <div className="card net" key={n.id} style={{ alignItems: 'stretch', textAlign: 'left' }}>
              <div className="row"><div className="net-dot" style={{ background: n.color }}>{n.name[0]}</div><strong>{n.priority}. {n.name}</strong></div>
              <div className="row"><span className="pill off">{t('pub.conn.not-connected')}</span></div>
              {facts && <div className="stack" style={{ gap: '.2rem' }}>
                <small className="muted">{t(`pub.avail.${facts.directPublish}` as TranslationKey)}</small>
                <small className="muted">{t(`pub.sched.${facts.nativeSchedule}` as TranslationKey)}</small>
                <small className="muted">{t(`pub.unat.${facts.unattended}` as TranslationKey)}</small>
              </div>}
              <span className="pill">{t('pub.route.assisted')}</span>
              {route.blockers[0] && <small className="muted">{t('pub.route.missing')}: {t(`pub.blk.${route.blockers[0]}` as TranslationKey)}</small>}
              <div className="toolbar">
                <button className="btn ghost small" onClick={() => setOpen(open === n.id ? null : n.id)}>{open === n.id ? t('pub.hide') : t('pub.details')}</button>
              </div>
              <label className="switch-row"><input type="checkbox" checked={chosen.includes(n.id)} onChange={() => toggle(n.id)} /><span>{t('net.usePlan')}</span></label>
              {open === n.id && facts && <div className="stack" style={{ gap: '.4rem' }}>
                <strong>{t('pub.route.missing')}</strong>
                <ul className="list">{route.blockers.map((b) => <li key={b}><small>{t(`pub.blk.${b}` as TranslationKey)}</small></li>)}</ul>
                <strong>{t('pub.details')}</strong>
                <ul className="list">{facts.facts.map((f) => <li key={f}><small>{t(f)}</small></li>)}</ul>
                <small className="muted">{t('pub.checkedOn')}: {new Date(`${facts.checkedOn}T12:00:00`).toLocaleDateString(locale)}</small>
                <small>{t('pub.sources')}: {facts.sources.map((s, i) => <span key={s.url}>{i ? ' · ' : ''}<a href={s.url} target="_blank" rel="noopener noreferrer"><u>{s.label}</u></a></span>)}</small>
              </div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
