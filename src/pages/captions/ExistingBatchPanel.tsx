import { useEffect, useMemo, useState } from 'react';
import { Notice } from '../../components/Notice';
import { useI18n } from '../../i18n/I18nContext';
import { parseHashtags, parseKeywords } from '../../services/captions/importer';
import { listCaptions, saveCaption } from '../../services/captions/store';
import type { Caption } from '../../services/captions/types';

type Batch = { id: string; rows: Caption[]; createdAt: string };

/** Reutiliza lotes já importados sem duplicar dados e permite revisar cada legenda em sequência. */
export function ExistingBatchPanel({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t, locale } = useI18n();
  const [all, setAll] = useState<Caption[]>([]);
  const [batchId, setBatchId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState({ product: '', category: '', text: '', cta: '', hashtags: '', keywords: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => { listCaptions().then(setAll).catch(() => setError(t('cb.err.load'))); }, [t]);
  const batches = useMemo<Batch[]>(() => {
    const map = new Map<string, Caption[]>();
    all.forEach((c) => map.set(c.batchId || 'legacy', [...(map.get(c.batchId || 'legacy') ?? []), c]));
    return [...map.entries()].map(([id, rows]) => ({ id, rows, createdAt: rows.reduce((a, c) => a < c.createdAt ? a : c.createdAt, rows[0]?.createdAt ?? '') })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [all]);
  useEffect(() => { if (!batchId && batches.length) { setBatchId(batches[0].id); setSelected(batches[0].rows.map((c) => c.id)); } }, [batches, batchId]);
  const batch = batches.find((b) => b.id === batchId) ?? batches[0];
  const chosen = batch?.rows.filter((c) => selected.includes(c.id)) ?? [];
  const current = chosen[index];

  useEffect(() => {
    if (!current) return;
    setFields({ product: current.product, category: current.category, text: current.text, cta: current.cta, hashtags: current.hashtags.join(' '), keywords: current.keywords.join(', ') });
  }, [current?.id]);

  const selectBatch = (id: string) => { setBatchId(id); const b = batches.find((x) => x.id === id); setSelected((b?.rows ?? []).map((c) => c.id)); setIndex(0); setEditing(false); };
  const saveNext = async () => {
    if (!current || !fields.text.trim()) { setError(t('cb.captionRequired')); return; }
    setBusy(true); setError('');
    try {
      const updated = await saveCaption({ ...current, product: fields.product.trim(), category: fields.category.trim(), text: fields.text.trim(), cta: fields.cta.trim(), hashtags: parseHashtags(fields.hashtags), keywords: parseKeywords(fields.keywords) });
      setAll((rows) => rows.map((row) => row.id === updated.id ? updated : row));
      const next = index + 1;
      if (next >= chosen.length) { setDone(true); setEditing(false); onSaved(); }
      else setIndex(next);
    } catch { setError(t('cb.err.save')); }
    finally { setBusy(false); }
  };

  if (editing && current) return (
    <div className="stack">
      <div className="row between"><button className="btn ghost small" onClick={() => setEditing(false)}>{t('cb.imp.back')}</button><span className="pill">{index + 1} / {chosen.length}</span></div>
      {error && <Notice tone="warn">{error}</Notice>}
      <strong>{current.ref ? `#${current.ref} · ` : ''}{current.product || t('cb.f.product')}</strong>
      <label>{t('cb.f.product')}<input className="search" value={fields.product} onChange={(e) => setFields({ ...fields, product: e.target.value })} /></label>
      <label>{t('cb.f.category')}<input className="search" value={fields.category} onChange={(e) => setFields({ ...fields, category: e.target.value })} /></label>
      <label>{t('cb.f.caption')}<textarea rows={6} value={fields.text} onChange={(e) => setFields({ ...fields, text: e.target.value })} /></label>
      <label>{t('cb.f.cta')}<input className="search" value={fields.cta} onChange={(e) => setFields({ ...fields, cta: e.target.value })} /></label>
      <label>{t('cb.f.hashtags')}<input className="search" value={fields.hashtags} onChange={(e) => setFields({ ...fields, hashtags: e.target.value })} /></label>
      <label>{t('cb.f.keywords')}<input className="search" value={fields.keywords} onChange={(e) => setFields({ ...fields, keywords: e.target.value })} /></label>
      <div className="modal-actions">
        <button className="btn ghost" disabled={busy || index === 0} onClick={() => setIndex(index - 1)}>{t('cb.prev')}</button>
        <button className="btn" disabled={busy} onClick={saveNext}>{index + 1 === chosen.length ? t('cb.saveFinish') : t('cb.saveNext')}</button>
      </div>
    </div>
  );

  return (
    <div className="stack">
      <div className="row between"><h2>{t('cb.existing.title')}</h2><button className="btn ghost small" onClick={onClose}>{t('cb.imp.back')}</button></div>
      {error && <Notice tone="warn">{error}</Notice>}
      {done ? <><Notice>{t('cb.existing.done')}</Notice><button className="btn" onClick={onClose}>{t('lib.close')}</button></> : batches.length === 0 ? <Notice>{t('cb.existing.none')}</Notice> : <>
        <p className="muted">{t('cb.existing.help')}</p>
        <label>{t('cb.existing.batch')}
          <select value={batch?.id ?? ''} onChange={(e) => selectBatch(e.target.value)}>
            {batches.map((b) => <option key={b.id} value={b.id}>{new Date(b.createdAt).toLocaleString(locale)} · {b.rows.length} {t('cb.existing.items')}</option>)}
          </select>
        </label>
        {batch && <>
          <div className="row between"><strong>{chosen.length} / {batch.rows.length} {t('cb.existing.selected')}</strong><div className="row"><button className="btn ghost small" onClick={() => setSelected(batch.rows.map((c) => c.id))}>{t('cb.existing.all')}</button><button className="btn ghost small" onClick={() => setSelected([])}>{t('cb.existing.noneSelected')}</button></div></div>
          <div className="stack" style={{ maxHeight: 260, overflowY: 'auto' }}>
            {batch.rows.map((c) => <label className="switch-row" key={c.id}><input type="checkbox" checked={selected.includes(c.id)} onChange={(e) => setSelected((v) => e.target.checked ? [...v, c.id] : v.filter((id) => id !== c.id))} /><span><strong>{c.product || c.ref || t('cb.f.caption')}</strong><br/><small className="muted">{c.text.slice(0, 140)}</small></span></label>)}
          </div>
          <button className="btn" disabled={!chosen.length} onClick={() => { setIndex(0); setEditing(true); setDone(false); }}>{t('cb.existing.review')}</button>
        </>}
      </>}
    </div>
  );
}
