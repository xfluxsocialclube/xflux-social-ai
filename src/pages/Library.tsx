import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Notice } from '../components/Notice';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { useI18n } from '../i18n/I18nContext';
import type { TranslationKey } from '../i18n/pt';
import { chooseFolder, getFolderStatus, readLibraryFile, requestAccess, type FolderStatus } from '../services/library/fsStore';
import { addCategory, deleteMedia, getUsage, importFiles, listCategories, listHistory, listMedia, repeatBlockedUntil, setItemCategory } from '../services/library/library';
import type { Category, HistoryEntry, ImportReport, MediaItem, UsageRecord } from '../services/library/types';
import { aiStatus } from '../services/ai';

const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function Thumb({ item }: { item: MediaItem }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!item.thumb) return;
    const u = URL.createObjectURL(item.thumb);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [item.thumb]);
  return <div className="thumb">{url ? <img src={url} alt={item.name} /> : <span>{item.ext.toUpperCase()}</span>}{item.kind === 'video' && <i className="play">▶</i>}</div>;
}

function Preview({ item, cats, onClose, onDelete, onChanged }: { item: MediaItem; cats: Category[]; onClose: () => void; onDelete: () => void; onChanged: (m: MediaItem) => void }) {
  const { t, locale } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [until, setUntil] = useState<Date | null>(null);
  useEffect(() => {
    let u: string | null = null;
    let alive = true;
    readLibraryFile(item.path).then((f) => { if (alive) { u = URL.createObjectURL(f); setUrl(u); } }).catch(() => alive && setMissing(true));
    getUsage(item.id).then((r) => alive && setUsage(r));
    repeatBlockedUntil(item.id).then((d) => alive && setUntil(d));
    return () => { alive = false; if (u) URL.revokeObjectURL(u); };
  }, [item.id, item.path]);
  const d = (iso: string) => new Date(iso).toLocaleString(locale);
  return (
    <Modal title={item.name} onClose={onClose}>
      <div className="preview">
        {missing ? <Notice tone="warn">{t('lib.fileMissing')}</Notice> : url && (item.kind === 'video' ? <video src={url} controls /> : <img src={url} alt={item.name} />)}
      </div>
      <ul className="list">
        <li><span>{t('lib.format')}</span><span>{item.ext.toUpperCase()} · {item.mime}</span></li>
        <li><span>{t('lib.size')}</span><span>{fmtSize(item.size)}{item.width ? ` · ${item.width}×${item.height}` : ''}</span></li>
        {item.duration ? <li><span>{t('lib.duration')}</span><span>{Math.round(item.duration)} s</span></li> : null}
        <li><span>{t('lib.date')}</span><span>{d(item.importedAt)}</span></li>
        <li><span>{t('lib.category')}</span>
          <select value={item.categoryId ?? ''} onChange={async (e) => onChanged(await setItemCategory(item, e.target.value || null))}>
            <option value="">{t('lib.noCat')}</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </li>
      </ul>
      <h2>{t('lib.usage')}</h2>
      {until && <Notice tone="warn">{t('lib.blocked')} {until.toLocaleDateString(locale)}</Notice>}
      {usage.length === 0 ? <small className="muted">{t('lib.usageEmpty')}</small> : (
        <ul className="list">{usage.map((u) => <li key={u.id}><span>{u.network}{u.postRef ? ` · ${u.postRef}` : ''}</span><span className="muted">{d(u.at)}</span></li>)}</ul>
      )}
      <h2>{t('lib.ai')} <span className="pill off">{t(aiStatus() === 'ready' ? 'lib.aiReady' : 'lib.aiOffPill')}</span></h2>
      <small className="muted">{t('lib.aiOff')}</small>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onDelete}>{t('lib.delete')}</button>
        <button className="btn" onClick={onClose}>{t('lib.close')}</button>
      </div>
    </Modal>
  );
}

export function Library() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<FolderStatus | 'loading'>('loading');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [hist, setHist] = useState<HistoryEntry[]>([]);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'all' | 'image' | 'video'>('all');
  const [cat, setCat] = useState('all');
  const [newCat, setNewCat] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [sel, setSel] = useState<MediaItem | null>(null);
  const [del, setDel] = useState<MediaItem | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const [i, c, h] = await Promise.all([listMedia(), listCategories(), listHistory(30)]);
    setItems(i.sort((a, b) => b.importedAt.localeCompare(a.importedAt)));
    setCats(c.sort((a, b) => a.name.localeCompare(b.name)));
    setHist(h);
  }, []);
  useEffect(() => { getFolderStatus().then(setStatus); refresh(); }, [refresh]);

  const shown = useMemo(() => items.filter((m) =>
    (kind === 'all' || m.kind === kind) &&
    (cat === 'all' || (cat === 'none' ? m.categoryId === null : m.categoryId === cat)) &&
    m.name.toLowerCase().includes(q.trim().toLowerCase())), [items, q, kind, cat]);

  const onFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (input.current) input.current.value = '';
    if (!files.length) return;
    setBusy(true); setReport(null);
    try { setReport(await importFiles(files)); } finally { setBusy(false); await refresh(); }
  };
  const pick = async () => { try { await chooseFolder(); setStatus(await getFolderStatus()); } catch { /* usuário cancelou */ } };
  const reconnect = async () => { await requestAccess(); setStatus(await getFolderStatus()); };
  const confirmDelete = async () => {
    if (!del) return;
    try { await deleteMedia(del); } finally { setDel(null); setSel(null); await refresh(); }
  };

  if (status === 'loading') return <p className="muted">{t('lib.loading')}</p>;
  if (status === 'unsupported') return <Notice tone="warn">{t('lib.unsupported')}</Notice>;
  if (status === 'none' || status === 'needs-permission') {
    const first = status === 'none';
    return (
      <div className="stack">
        <div className="card">
          <EmptyState title={t(first ? 'lib.folderTitle' : 'lib.reconnectTitle')} description={t(first ? 'lib.folderDesc' : 'lib.reconnectDesc')} />
          <div className="center"><button className="btn" onClick={first ? pick : reconnect}>{t(first ? 'lib.chooseFolder' : 'lib.reconnect')}</button></div>
        </div>
        <Notice>{t('lib.limits')}</Notice>
        {items.length > 0 && <small className="muted">{items.length} {t('lib.count')}</small>}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <button className="btn" disabled={busy} onClick={() => input.current?.click()}>{busy ? t('lib.importing') : t('lib.import')}</button>
        <input ref={input} type="file" multiple accept="image/*,video/*" hidden onChange={(e) => onFiles(e.target.files)} />
        <input className="search" type="search" placeholder={t('lib.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('lib.search')} />
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label={t('lib.allTypes')}>
          <option value="all">{t('lib.allTypes')}</option><option value="image">{t('lib.images')}</option><option value="video">{t('lib.videos')}</option>
        </select>
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t('lib.allCats')}>
          <option value="all">{t('lib.allCats')}</option><option value="none">{t('lib.noCat')}</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <form className="toolbar-inline" onSubmit={async (e) => { e.preventDefault(); await addCategory(newCat); setNewCat(''); refresh(); }}>
          <input type="text" className="search" placeholder={t('lib.catName')} value={newCat} onChange={(e) => setNewCat(e.target.value)} aria-label={t('lib.newCat')} />
          <button className="btn ghost" type="submit" disabled={!newCat.trim()}>{t('lib.addCat')}</button>
        </form>
      </div>
      {report && (
        <Notice tone={report.rejected.length ? 'warn' : 'info'}>
          <strong>{t('lib.report')}:</strong> {report.imported} {t('lib.rImported')} · {report.duplicates} {t('lib.rDup')}
          {report.rejected.length > 0 && <> · {report.rejected.length} {t('lib.rRejected')}: {report.rejected.map((r) => `${r.name} (${t(`lib.rej.${r.reason}` as TranslationKey)})`).join(', ')}</>}
        </Notice>
      )}
      {items.length === 0 ? (
        <div className="card"><EmptyState title={t('lib.empty')} description={t('lib.emptyDesc')} /></div>
      ) : shown.length === 0 ? (
        <div className="card"><EmptyState title={t('lib.noResults')} description="" /></div>
      ) : (
        <div className="media-grid">
          {shown.map((m) => (
            <button key={m.id} className="card media" onClick={() => setSel(m)}>
              <Thumb item={m} />
              <strong className="media-name" title={m.name}>{m.name}</strong>
              <small className="muted">{m.ext.toUpperCase()} · {fmtSize(m.size)}</small>
              <small className="muted">{new Date(m.importedAt).toLocaleDateString(locale)}</small>
            </button>
          ))}
        </div>
      )}
      <section className="card">
        <h2>{t('lib.history')}</h2>
        {hist.length === 0 ? <small className="muted">{t('lib.historyEmpty')}</small> : (
          <ul className="list">{hist.map((h) => <li key={h.id}><span>{t(`lib.act.${h.action}` as TranslationKey)} · {h.name}</span><span className="muted">{new Date(h.at).toLocaleString(locale)}</span></li>)}</ul>
        )}
      </section>
      {sel && !del && <Preview item={sel} cats={cats} onClose={() => setSel(null)} onDelete={() => setDel(sel)} onChanged={(m) => { setSel(m); refresh(); }} />}
      {del && (
        <Modal title={t('lib.deleteTitle')} onClose={() => setDel(null)}>
          <p>{del.name}</p><p className="muted">{t('lib.deleteDesc')}</p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setDel(null)}>{t('lib.cancel')}</button>
            <button className="btn" onClick={confirmDelete}>{t('lib.delete')}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
