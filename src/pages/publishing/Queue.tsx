import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { NetTag } from '../../components/NetTag';
import { Notice } from '../../components/Notice';
import { StatCard } from '../../components/StatCard';
import { useI18n } from '../../i18n/I18nContext';
import { fmt } from '../../i18n/format';
import type { TranslationKey } from '../../i18n/pt';
import { listCaptions } from '../../services/captions/store';
import type { Caption } from '../../services/captions/types';
import { listMedia } from '../../services/library/library';
import type { MediaItem } from '../../services/library/types';
import { NETWORKS } from '../../services/networks';
import { parseYmd } from '../../services/planner/dates';
import { confirmedBy, countStates, loadQueue, type QueueItem } from '../../services/publishing/queue';
import type { QueueState } from '../../services/publishing/types';
import type { PageId } from '../../config/nav';
import { PostDialog } from '../planner/Planner';

const STATES: QueueState[] = ['due', 'awaiting-user', 'failed', 'queued', 'published', 'blocked'];
const tone = (s: QueueState) => (s === 'published' ? 'ok' : s === 'failed' ? 'err' : s === 'due' || s === 'blocked' || s === 'awaiting-user' ? 'warn' : '');

/** Painel de status das publicações: o que está na fila, o que pede ação, o que foi confirmado e por quem. */
export function Queue({ onNavigate, onChanged }: { onNavigate: (p: PageId) => void; onChanged: () => void }) {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [media, setMedia] = useState<Map<string, MediaItem>>(new Map()); const [caps, setCaps] = useState<Map<string, Caption>>(new Map());
  const [state, setState] = useState<QueueState | ''>(''); const [net, setNet] = useState(''); const [limit, setLimit] = useState(50);
  const [openId, setOpenId] = useState<string | null>(null); const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try { const [q, m, c] = await Promise.all([loadQueue(), listMedia(), listCaptions()]); setItems(q); setMedia(new Map(m.map((x) => [x.id, x]))); setCaps(new Map(c.map((x) => [x.id, x]))); setError(false); }
    catch { setError(true); setItems([]); }
    onChanged();
  }, [onChanged]);
  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => countStates(items ?? []), [items]);
  const shown = useMemo(() => (items ?? []).filter((i) => i.state !== 'cancelled' && (!state || i.state === state) && (!net || i.post.network === net)), [items, state, net]);
  if (items === null) return <p className="muted">{t('lib.loading')}</p>;
  const live = openId ? items.find((i) => i.post.id === openId)?.post : undefined;
  const d = (day: string) => new Date(parseYmd(day)).toLocaleDateString(locale);
  return (
    <div className="stack">
      {error && <Notice tone="warn">{t('cb.err.load')}</Notice>}
      <Notice>{t('pub.honest')}</Notice>
      <section className="grid stats">
        {STATES.map((s) => <StatCard key={s} label={t(`pub.q.st.${s}` as TranslationKey)} value={counts[s]} />)}
      </section>
      <small className="muted">{t('pub.q.statNote')}</small>
      <section className="card toolbar">
        <select value={state} onChange={(e) => setState(e.target.value as QueueState | '')} aria-label={t('pub.q.all')}><option value="">{t('pub.q.all')}</option>{STATES.map((s) => <option key={s} value={s}>{t(`pub.q.st.${s}` as TranslationKey)}</option>)}</select>
        <select value={net} onChange={(e) => setNet(e.target.value)} aria-label={t('cb.allNets')}><option value="">{t('cb.allNets')}</option>{NETWORKS.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select>
        <button className="btn ghost" onClick={() => onNavigate('schedule')}>{t('nav.schedule')}</button>
        <button className="btn ghost" onClick={() => onNavigate('networks')}>{t('pub.int.title')}</button>
      </section>
      {shown.length === 0 ? <div className="card"><EmptyState title={t('pub.q.emptyTitle')} description={t('pub.q.emptyDesc')} /></div> : (
        <div className="card"><ul className="list">
          {shown.slice(0, limit).map(({ post, state: s }) => { const m = post.mediaId ? media.get(post.mediaId) : undefined; const by = confirmedBy(post); return (
            <li key={post.id}>
              <span className="row"><strong>{d(post.day)} {post.time}</strong><NetTag id={post.network} /><span className="media-name">{s === 'blocked' ? t('pl.st.pending') : m?.name ?? '—'}</span>
                <span className={`pill ${tone(s)}`}>{t(`pub.q.st.${s}` as TranslationKey)}</span>
                {by && <small className="muted">{t(`pub.q.confirmedBy.${by}` as TranslationKey)}</small>}
                {(post.delivery?.attempts.length ?? 0) > 0 && <small className="muted">{fmt(t('pub.q.attempts'), { n: post.delivery!.attempts.length })}</small>}</span>
              <button className="btn ghost small" onClick={() => setOpenId(post.id)}>{t('pl.open')}</button>
            </li>); })}
        </ul>{shown.length > limit && <div className="center"><button className="btn ghost small" onClick={() => setLimit(limit + 50)}>{t('pl.more')}</button></div>}</div>
      )}
      {live && <PostDialog post={live} media={live.mediaId ? media.get(live.mediaId) : undefined} caption={live.captionId ? caps.get(live.captionId) : undefined} onClose={() => setOpenId(null)} onChanged={refresh} onNavigate={onNavigate} />}
    </div>
  );
}
