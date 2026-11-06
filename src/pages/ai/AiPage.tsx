import { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { TranslationKey } from '../../i18n/pt';
import { useOllama } from './useOllama';
import { ChatTab } from './ChatTab';
import { GeneratorTab } from './GeneratorTab';
import { AnalyzeTab } from './AnalyzeTab';
import { SetupTab } from './SetupTab';

type Tab = 'chat' | 'gen' | 'shopee' | 'analyze' | 'setup';
const TABS: Tab[] = ['chat', 'gen', 'shopee', 'analyze', 'setup'];

export function AiPage() {
  const { t } = useI18n();
  const ai = useOllama();
  const [tab, setTab] = useState<Tab>('chat');
  const connLabel: TranslationKey = ai.state === 'connected' ? 'ai.st.connected' : ai.state === 'checking' ? 'ai.st.checking' : 'ai.st.offline';
  const visionLabel: TranslationKey = ai.vision === true ? 'ai.st.visionYes' : ai.vision === false ? 'ai.st.visionNo' : 'ai.st.visionUnknown';
  return (
    <div className="stack">
      <section className="card ai-status">
        <span>{t('ai.st.conn')}: <span className={`pill ${ai.state === 'connected' ? 'ok' : 'off'}`}>{t(connLabel)}</span></span>
        <span>{t('ai.st.model')}: <strong>{ai.model && ai.modelOk ? ai.model : t('ai.st.noModel')}</strong></span>
        <span>{t('ai.st.vision')}: <span className={`pill ${ai.vision ? 'ok' : 'off'}`}>{ai.modelOk ? t(visionLabel) : '—'}</span></span>
      </section>
      <div className="tabs" role="tablist">
        {TABS.map((x) => <button key={x} role="tab" aria-selected={tab === x} className={`tab ${tab === x ? 'active' : ''}`} onClick={() => setTab(x)}>{t(`ai.tab.${x}` as TranslationKey)}</button>)}
      </div>
      {tab === 'chat' && <ChatTab ai={ai} />}
      {tab === 'gen' && <GeneratorTab ai={ai} shopee={false} />}
      {tab === 'shopee' && <GeneratorTab ai={ai} shopee />}
      {tab === 'analyze' && <AnalyzeTab ai={ai} />}
      {tab === 'setup' && <SetupTab ai={ai} />}
    </div>
  );
}
