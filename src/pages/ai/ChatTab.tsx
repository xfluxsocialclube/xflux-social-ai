import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { Notice } from '../../components/Notice';
import { CopyButton } from '../../components/CopyButton';
import { useI18n } from '../../i18n/I18nContext';
import { chatStream } from '../../services/ollama';
import { fluxSystem } from '../../services/ai/prompts';
import { deleteConversation, listConversations, newConversation, saveConversation, type Conversation } from '../../services/ai/conversations';
import { describeError } from './errors';
import type { OllamaCtx } from './useOllama';

const HISTORY_LIMIT = 12; // mensagens enviadas ao modelo (controla memória/contexto)

export function ChatTab({ ai }: { ai: OllamaCtx }) {
  const { t, locale } = useI18n();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { listConversations().then((c) => { setConvs(c); setActiveId(c[0]?.id ?? null); }); }, []);
  const active = convs.find((c) => c.id === activeId) ?? null;
  const lastLen = active ? active.messages[active.messages.length - 1]?.content.length ?? 0 : 0;
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [active?.messages.length, lastLen]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    if (!ai.ready) { setError(t('ai.err.notready')); return; }
    setError(''); setInput('');
    const base = active ?? newConversation();
    const conv: Conversation = {
      ...base, title: base.messages.length ? base.title : text.slice(0, 40),
      messages: [...base.messages, { role: 'user', content: text }, { role: 'assistant', content: '' }],
    };
    setConvs((cs) => [conv, ...cs.filter((c) => c.id !== conv.id)]);
    setActiveId(conv.id); setBusy(true);
    const ctrl = new AbortController(); abort.current = ctrl;
    const history = conv.messages.slice(0, -1).slice(-HISTORY_LIMIT);
    let acc = '';
    try {
      await chatStream({
        model: ai.model, url: ai.url, signal: ctrl.signal,
        messages: [{ role: 'system', content: fluxSystem(locale) }, ...history],
        onToken: (tk) => {
          acc += tk;
          setConvs((cs) => cs.map((c) => (c.id === conv.id ? { ...c, messages: c.messages.map((m, i) => (i === c.messages.length - 1 ? { ...m, content: acc } : m)) } : c)));
        },
      });
    } catch (e) { const m = describeError(e, t); if (m) setError(m); }
    finally {
      setBusy(false); abort.current = null;
      const last = conv.messages.length - 1;
      const final: Conversation = { ...conv, messages: conv.messages.map((m, i) => (i === last ? { ...m, content: acc } : m)).filter((m, i) => !(i === last && !m.content)) };
      setConvs((cs) => cs.map((c) => (c.id === final.id ? final : c)));
      await saveConversation(final);
    }
  };
  const remove = async (c: Conversation) => {
    if (!window.confirm(t('ai.chat.confirmDelete'))) return;
    await deleteConversation(c.id);
    const rest = convs.filter((x) => x.id !== c.id);
    setConvs(rest); if (activeId === c.id) setActiveId(rest[0]?.id ?? null);
  };
  const lastIsEmptyAssistant = active && active.messages.length > 0 && active.messages[active.messages.length - 1].content === '';

  return (
    <div className="chat">
      <aside className="card chat-list">
        <button className="btn" onClick={() => { setActiveId(null); setError(''); }} disabled={busy}>{t('ai.chat.new')}</button>
        <ul className="list">
          {convs.map((c) => (
            <li key={c.id} className={c.id === activeId ? 'sel' : ''}>
              <button className="link" onClick={() => !busy && setActiveId(c.id)}>{c.title || t('ai.chat.untitled')}</button>
              <button className="link muted" onClick={() => remove(c)} disabled={busy} aria-label={t('ai.chat.delete')}>✕</button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="card chat-main">
        <div className="chat-msgs">
          {!active || active.messages.length === 0 ? <EmptyState title={t('ai.chat.empty')} description={t('ai.chat.emptyDesc')} /> : active.messages.map((m, i) => (
            <div key={i} className={`bubble-msg ${m.role}`}>
              <small className="muted">{m.role === 'user' ? t('ai.chat.you') : 'FLUX'}</small>
              <div className="msg-text">{m.content || (busy && i === active.messages.length - 1 ? t('ai.chat.thinking') : '')}</div>
              {m.role === 'assistant' && m.content && <CopyButton text={m.content} />}
            </div>
          ))}
          {busy && lastIsEmptyAssistant === false && <small className="muted">{t('ai.chat.thinking')}</small>}
          <div ref={bottom} />
        </div>
        {error && <Notice tone="warn">{error}</Notice>}
        <div className="chat-input">
          <textarea rows={2} value={input} placeholder={t('ai.chat.placeholder')} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          {busy ? <button className="btn ghost" onClick={() => abort.current?.abort()}>{t('ai.stop')}</button>
                : <button className="btn" onClick={send} disabled={!input.trim()}>{t('ai.chat.send')}</button>}
        </div>
      </section>
    </div>
  );
}
