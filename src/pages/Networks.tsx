import { useCallback, useEffect, useRef, useState } from 'react';
import { Notice } from '../components/Notice';
import { useI18n } from '../i18n/I18nContext';
import type { TranslationKey } from '../i18n/pt';
import { ADAPTERS } from '../services/publishing/adapters';
import { getFacts } from '../services/publishing/catalog';
import { planRoute } from '../services/publishing/delivery';
import { getPlanNetworks, setPlanNetworks } from '../services/planner/plans';
import {
  connectMetaAuthorization,
  disconnectMetaAuthorization,
  getMetaAuthorizationState,
  MetaCancelled,
  type MetaAuthorizationState,
} from '../services/oauth/meta';

export function Networks() {
  const { t, locale } = useI18n();
  const [chosen, setChosen] = useState<string[]>(() => getPlanNetworks());
  const [open, setOpen] = useState<string | null>(null);
  const [metaState, setMetaState] = useState<MetaAuthorizationState>('none');
  const [metaBusy, setMetaBusy] = useState(false);
  const [metaMessage, setMetaMessage] = useState<string | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaUrl, setMetaUrl] = useState<string | null>(null);
  const metaAbort = useRef<AbortController | null>(null);

  const refreshMeta = useCallback(async () => {
    try { setMetaState(await getMetaAuthorizationState()); }
    catch { setMetaState('none'); }
  }, []);

  useEffect(() => { void refreshMeta(); }, [refreshMeta]);
  // Sair da tela cancela a espera da autorização, para o botão nunca ficar preso.
  useEffect(() => () => { metaAbort.current?.abort(); }, []);

  const toggle = (id: string) => {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
    setChosen(next); setPlanNetworks(next);
  };

  const connectMeta = async () => {
    if (metaBusy) return;
    const ctrl = new AbortController();
    metaAbort.current = ctrl;
    setMetaBusy(true); setMetaError(null); setMetaUrl(null); setMetaMessage('Preparando a conexão segura...');
    try {
      await connectMetaAuthorization(setMetaMessage, { signal: ctrl.signal, onAuthorizationUrl: setMetaUrl });
      await refreshMeta();
      setMetaMessage('Autorização Meta salva no cofre seguro do Windows. A identificação das contas e as permissões ainda serão verificadas.');
    } catch (error) {
      if (error instanceof MetaCancelled) {
        setMetaMessage('Conexão cancelada. Você pode tentar de novo.');
      } else {
        setMetaError(error instanceof Error ? error.message : 'Não foi possível conectar à Meta.');
        setMetaMessage(null);
      }
    } finally {
      if (metaAbort.current === ctrl) { metaAbort.current = null; setMetaBusy(false); setMetaUrl(null); }
    }
  };

  const cancelMeta = () => metaAbort.current?.abort();

  const copyMetaLink = async () => {
    if (!metaUrl) return;
    try {
      await navigator.clipboard.writeText(metaUrl);
      setMetaMessage('Link copiado. Cole no navegador que você usa e conclua a autorização.');
    } catch {
      setMetaError('Não foi possível copiar o link.');
    }
  };

  const disconnectMeta = async () => {
    setMetaBusy(true); setMetaError(null);
    try {
      await disconnectMetaAuthorization();
      await refreshMeta();
      setMetaMessage('A credencial Meta foi removida do cofre seguro deste computador.');
    } catch (error) {
      setMetaError(error instanceof Error ? error.message : 'Não foi possível remover a autorização.');
    } finally { setMetaBusy(false); }
  };

  return (
    <div className="stack">
      <h2 style={{ margin: 0 }}>{t('pub.int.title')}</h2>
      <Notice>O XFLUX funciona no dispositivo do cliente. Vídeos, legendas, calendário, fila e histórico permanecem no armazenamento escolhido pelo próprio cliente. O serviço seguro é usado somente para concluir a autorização da rede social.</Notice>
      <Notice>Primeira etapa da Meta: o login oficial e a transferência segura da credencial estão sendo integrados. Mesmo após autorizar, a identificação da conta, a validação das permissões e a publicação por API ainda precisam ser concluídas. Nenhuma publicação será simulada.</Notice>
      {metaMessage && <Notice>{metaMessage}</Notice>}
      {metaError && <Notice tone="warn">{metaError}</Notice>}
      {metaState === 'saved' && <Notice>A autorização Meta está salva no cofre seguro do Windows. Instagram e Facebook ainda não serão apresentados como contas verificadas até consultarmos os dados oficiais da Meta.</Notice>}
      {metaState === 'expired' && <Notice tone="warn">A autorização Meta salva neste computador expirou. Faça a conexão novamente.</Notice>}

      <div className="card" style={{ alignItems: 'stretch', textAlign: 'left' }}>
        <strong>Conta Meta — Facebook + Instagram</strong>
        <small className="muted">Uma única autorização oficial para disponibilizar os ativos do Facebook e do Instagram que sua conta tiver permissão para acessar.</small>
        <div className="toolbar">
          <button className="btn small" disabled={metaBusy} onClick={() => void connectMeta()}>
            {metaBusy ? 'Aguardando autorização...' : metaState === 'saved' ? 'Refazer autorização Meta' : 'Conectar Facebook + Instagram'}
          </button>
          {metaBusy && <button className="btn ghost small" onClick={cancelMeta}>Cancelar</button>}
          {metaBusy && metaUrl && <button className="btn ghost small" onClick={() => void copyMetaLink()}>Copiar link de autorização</button>}
          {metaState !== 'none' && <button className="btn ghost small" disabled={metaBusy} onClick={() => void disconnectMeta()}>Desconectar Meta</button>}
        </div>
      </div>
      <div className="grid nets">
        {ADAPTERS.map((n) => {
          const facts = getFacts(n.id);
          const route = planRoute(n.id);
          const usesMeta = n.id === 'instagram' || n.id === 'facebook';
          return (
            <div className="card net" key={n.id} style={{ alignItems: 'stretch', textAlign: 'left' }}>
              <div className="row"><div className="net-dot" style={{ background: n.color }}>{n.name[0]}</div><strong>{n.priority}. {n.name}</strong></div>
              <div className="row">
                {usesMeta && metaState === 'saved'
                  ? <span className="pill ok">Autorização Meta salva</span>
                  : usesMeta && metaState === 'expired'
                    ? <span className="pill warn">Autorização expirada</span>
                    : <span className="pill off">{t('pub.conn.not-connected')}</span>}
              </div>
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
              {usesMeta && <small className="muted">Este serviço usa a autorização única da Meta exibida acima. A conta e as permissões específicas ainda serão identificadas pela consulta oficial à Meta.</small>}
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
