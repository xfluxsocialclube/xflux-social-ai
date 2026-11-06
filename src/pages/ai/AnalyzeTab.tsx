import { useEffect, useRef, useState } from 'react';
import { Notice } from '../../components/Notice';
import { CopyButton } from '../../components/CopyButton';
import { LOCALES, useI18n } from '../../i18n/I18nContext';
import type { TranslationKey } from '../../i18n/pt';
import { chatStream, isLocalUrl, OllamaError } from '../../services/ollama';
import { ANALYSIS_PROMPTS, LANG_NAMES, type AnalysisTask } from '../../services/ai/prompts';
import { imageToBase64, validateMedia, videoFrames } from '../../services/ai/frames';
import { readLibraryFile } from '../../services/library/fsStore';
import { importFiles, listMedia } from '../../services/library/library';
import type { MediaItem } from '../../services/library/types';
import { describeError } from './errors';
import type { OllamaCtx } from './useOllama';

export function AnalyzeTab({ ai }: { ai: OllamaCtx }) {
  const { t, locale } = useI18n();
  const [src, setSrc] = useState<'lib' | 'file'>('lib');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [libId, setLibId] = useState('');
  const [direct, setDirect] = useState<File | null>(null);
  const [task, setTask] = useState<AnalysisTask>('describe');
  const [frames, setFrames] = useState(3);
  const [lang, setLang] = useState<string>(locale);
  const [stage, setStage] = useState<'idle' | 'prep' | 'run'>('idle');
  const [out, setOut] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => { listMedia().then((m) => setItems(m.sort((a, b) => b.importedAt.localeCompare(a.importedAt)))); }, []);

  const run = async () => {
    setError(''); setInfo(''); setOut('');
    if (!ai.ready) { setError(t('ai.err.notready')); return; }
    if (ai.vision !== true) { setError(t('ai.an.needVision')); return; }
    let file: File | null = null;
    try {
      if (src === 'lib') { const it = items.find((i) => i.id === libId); if (it) file = await readLibraryFile(it.path); }
      else file = direct;
    } catch { setError(t('ai.an.noFolder')); return; }
    if (!file) { setError(t('ai.an.noFile')); return; }
    const bad = validateMedia(file);
    if (bad) { setError(t(bad)); return; }
    const ctrl = new AbortController(); abort.current = ctrl;
    setStage('prep');
    try {
      const images = file.type.startsWith('video/') ? await videoFrames(file, frames) : [await imageToBase64(file)];
      setStage('run');
      await chatStream({
        model: ai.model, url: ai.url, signal: ctrl.signal, onToken: (tk) => setOut((o) => o + tk),
        messages: [
          { role: 'system', content: `You are FLUX, an assistant that analyzes images for social media content. Describe only what is actually visible; never invent details. Answer in ${LANG_NAMES[lang] ?? 'English'}.` },
          { role: 'user', content: ANALYSIS_PROMPTS[task], images },
        ],
      });
    } catch (e) {
      setError(e instanceof OllamaError ? describeError(e, t) : t('ai.an.unreadable'));
    } finally { setStage('idle'); abort.current = null; }
  };
  const saveToLib = async () => {
    if (!direct) return;
    const r = await importFiles([direct]);
    setInfo(r.imported ? t('ai.an.saved') : r.duplicates ? t('ai.an.dup') : t('ai.an.notSaved'));
    setItems((await listMedia()).sort((a, b) => b.importedAt.localeCompare(a.importedAt)));
  };
  const busy = stage !== 'idle';
  return (
    <div className="stack">
      <Notice>{t('ai.an.localNote')} {t('ai.an.limits')}</Notice>
      {!isLocalUrl(ai.url) && <Notice tone="warn">{t('ai.an.remoteWarn')}</Notice>}
      {ai.ready && ai.vision === false && <Notice tone="warn">{t('ai.an.needVision')}</Notice>}
      <section className="card form">
        <label>{t('ai.an.source')}
          <select value={src} onChange={(e) => setSrc(e.target.value as 'lib' | 'file')}>
            <option value="lib">{t('ai.an.fromLib')}</option><option value="file">{t('ai.an.fromFile')}</option>
          </select>
        </label>
        {src === 'lib' ? (
          <label>{t('ai.an.pick')}
            <select value={libId} onChange={(e) => setLibId(e.target.value)}>
              <option value="">{items.length ? t('ai.an.pick') : t('ai.an.libEmpty')}</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </label>
        ) : (
          <div className="row">
            <input ref={input} type="file" accept="image/*,video/*" hidden onChange={(e) => { setDirect(e.target.files?.[0] ?? null); setInfo(''); }} />
            <button className="btn ghost" onClick={() => input.current?.click()}>{t('ai.an.choose')}</button>
            <span className="muted">{direct ? direct.name : t('ai.an.noFile')}</span>
            {direct && <button className="btn ghost" onClick={saveToLib}>{t('ai.an.saveLib')}</button>}
          </div>
        )}
        <label>{t('ai.an.task')}
          <select value={task} onChange={(e) => setTask(e.target.value as AnalysisTask)}>
            {(Object.keys(ANALYSIS_PROMPTS) as AnalysisTask[]).map((k) => <option key={k} value={k}>{t(`ai.an.t.${k}` as TranslationKey)}</option>)}
          </select>
        </label>
        <label>{t('ai.an.frames')}
          <input type="number" min={1} max={6} value={frames} onChange={(e) => setFrames(Math.max(1, Math.min(6, Number(e.target.value) || 1)))} />
        </label>
        <label>{t('ai.gen.outLang')}
          <select value={lang} onChange={(e) => setLang(e.target.value)}>{LOCALES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select>
        </label>
        <div className="wide row">
          {busy ? <button className="btn ghost" onClick={() => abort.current?.abort()}>{t('ai.stop')}</button> : <button className="btn" onClick={run}>{t('ai.an.run')}</button>}
          {stage === 'prep' && <span className="muted">{t('ai.an.preparing')}</span>}
          {stage === 'run' && <span className="muted">{t('ai.an.running')}</span>}
        </div>
      </section>
      {info && <Notice>{info}</Notice>}
      {error && <Notice tone="warn">{error}</Notice>}
      {out && (
        <section className="card">
          <div className="row between"><h2>{t('ai.gen.result')}</h2><CopyButton text={out} /></div>
          <pre className="output">{out}</pre>
          <small className="muted">{t('ai.gen.review')}</small>
        </section>
      )}
    </div>
  );
}
