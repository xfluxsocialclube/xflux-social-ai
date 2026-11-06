import { useState } from 'react';
import { Notice } from '../../components/Notice';
import { useI18n } from '../../i18n/I18nContext';
import { isLocalUrl } from '../../services/ollama';
import type { OllamaCtx } from './useOllama';

const TEXT_MODELS = [['llama3.2:1b', '≈1.3 GB'], ['llama3.2:3b', '≈2 GB'], ['qwen2.5:3b', '≈1.9 GB']];
const VISION_MODELS = [['moondream', '≈1.7 GB'], ['gemma3:4b', '≈3.3 GB']];
const gb = (b: number) => `${(b / 1073741824).toFixed(1)} GB`;

export function SetupTab({ ai }: { ai: OllamaCtx }) {
  const { t } = useI18n();
  const [url, setUrl] = useState(ai.url);
  return (
    <div className="stack">
      <section className="card form">
        <label className="wide">{t('ai.su.url')}
          <input type="text" className="search" value={url} onChange={(e) => setUrl(e.target.value)} spellCheck={false} />
        </label>
        <div className="wide row">
          <button className="btn" onClick={() => ai.changeUrl(url)}>{t('ai.su.test')}</button>
          <span className={`pill ${ai.state === 'connected' ? 'ok' : 'off'}`}>{t(ai.state === 'connected' ? 'ai.st.connected' : ai.state === 'checking' ? 'ai.st.checking' : 'ai.st.offline')}</span>
          {ai.version && <span className="muted">{t('ai.su.version')}: {ai.version}</span>}
        </div>
        {ai.state === 'offline' && <div className="wide"><Notice tone="warn">{t('ai.err.offline')}</Notice></div>}
        {!isLocalUrl(url) && <div className="wide"><Notice tone="warn">{t('ai.su.remote')}</Notice></div>}
      </section>
      <section className="card">
        <div className="row between"><h2>{t('ai.su.models')}</h2><button className="btn ghost small" onClick={ai.refresh}>{t('ai.su.refresh')}</button></div>
        {ai.state === 'connected' && ai.models.length === 0 ? <small className="muted">{t('ai.su.none')}</small> : (
          <ul className="list">
            {ai.models.map((m) => (
              <li key={m.name}>
                <label className="switch-row"><input type="radio" name="model" checked={ai.model === m.name} onChange={() => ai.changeModel(m.name)} /><span>{m.name}</span></label>
                <span className="muted">{gb(m.size)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2>{t('ai.su.guide')}</h2>
        <p>{t('ai.su.step1')}</p><p>{t('ai.su.step2')}</p><p>{t('ai.su.step3')}</p>
        <h2>{t('ai.su.suggest')}</h2>
        <p className="muted">{t('ai.su.text')}</p>
        <ul className="list">{TEXT_MODELS.map(([n, s]) => <li key={n}><code>ollama pull {n}</code><span className="muted">{s}</span></li>)}</ul>
        <p className="muted">{t('ai.su.visionKind')}</p>
        <ul className="list">{VISION_MODELS.map(([n, s]) => <li key={n}><code>ollama pull {n}</code><span className="muted">{s}</span></li>)}</ul>
        <Notice>{t('ai.su.hint')}</Notice>
      </section>
    </div>
  );
}
