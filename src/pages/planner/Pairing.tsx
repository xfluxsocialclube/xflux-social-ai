import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { EmptyState } from '../../components/EmptyState';
import { MediaThumb } from '../../components/MediaThumb';
import { Modal } from '../../components/Modal';
import { NetTag } from '../../components/NetTag';
import { Notice } from '../../components/Notice';
import { StatCard } from '../../components/StatCard';
import { useI18n } from '../../i18n/I18nContext';
import { fmt } from '../../i18n/format';
import type { TranslationKey } from '../../i18n/pt';
import { isAvailable, listCaptions } from '../../services/captions/store';
import { normKey } from '../../services/captions/text';
import type { Caption } from '../../services/captions/types';
import { listCategories, listMedia } from '../../services/library/library';
import type { Category, MediaItem } from '../../services/library/types';
import { applySuggestions, buildSuggestions, createPairing, listPairings, removePairings, savePairing, setPairingStatus } from '../../services/planner/pairing';
import type { MatchReason, Pairing } from '../../services/planner/types';
import type { PageId } from '../../config/nav';

type Tab = 'suggested' | 'confirmed' | 'pending' | 'unpaired';
type Picker = { kind: 'caption' | 'media'; pairing: Pairing } | { kind: 'forMedia'; media: MediaItem };

function reasonText(t: (k: TranslationKey) => string, r: MatchReason): string {
  return fmt(t(`pr.why.${r.kind}` as TranslationKey), { v: r.detail ?? '' });
}

function CaptionPicker({ captions, pairs, onPick, onClose }: { captions: Caption[]; pairs: Pairing[]; onPick: (c: Caption) => void; onClose: () => void }) {
  const { t } = useI18n(); const [q, setQ] = useState('');
  const taken = useMemo(() => new Set(pairs.filter((p) => p.status === 'confirmed').map((p) => p.captionId)), [pairs]);
  const list = useMemo(() => { const nq = normKey(q); return captions.filter((c) => !nq || normKey(`${c.text} ${c.product} ${c.ref} ${c.category}`).includes(nq)).slice(0, 80); }, [captions, q]);
  return (
    <Modal title={t('pr.pickCaption')} onClose={onClose}>
      <input className="search" style={{ width: '100%' }} autoFocus placeholder={t('cb.search')} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="pick-list">
        {list.length === 0 && <small className="muted">{t('cb.noResults')}</small>}
        {list.map((c) => (
          <button key={c.id} className="pick" onClick={() => onPick(c)}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong>{c.ref ? `#${c.ref} · ` : ''}{c.product || '—'}</strong><br /><small className="muted">{c.text.slice(0, 110)}</small>
            </span>
            {taken.has(c.id) && <span className="pill warn">{t('pr.alreadyPaired')}</span>}
            {!isAvailable(c) && <span className="pill warn">{t('pr.alreadyUsed')}</span>}
          </button>
        ))}
      </div>
    </Modal>
  );
}
function MediaPicker({ media, onPick, onClose }: { media: MediaItem[]; onPick: (m: MediaItem) => void; onClose: () => void }) {
  const { t } = useI18n(); const [q, setQ] = useState('');
  const list = useMemo(() => { const nq = normKey(q); return media.filter((m) => !nq || normKey(m.name).includes(nq)).slice(0, 80); }, [media, q]);
  return (
    <Modal title={t('pr.pickMedia')} onClose={onClose}>
      <input className="search" style={{ width: '100%' }} autoFocus placeholder={t('lib.search')} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="pick-list">
        {list.length === 0 && <small className="muted">{t('lib.noResults')}</small>}
        {list.map((m) => <button key={m.id} className="pick" onClick={() => onPick(m)}><MediaThumb item={m} size={48} /><span className="media-name">{m.name}</span></button>)}
      </div>
    </Modal>
  );
}

export function Pairing({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const { t } = useI18n();
  const [media, setMedia] = useState<MediaItem[] | null>(null);
  const [cats, setCats] = useState<Category[]>([]); const [caps, setCaps] = useState<Caption[]>([]); const [pairs, setPairs] = useState<Pairing[]>([]);
  const [tab, setTab] = useState<Tab>('suggested'); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null); const [manual, setManual] = useState<{ media: MediaItem | null; caption: Caption | null } | null>(null);
  const [confirmAll, setConfirmAll] = useState(false); const [removing, setRemoving] = useState<Pairing | null>(null);

  const refresh = useCallback(async () => {
    try { const [m, c, k, p] = await Promise.all([listMedia(), listCategories(), listCaptions(), listPairings()]); setMedia(m.sort((a, b) => a.name.localeCompare(b.name))); setCats(c); setCaps(k); setPairs(p); }
    catch { setError(t('cb.err.load')); setMedia([]); }
  }, [t]);
  useEffect(() => { refresh(); }, [refresh]);

  const mediaById = useMemo(() => new Map((media ?? []).map((m) => [m.id, m])), [media]);
  const capById = useMemo(() => new Map(caps.map((c) => [c.id, c])), [caps]);
  const pairedMedia = useMemo(() => new Set(pairs.map((p) => p.mediaId)), [pairs]);
  const unpaired = useMemo(() => (media ?? []).filter((m) => !pairedMedia.has(m.id)), [media, pairedMedia]);
  const by = (s: Pairing['status']) => pairs.filter((p) => p.status === s);
  const run = async (fn: () => Promise<unknown>) => { setError(null); setBusy(true); try { await fn(); await refresh(); } catch { setError(t('cb.err.save')); } finally { setBusy(false); } };

  const suggest = () => run(async () => {
    const sugs = await buildSuggestions(media ?? [], cats, caps, pairs);
    const n = await applySuggestions(sugs, pairs); setMsg(fmt(t(n ? 'pr.suggested' : 'pr.noneSuggested'), { n })); if (n) setTab('suggested');
  });
  const pick = async (c: Caption) => {
    if (!picker) return; const p = picker; setPicker(null);
    if (p.kind === 'caption') await run(() => savePairing({ ...p.pairing, captionId: c.id, source: 'manual', score: 0, reasons: [], status: 'confirmed' }));
    else if (p.kind === 'forMedia') await run(() => createPairing(p.media.id, c.id, 'confirmed', 'manual'));
  };
  const pickMedia = async (m: MediaItem) => {
    if (!picker || picker.kind !== 'media') return; const p = picker.pairing; setPicker(null);
    await run(() => savePairing({ ...p, mediaId: m.id, source: 'manual', score: 0, reasons: [], status: 'confirmed' }));
  };

  if (media === null) return <p className="muted">{t('lib.loading')}</p>;
  const needs = media.length === 0 || caps.length === 0;
  const list = tab === 'unpaired' ? [] : by(tab);
  const tabs: Tab[] = ['suggested', 'confirmed', 'pending', 'unpaired'];
  const count = (x: Tab) => (x === 'unpaired' ? unpaired.length : by(x).length);

  return (
    <div className="stack">
      {error && <Notice tone="warn">{error}</Notice>}
      <Notice>{t('pr.intro')}</Notice>
      {needs ? (
        <div className="card stack">
          <EmptyState title={t('pr.needTitle')} description={media.length === 0 && caps.length === 0 ? t('pr.needBoth') : media.length === 0 ? t('pr.needMedia') : t('pr.needCaptions')} />
          <div className="center row">
            {media.length === 0 && <button className="btn" onClick={() => onNavigate('library')}>{t('nav.library')}</button>}
            {caps.length === 0 && <button className="btn" onClick={() => onNavigate('captions')}>{t('nav.captions')}</button>}
          </div>
        </div>
      ) : (<>
        <section className="grid stats">
          <StatCard label={t('pr.stat.media')} value={media.length} />
          <StatCard label={t('pr.stat.captions')} value={caps.filter((c) => isAvailable(c)).length} />
          <StatCard label={t('pr.stat.confirmed')} value={by('confirmed').length} />
          <StatCard label={t('pr.stat.waiting')} value={by('suggested').length} />
          <StatCard label={t('pr.stat.unpaired')} value={unpaired.length} />
        </section>
        <section className="card stack">
          <div className="toolbar">
            <button className="btn" onClick={suggest} disabled={busy}>{t('pr.suggest')}</button>
            <button className="btn ghost" onClick={() => setConfirmAll(true)} disabled={busy || by('suggested').length === 0}>{t('pr.approveAll')}</button>
            <button className="btn ghost" onClick={() => setManual({ media: null, caption: null })} disabled={busy}>{t('pr.manual')}</button>
          </div>
          <small className="muted">{t('pr.rules')}</small>
          {msg && <Notice>{msg}</Notice>}
        </section>
        <div className="tabs" role="tablist">
          {tabs.map((x) => <button key={x} role="tab" aria-selected={tab === x} className={`tab ${tab === x ? 'active' : ''}`} onClick={() => setTab(x)}>{t(`pr.tab.${x}` as TranslationKey)} ({count(x)})</button>)}
        </div>
        {tab === 'unpaired' ? (
          unpaired.length === 0 ? <div className="card"><EmptyState title={t('pr.allPaired')} description={t('pr.allPairedDesc')} /></div> : (
            <div className="items">{unpaired.map((m) => (
              <article className="item" key={m.id}><MediaThumb item={m} /><div className="item-main"><strong className="media-name">{m.name}</strong><div className="item-actions"><button className="btn ghost small" onClick={() => setPicker({ kind: 'forMedia', media: m })}>{t('pr.chooseCaption')}</button></div></div></article>
            ))}</div>
          )
        ) : list.length === 0 ? <div className="card"><EmptyState title={t(`pr.empty.${tab}` as TranslationKey)} description={t(`pr.emptyDesc.${tab}` as TranslationKey)} /></div> : (
          <div className="items">
            {list.map((p) => {
              const m = mediaById.get(p.mediaId); const c = capById.get(p.captionId);
              return (
                <article className="item" key={p.id}>
                  <MediaThumb item={m} />
                  <div className="item-main">
                    <strong className="media-name">{m?.name ?? t('pr.missingMedia')}</strong>
                    {c ? <>
                      <div className="chips">{c.ref && <span className="pill">#{c.ref}</span>}{c.product && <span className="pill">{c.product}</span>}{c.networks.map((n) => <NetTag key={n} id={n} />)}</div>
                      <p className="item-text">{c.text}</p>
                    </> : <small className="warn-text">{t('pr.missingCaption')}</small>}
                    {p.reasons.length > 0 && <div className="chips"><small className="muted">{t('pr.why')}:</small>{p.reasons.map((r, i) => <span className="pill ok" key={i}>{reasonText(t, r)}</span>)}</div>}
                    <div className="item-actions">
                      {p.status !== 'confirmed' && <button className="btn small" onClick={() => run(() => setPairingStatus(p, 'confirmed'))} disabled={!m || !c || busy}>{t('pr.approve')}</button>}
                      <button className="btn ghost small" onClick={() => setPicker({ kind: 'caption', pairing: p })}>{t('pr.changeCaption')}</button>
                      <button className="btn ghost small" onClick={() => setPicker({ kind: 'media', pairing: p })}>{t('pr.changeMedia')}</button>
                      {p.status !== 'pending' && <button className="btn ghost small" onClick={() => run(() => setPairingStatus(p, 'pending'))}>{t('pr.leavePending')}</button>}
                      <button className="btn ghost small" onClick={() => setRemoving(p)}>{t('pr.remove')}</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </>)}

      {picker && picker.kind !== 'media' && <CaptionPicker captions={caps} pairs={pairs} onClose={() => setPicker(null)} onPick={pick} />}
      {picker && picker.kind === 'media' && <MediaPicker media={media} onClose={() => setPicker(null)} onPick={pickMedia} />}
      {manual && (
        <Modal title={t('pr.manual')} onClose={() => setManual(null)}>
          <div className="stack">
            <small className="muted">{t('pr.manualHelp')}</small>
            <div className="cols2">
              <div><strong>{t('pr.pickMedia')}</strong>{manual.media ? <div className="pick sel" style={{ marginTop: '.4rem' }}><MediaThumb item={manual.media} size={40} /><span className="media-name">{manual.media.name}</span></div> : null}
                <ManualList kind="media" media={media} captions={caps} onMedia={(m) => setManual({ ...manual, media: m })} onCaption={() => undefined} /></div>
              <div><strong>{t('pr.pickCaption')}</strong>{manual.caption ? <div className="pick sel" style={{ marginTop: '.4rem' }}><small>{manual.caption.text.slice(0, 80)}</small></div> : null}
                <ManualList kind="caption" media={media} captions={caps} onMedia={() => undefined} onCaption={(c) => setManual({ ...manual, caption: c })} /></div>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setManual(null)}>{t('lib.cancel')}</button>
            <button className="btn" disabled={!manual.media || !manual.caption || busy} onClick={() => { const x = manual; setManual(null); if (x.media && x.caption) run(() => createPairing(x.media!.id, x.caption!.id, 'confirmed', 'manual')); }}>{t('pr.approve')}</button>
          </div>
        </Modal>
      )}
      {confirmAll && <ConfirmModal title={t('pr.approveAll')} text={fmt(t('pr.approveAllText'), { n: by('suggested').length })} confirmLabel={t('pr.approveAll')} onCancel={() => setConfirmAll(false)} onConfirm={() => { setConfirmAll(false); run(async () => { for (const p of by('suggested')) await setPairingStatus(p, 'confirmed'); }); }} />}
      {removing && <ConfirmModal title={t('pr.removeTitle')} text={t('pr.removeText')} confirmLabel={t('pr.remove')} onCancel={() => setRemoving(null)} onConfirm={() => { const p = removing; setRemoving(null); run(() => removePairings([p.id])); }} />}
    </div>
  );
}

function ManualList({ kind, media, captions, onMedia, onCaption }: { kind: 'media' | 'caption'; media: MediaItem[]; captions: Caption[]; onMedia: (m: MediaItem) => void; onCaption: (c: Caption) => void }) {
  const { t } = useI18n(); const [q, setQ] = useState(''); const nq = normKey(q);
  return (
    <>
      <input className="search" style={{ width: '100%', marginTop: '.4rem' }} placeholder={t(kind === 'media' ? 'lib.search' : 'cb.search')} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="pick-list">
        {kind === 'media'
          ? media.filter((m) => !nq || normKey(m.name).includes(nq)).slice(0, 60).map((m) => <button key={m.id} className="pick" onClick={() => onMedia(m)}><MediaThumb item={m} size={36} /><span className="media-name">{m.name}</span></button>)
          : captions.filter((c) => !nq || normKey(`${c.text} ${c.product} ${c.ref}`).includes(nq)).slice(0, 60).map((c) => <button key={c.id} className="pick" onClick={() => onCaption(c)}><span><strong>{c.ref ? `#${c.ref} ` : ''}{c.product}</strong><br /><small className="muted">{c.text.slice(0, 70)}</small></span></button>)}
      </div>
    </>
  );
}
