import { useRef, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Notice } from '../../components/Notice';
import { Progress } from '../../components/Progress';
import { useI18n } from '../../i18n/I18nContext';
import { fmt } from '../../i18n/format';
import type { TranslationKey } from '../../i18n/pt';
import { decodeText, parseCsv } from '../../services/captions/csv';
import { detectMapping } from '../../services/captions/columns';
import { buildDrafts } from '../../services/captions/importer';
import { addCaptions, listCaptions } from '../../services/captions/store';
import { CAPTION_FIELDS, type CaptionField, type ColumnMapping, type ImportResult } from '../../services/captions/types';
import { openXlsx, type XlsxBook } from '../../services/captions/xlsx';
import { ExistingBatchPanel } from './ExistingBatchPanel';

const MAX_BYTES = 10 * 1024 * 1024; const MAX_ROWS = 20000;
type Step = 'pick' | 'map' | 'review' | 'done';
const colName = (i: number) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const FIELD_KEY: Record<CaptionField, TranslationKey> = {
  caption: 'cb.f.caption', product: 'cb.f.product', category: 'cb.f.category', ref: 'cb.f.ref', cta: 'cb.f.cta', hashtags: 'cb.f.hashtags', network: 'cb.f.networks', keywords: 'cb.f.keywords',
};

export function ImportDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('pick');
  const [fileName, setFileName] = useState('');
  const [book, setBook] = useState<XlsxBook | null>(null);
  const [sheet, setSheet] = useState(0);
  const [rows, setRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [rowBase, setRowBase] = useState(0);
  const [allowDup, setAllowDup] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [prog, setProg] = useState({ done: 0, total: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(0);
  const [existingOpen, setExistingOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const setData = (data: string[][]) => {
    // Linhas em branco do começo saem (guardamos quantas, para o número da linha bater com o do Excel);
    // as demais ficam, para serem contadas e para a numeração dos avisos continuar correta.
    const first = data.findIndex((r) => r.some((c) => c && c.trim()));
    if (first < 0) throw new Error('empty');
    const clean = data.slice(first);
    if (clean.length > MAX_ROWS + 1) throw new Error('rows');
    setRowBase(first);
    const m = detectMapping(clean[0], clean.slice(1, 40).filter((r) => r.some((c) => c && c.trim())));
    // A 1ª linha é tratada como cabeçalho quando só tem textos curtos com letras (o usuário pode mudar).
    setRows(clean); setMapping(m); setHasHeader(clean[0].every((c) => c.length < 60) && clean[0].some((c) => /[A-Za-zÀ-ÿ]/.test(c)));
  };
  const explain = (e: unknown): string => {
    const code = e instanceof Error ? e.message : '';
    if (code === 'empty') return t('cb.imp.err.empty');
    if (code === 'rows') return fmt(t('cb.imp.err.rows'), { n: MAX_ROWS });
    if (code === 'too-big') return fmt(t('cb.imp.err.big'), { mb: MAX_BYTES / 1048576 });
    if (['not-zip', 'not-xlsx', 'zip-method', 'zip64'].includes(code)) return t('cb.imp.err.broken');
    return t('cb.imp.err.generic');
  };
  const onFile = async (list: FileList | null) => {
    const f = list?.[0]; if (input.current) input.current.value = '';
    if (!f) return;
    setError(null); setBusy(true);
    try {
      const ext = (f.name.split('.').pop() ?? '').toLowerCase();
      if (!['xlsx', 'xlsm', 'csv', 'tsv', 'txt'].includes(ext)) { setError(t('cb.imp.err.format')); return; }
      if (f.size > MAX_BYTES) { setError(fmt(t('cb.imp.err.big'), { mb: MAX_BYTES / 1048576 })); return; }
      const buf = await f.arrayBuffer();
      setFileName(f.name); setSheet(0);
      if (ext === 'xlsx' || ext === 'xlsm') { const b = await openXlsx(buf); setBook(b); setData(await b.readSheet(0)); }
      else { setBook(null); setData(parseCsv(decodeText(buf))); }
      setStep('map');
    } catch (e) { setError(explain(e)); } finally { setBusy(false); }
  };
  const changeSheet = async (i: number) => {
    if (!book) return; setBusy(true); setError(null);
    try { setSheet(i); setData(await book.readSheet(i)); } catch (e) { setError(explain(e)); } finally { setBusy(false); }
  };
  const verify = async () => {
    if (!mapping || mapping.caption < 0) { setError(t('cb.imp.captionMissing')); return; }
    setError(null); setBusy(true); setProg({ done: 0, total: rows.length });
    try {
      const keys = new Set((await listCaptions()).map((c) => c.key));
      const r = await buildDrafts(rows, mapping, hasHeader, keys, { allowDuplicates: allowDup, rowBase, onProgress: (done, total) => setProg({ done, total }) });
      setResult(r); setStep('review');
    } catch (e) { setError(explain(e)); } finally { setBusy(false); }
  };
  const commit = async () => {
    if (!result?.ready.length) return;
    setBusy(true); setError(null);
    try { const n = await addCaptions(result.ready); setImported(n); setStep('done'); onImported(); }
    catch { setError(t('cb.err.save')); } finally { setBusy(false); }
  };

  const label = (i: number) => (hasHeader ? `${colName(i)} — ${rows[0]?.[i]?.trim() || '…'}` : fmt(t('cb.imp.col'), { c: colName(i) }));
  const nCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const body = (hasHeader ? rows.slice(1) : rows).filter((r) => r.some((c) => c && c.trim())).slice(0, 5);
  const skipped = result ? result.issues.filter((i) => ['missingCaption', 'duplicateInFile', 'duplicateInBank'].includes(i.kind)).length : 0;
  const shownIssues = result?.issues.slice(0, 30) ?? [];

  return (
    <Modal title={t('cb.imp.title')} onClose={busy ? () => undefined : onClose}>
      <div className="stack">
        {error && <Notice tone="warn">{error}</Notice>}

        {step === 'pick' && (existingOpen ? (
          <ExistingBatchPanel onClose={() => setExistingOpen(false)} onSaved={onImported} />
        ) : <>
          <h2>{t('cb.imp.step1')}</h2>
          <p className="muted">{t('cb.imp.help')}</p>
          <input ref={input} type="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt" onChange={(e) => onFile(e.target.files)} disabled={busy} />
          {busy && <small className="muted">{t('cb.imp.reading')}</small>}
          <div className="divider" />
          <button className="btn ghost" type="button" onClick={() => setExistingOpen(true)}>{t('cb.existing.open')}</button>
        </>)}

        {step === 'map' && mapping && (<>
          <h2>{t('cb.imp.step2')} <span className="pill">{fileName}</span></h2>
          <p className="muted">{t('cb.imp.mapHelp')}</p>
          {book && book.sheets.length > 1 && (
            <label className="row">{t('cb.imp.sheet')}:
              <select value={sheet} onChange={(e) => changeSheet(Number(e.target.value))} disabled={busy}>{book.sheets.map((s, i) => <option key={i} value={i}>{s}</option>)}</select>
            </label>
          )}
          <label className="switch-row"><input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} /><span>{t('cb.imp.hasHeader')}</span></label>
          <div className="form">
            {CAPTION_FIELDS.map((f) => (
              <label key={f}>{t(FIELD_KEY[f])}{f === 'caption' ? ` (${t('cb.imp.required')})` : ''}
                <select value={mapping[f]} onChange={(e) => setMapping({ ...mapping, [f]: Number(e.target.value) })}>
                  <option value={-1}>{t('cb.imp.notUse')}</option>
                  {Array.from({ length: nCols }, (_, i) => <option key={i} value={i}>{label(i)}</option>)}
                </select>
              </label>
            ))}
          </div>
          <h2>{t('cb.imp.preview')}</h2>
          <div className="tbl-wrap"><table className="tbl"><thead><tr>
            {CAPTION_FIELDS.filter((f) => mapping[f] >= 0).map((f) => <th key={f}>{t(FIELD_KEY[f])}</th>)}
          </tr></thead><tbody>
            {body.map((r, i) => <tr key={i}>{CAPTION_FIELDS.filter((f) => mapping[f] >= 0).map((f) => <td key={f}>{(r[mapping[f]] ?? '').slice(0, 90)}</td>)}</tr>)}
          </tbody></table></div>
          <label className="switch-row"><input type="checkbox" checked={allowDup} onChange={(e) => setAllowDup(e.target.checked)} /><span>{t('cb.imp.allowDup')}</span></label>
          {busy && <><Progress pct={prog.total ? (prog.done / prog.total) * 100 : 0} /><small className="muted">{fmt(t('cb.imp.checking'), prog)}</small></>}
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => { setStep('pick'); setError(null); }} disabled={busy}>{t('cb.imp.back')}</button>
            <button className="btn" onClick={verify} disabled={busy}>{t('cb.imp.check')}</button>
          </div>
        </>)}

        {step === 'review' && result && (<>
          <h2>{t('cb.imp.step3')}</h2>
          <ul className="list">
            <li><span className="good"><strong>{fmt(t('cb.imp.ready'), { n: result.ready.length })}</strong></span></li>
            {skipped > 0 && <li><span className="warn-text">{fmt(t('cb.imp.skipped'), { n: skipped })}</span></li>}
            {result.empty > 0 && <li><span className="muted">{fmt(t('cb.imp.emptyRows'), { n: result.empty })}</span></li>}
          </ul>
          {shownIssues.length > 0 && (
            <div className="stack" style={{ gap: '.3rem' }}>
              {shownIssues.map((i, k) => <small key={k} className="muted">{fmt(t(`cb.is.${i.kind}` as TranslationKey), { row: i.row, detail: i.detail ?? '' })}</small>)}
              {result.issues.length > shownIssues.length && <small className="muted">{fmt(t('cb.is.more'), { n: result.issues.length - shownIssues.length })}</small>}
            </div>
          )}
          {result.ready.length === 0 && <Notice tone="warn">{t('cb.imp.noneReady')}</Notice>}
          {busy && <small className="muted">{t('cb.imp.importing')}</small>}
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setStep('map')} disabled={busy}>{t('cb.imp.back')}</button>
            <button className="btn" onClick={commit} disabled={busy || result.ready.length === 0}>{fmt(t('cb.imp.confirm'), { n: result.ready.length })}</button>
          </div>
        </>)}

        {step === 'done' && (<>
          <Notice>{fmt(t('cb.imp.done'), { n: imported })}</Notice>
          <div className="modal-actions"><button className="btn" onClick={onClose}>{t('cb.imp.close')}</button></div>
        </>)}
      </div>
    </Modal>
  );
}
