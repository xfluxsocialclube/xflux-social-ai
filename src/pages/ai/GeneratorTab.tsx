import { useRef, useState } from 'react';
import { Notice } from '../../components/Notice';
import { CopyButton } from '../../components/CopyButton';
import { LOCALES, useI18n } from '../../i18n/I18nContext';
import type { TranslationKey } from '../../i18n/pt';
import { chatStream } from '../../services/ollama';
import { buildGeneral, buildShopee, PLATFORMS, SHOPEE_TASKS, STYLES, TASKS, type Platform, type ShopeeTask, type Style, type Task } from '../../services/ai/prompts';
import { describeError } from './errors';
import type { OllamaCtx } from './useOllama';

/** Gerador de conteúdo geral e ferramenta Shopee (mesma lógica, prompts diferentes). */
export function GeneratorTab({ ai, shopee }: { ai: OllamaCtx; shopee: boolean }) {
  const { t, locale } = useI18n();
  const [task, setTask] = useState<Task>('caption');
  const [sTask, setSTask] = useState<ShopeeTask>('caption');
  const [style, setStyle] = useState<Style>('professional');
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [lang, setLang] = useState<string>(locale);
  const [audience, setAudience] = useState('');
  const [count, setCount] = useState(3);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);

  const run = async () => {
    if (!ai.ready) { setError(t('ai.err.notready')); return; }
    if (shopee ? !name.trim() : !text.trim()) { setError(t('ai.gen.needInput')); return; }
    const { system, user } = shopee
      ? buildShopee({ task: sTask, style, lang, name, details, count })
      : buildGeneral({ task, style, platform, lang, text, audience, count });
    setOut(''); setError(''); setBusy(true);
    const ctrl = new AbortController(); abort.current = ctrl;
    try {
      await chatStream({ model: ai.model, url: ai.url, signal: ctrl.signal, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], onToken: (tk) => setOut((o) => o + tk) });
    } catch (e) { const m = describeError(e, t); if (m) setError(m); }
    finally { setBusy(false); abort.current = null; }
  };
  const plat = PLATFORMS.find((p) => p.id === platform)!;
  const over = !shopee && plat.maxChars !== undefined && out.length > plat.maxChars;

  return (
    <div className="stack">
      <section className="card form">
        <label>{t('ai.gen.task')}
          {shopee ? (
            <select value={sTask} onChange={(e) => setSTask(e.target.value as ShopeeTask)}>{SHOPEE_TASKS.map((x) => <option key={x} value={x}>{t(`ai.sp.${x}` as TranslationKey)}</option>)}</select>
          ) : (
            <select value={task} onChange={(e) => setTask(e.target.value as Task)}>{TASKS.map((x) => <option key={x} value={x}>{t(`ai.task.${x}` as TranslationKey)}</option>)}</select>
          )}
        </label>
        <label>{t('ai.gen.style')}
          <select value={style} onChange={(e) => setStyle(e.target.value as Style)}>{STYLES.map((x) => <option key={x} value={x}>{t(`ai.style.${x}` as TranslationKey)}</option>)}</select>
        </label>
        {!shopee && (
          <label>{t('ai.gen.platform')}
            <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>{PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.id === 'generic' ? t('ai.platform.generic') : p.name}</option>)}</select>
          </label>
        )}
        <label>{t('ai.gen.outLang')}
          <select value={lang} onChange={(e) => setLang(e.target.value)}>{LOCALES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select>
        </label>
        {(shopee ? ['caption', 'variations', 'cta', 'ideas'].includes(sTask) : task === 'variations' || task === 'cta' || task === 'title') && (
          <label>{t('ai.gen.count')}<input type="number" min={1} max={8} value={count} onChange={(e) => setCount(Math.max(1, Math.min(8, Number(e.target.value) || 1)))} /></label>
        )}
        {!shopee && <label>{t('ai.gen.audience')}<input type="text" className="search" value={audience} onChange={(e) => setAudience(e.target.value)} /></label>}
        {shopee ? (
          <>
            <label className="wide">{t('ai.sp.name')}<input type="text" className="search" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="wide">{t('ai.sp.details')}<textarea rows={5} value={details} placeholder={t('ai.sp.detailsPh')} onChange={(e) => setDetails(e.target.value)} /></label>
            <Notice>{t('ai.sp.note')}</Notice>
          </>
        ) : (
          <label className="wide">{t('ai.gen.input')}<textarea rows={5} value={text} placeholder={t('ai.gen.inputPh')} onChange={(e) => setText(e.target.value)} /></label>
        )}
        <div className="wide row">
          {busy ? <button className="btn ghost" onClick={() => abort.current?.abort()}>{t('ai.stop')}</button> : <button className="btn" onClick={run}>{t('ai.gen.run')}</button>}
        </div>
      </section>
      {error && <Notice tone="warn">{error}</Notice>}
      {(out || busy) && (
        <section className="card">
          <div className="row between"><h2>{t('ai.gen.result')}</h2><CopyButton text={out} /></div>
          <pre className="output">{out || t('ai.chat.thinking')}</pre>
          {!shopee && plat.maxChars !== undefined && <small className={over ? 'warn-text' : 'muted'}>{out.length} {t('ai.gen.chars')} · {t('ai.gen.limit')}: {plat.maxChars}{over ? ` — ${t('ai.gen.over')}` : ''}</small>}
          <div><small className="muted">{t('ai.gen.review')}</small></div>
        </section>
      )}
    </div>
  );
}
