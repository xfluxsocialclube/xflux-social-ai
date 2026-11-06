import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { CopyButton } from '../../components/CopyButton';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { NetTag } from '../../components/NetTag';
import { Notice } from '../../components/Notice';
import { StatCard } from '../../components/StatCard';
import { useI18n } from '../../i18n/I18nContext';
import { fmt } from '../../i18n/format';
import { parseHashtags, parseKeywords } from '../../services/captions/importer';
import { buildExportRows, exportCsv, exportXlsx, type ExportHeaders } from '../../services/captions/exportData';
import { clearCaptionUse, composeCaption, duplicateKeys, isAvailable, lastUsed, listCaptions, markCaptionUsed, removeCaptions, saveCaption } from '../../services/captions/store';
import { normKey } from '../../services/captions/text';
import type { Caption } from '../../services/captions/types';
import { NETWORKS } from '../../services/networks';
import { ImportDialog } from './ImportDialog';

const PAGE = 50;
type Status = 'all' | 'available' | 'used' | 'dup';

function EditDialog({ caption, dupKeys, onClose, onSaved }: { caption: Caption; dupKeys: Map<string, number>; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ ref: caption.ref, product: caption.product, category: caption.category, text: caption.text, cta: caption.cta, hashtags: caption.hashtags.join(' '), keywords: caption.keywords.join(', '), networks: caption.networks });
  const [err, setErr] = useState<string | null>(null);
  const dup = normKey(f.text) !== caption.key && (dupKeys.get(normKey(f.text)) ?? 0) > 0;
  const save = async () => {
    if (!f.text.trim()) { setErr(t('cb.captionRequired')); return; }
    try { await saveCaption({ ...caption, ref: f.ref.trim(), product: f.product.trim(), category: f.category.trim(), text: f.text.trim(), cta: f.cta.trim(), hashtags: parseHashtags(f.hashtags), keywords: parseKeywords(f.keywords), networks: f.networks }); onSaved(); }
    catch { setErr(t('cb.err.save')); }
  };
  return (
    <Modal title={t('cb.edit')} onClose={onClose}>
      <div className="stack">
        {err && <Notice tone="warn">{err}</Notice>}
        {dup && <Notice tone="warn">{t('cb.editDup')}</Notice>}
        <div className="form">
          <label>{t('cb.f.ref')}<input className="search" value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} /></label>
          <label>{t('cb.f.product')}<input className="search" value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })} /></label>
          <label>{t('cb.f.category')}<input className="search" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></label>
          <label className="wide">{t('cb.f.caption')}<textarea rows={5} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></label>
          <label className="wide">{t('cb.f.cta')}<input className="search" value={f.cta} onChange={(e) => setF({ ...f, cta: e.target.value })} /></label>
          <label className="wide">{t('cb.f.hashtags')}<input className="search" value={f.hashtags} onChange={(e) => setF({ ...f, hashtags: e.target.value })} /></label>
          <label className="wide">{t('cb.f.keywords')}<input className="search" value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} /></label>
        </div>
        <div><small className="muted">{t('cb.f.networks')}</small>
          <div className="chips" style={{ marginTop: '.4rem' }}>
            {NETWORKS.map((n) => { const on = f.networks.includes(n.id); return <button key={n.id} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setF({ ...f, networks: on ? f.networks.filter((x) => x !== n.id) : [...f.networks, n.id] })}>{n.name}</button>; })}
          </div>
        </div>
      </div>
      <div className="modal-actions"><button className="btn ghost" onClick={onClose}>{t('lib.cancel')}</button><button className="btn" onClick={save}>{t('cb.save')}</button></div>
    </Modal>
  );
}

export function CaptionBank() {
  const { t, locale } = useI18n();
  const [list, setList] = useState<Caption[] | null>(null);
  const [q, setQ] = useState(''); const [product, setProduct] = useState(''); const [category, setCategory] = useState('');
  const [net, setNet] = useState(''); const [status, setStatus] = useState<Status>('all'); const [page, setPage] = useState(0);
  const [importing, setImporting] = useState(false); const [editing, setEditing] = useState<Caption | null>(null);
  const [deleting, setDeleting] = useState<Caption | null>(null); const [releasing, setReleasing] = useState<Caption | null>(null); const [removingDups, setRemovingDups] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => { try { setList((await listCaptions()).sort((a, b) => (Number(a.ref) || 1e12) - (Number(b.ref) || 1e12) || a.createdAt.localeCompare(b.createdAt))); } catch { setError(t('cb.err.load')); setList([]); } }, [t]);
  useEffect(() => { refresh(); }, [refresh]);

  const all = list ?? [];
  const dups = useMemo(() => duplicateKeys(all), [all]);
  const dupCount = useMemo(() => { const m = new Map<string, number>(); all.forEach((c) => m.set(c.key, (m.get(c.key) ?? 0) + 1)); return m; }, [all]);
  const index = useMemo(() => all.map((c) => normKey([c.text, c.product, c.category, c.ref, c.keywords.join(' '), c.hashtags.join(' ')].join(' '))), [all]);
  const products = useMemo(() => Array.from(new Set(all.map((c) => c.product).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [all]);
  const categories = useMemo(() => Array.from(new Set(all.map((c) => c.category).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [all]);
  const shown = useMemo(() => {
    const nq = normKey(q);
    return all.filter((c, i) => (!nq || index[i].includes(nq)) && (!product || c.product === product) && (!category || c.category === category)
      && (!net || c.networks.length === 0 || c.networks.includes(net))
      && (status === 'all' || (status === 'available' && isAvailable(c)) || (status === 'used' && c.usedAt.length > 0) || (status === 'dup' && dups.has(c.key))));
  }, [all, index, q, product, category, net, status, dups]);
  useEffect(() => setPage(0), [q, product, category, net, status]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE)); const cur = Math.min(page, pages - 1);
  const visible = shown.slice(cur * PAGE, cur * PAGE + PAGE);

  const act = async (fn: () => Promise<unknown>) => { setError(null); try { await fn(); await refresh(); } catch { setError(t('cb.err.save')); } };
  const heads: ExportHeaders = { ref: t('cb.x.ref'), product: t('cb.x.product'), category: t('cb.x.category'), caption: t('cb.x.caption'), cta: t('cb.x.cta'), hashtags: t('cb.x.hashtags'), network: t('cb.x.network'), keywords: t('cb.x.keywords'), used: t('cb.x.used'), usedCount: t('cb.x.usedCount') };
  const template = () => exportXlsx([[heads.ref, heads.product, heads.category, heads.caption, heads.cta, heads.hashtags, heads.network, heads.keywords]], `${t('cb.templateName')}.xlsx`);
  const prompt = t('cb.promptBody');
  const removeDupList = () => {
    const seen = new Set<string>(); const ids: string[] = [];
    all.forEach((c) => { if (seen.has(c.key)) ids.push(c.id); else seen.add(c.key); });
    return ids;
  };
  const d = (iso: string) => new Date(iso).toLocaleDateString(locale);

  if (list === null) return <p className="muted">{t('lib.loading')}</p>;
  const usedCount = all.filter((c) => c.usedAt.length > 0).length;
  const availCount = all.filter((c) => isAvailable(c)).length;

  return (
    <div className="stack">
      {error && <Notice tone="warn">{error}</Notice>}
      <Notice>{t('cb.intro')}</Notice>
      {all.length === 0 ? (
        <div className="card stack">
          <EmptyState title={t('cb.emptyTitle')} description={t('cb.emptyDesc')} />
          <div className="center row"><button className="btn" onClick={() => setImporting(true)}>{t('cb.import')}</button><button className="btn ghost" onClick={template}>{t('cb.template')}</button></div>
          <section>
            <h2>{t('cb.promptTitle')}</h2>
            <p className="output">{prompt}</p>
            <CopyButton text={prompt} />
          </section>
        </div>
      ) : (<>
        <section className="grid stats">
          <StatCard label={t('cb.stat.total')} value={all.length} />
          <StatCard label={t('cb.stat.available')} value={availCount} />
          <StatCard label={t('cb.stat.used')} value={usedCount} />
          <StatCard label={t('cb.stat.dups')} value={all.filter((c) => dups.has(c.key)).length} />
        </section>
        <section className="card stack">
          <div className="toolbar">
            <button className="btn" onClick={() => setImporting(true)}>{t('cb.import')}</button>
            <button className="btn ghost" onClick={() => exportCsv(buildExportRows(shown, heads), `${t('cb.exportName')}.csv`)}>{t('cb.exportCsv')}</button>
            <button className="btn ghost" onClick={() => exportXlsx(buildExportRows(shown, heads), `${t('cb.exportName')}.xlsx`)}>{t('cb.exportXlsx')}</button>
            <button className="btn ghost" onClick={template}>{t('cb.template')}</button>
            {dups.size > 0 && <button className="btn ghost" onClick={() => setRemovingDups(true)}>{t('cb.removeDups')}</button>}
          </div>
          <div className="toolbar">
            <input className="search" style={{ flex: 1, minWidth: 200 }} placeholder={t('cb.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('cb.search')} />
            <select value={product} onChange={(e) => setProduct(e.target.value)} aria-label={t('cb.f.product')}><option value="">{t('cb.allProducts')}</option>{products.map((p) => <option key={p} value={p}>{p}</option>)}</select>
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t('cb.f.category')}><option value="">{t('cb.allCats')}</option>{categories.map((p) => <option key={p} value={p}>{p}</option>)}</select>
            <select value={net} onChange={(e) => setNet(e.target.value)} aria-label={t('cb.f.networks')}><option value="">{t('cb.allNets')}</option>{NETWORKS.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select>
            <select value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label={t('cb.allStatus')}>
              <option value="all">{t('cb.allStatus')}</option><option value="available">{t('cb.st.available')}</option><option value="used">{t('cb.st.used')}</option><option value="dup">{t('cb.st.dup')}</option>
            </select>
          </div>
          <small className="muted">{fmt(t('cb.showing'), { n: shown.length, total: all.length })}</small>
        </section>
        {shown.length === 0 ? <div className="card"><EmptyState title={t('cb.noResultsTitle')} description={t('cb.noResults')} /></div> : (
          <div className="items">
            {visible.map((c) => {
              const last = lastUsed(c); const avail = isAvailable(c);
              return (
                <article className="item" key={c.id}>
                  <div className="item-main">
                    <div className="chips">
                      {c.ref && <span className="pill">#{c.ref}</span>}
                      {c.product && <strong>{c.product}</strong>}
                      {c.category && <span className="pill">{c.category}</span>}
                      {c.networks.length === 0 ? <span className="pill">{t('cb.anyNet')}</span> : c.networks.map((n) => <NetTag key={n} id={n} />)}
                      {last ? <span className={`pill ${avail ? 'ok' : 'warn'}`}>{fmt(t('cb.usedOn'), { d: d(last) })}{c.usedAt.length > 1 ? ` · ${c.usedAt.length}×` : ''}</span> : <span className="pill ok">{t('cb.st.availableOne')}</span>}
                      {dups.has(c.key) && <span className="pill err">{fmt(t('cb.dupTag'), { n: dupCount.get(c.key) ?? 2 })}</span>}
                    </div>
                    <p className="item-text">{c.text}</p>
                    {(c.cta || c.hashtags.length > 0) && <small className="muted">{[c.cta, c.hashtags.join(' ')].filter(Boolean).join(' · ')}</small>}
                    <div className="item-actions">
                      <CopyButton text={composeCaption(c)} />
                      <button className="btn ghost small" onClick={() => setEditing(c)}>{t('cb.edit')}</button>
                      {c.usedAt.length === 0 ? <button className="btn ghost small" onClick={() => act(() => markCaptionUsed(c))}>{t('cb.markUsed')}</button> : <button className="btn ghost small" onClick={() => setReleasing(c)}>{t('cb.release')}</button>}
                      <button className="btn ghost small" onClick={() => setDeleting(c)}>{t('cb.delete')}</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {pages > 1 && (
          <div className="pager">
            <button className="btn ghost small" disabled={cur === 0} onClick={() => setPage(cur - 1)}>{t('cb.prev')}</button>
            <span className="muted">{fmt(t('cb.page'), { p: cur + 1, n: pages })}</span>
            <button className="btn ghost small" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>{t('cb.next')}</button>
          </div>
        )}
      </>)}

      {importing && <ImportDialog onClose={() => setImporting(false)} onImported={refresh} />}
      {editing && <EditDialog caption={editing} dupKeys={dupCount} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
      {deleting && <ConfirmModal title={t('cb.deleteTitle')} text={t('cb.deleteText')} confirmLabel={t('cb.delete')} onCancel={() => setDeleting(null)} onConfirm={() => { const c = deleting; setDeleting(null); act(() => removeCaptions([c.id])); }} />}
      {releasing && <ConfirmModal title={t('cb.releaseTitle')} text={t('cb.releaseText')} confirmLabel={t('cb.release')} onCancel={() => setReleasing(null)} onConfirm={() => { const c = releasing; setReleasing(null); act(() => clearCaptionUse(c)); }} />}
      {removingDups && <ConfirmModal title={t('cb.removeDupsTitle')} text={fmt(t('cb.removeDupsText'), { n: removeDupList().length })} confirmLabel={t('cb.removeDups')} onCancel={() => setRemovingDups(false)} onConfirm={() => { const ids = removeDupList(); setRemovingDups(false); act(() => removeCaptions(ids)); }} />}
    </div>
  );
}
