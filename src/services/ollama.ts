/** Cliente do Ollama (servidor local de IA). Todas as chamadas são assíncronas e cancelável via AbortSignal. */
import { loadSetting, saveSetting } from './settings';

export const DEFAULT_URL = 'http://localhost:11434';
export const getUrl = () => loadSetting<string>('ollama.url', DEFAULT_URL);
export const saveUrl = (u: string) => saveSetting('ollama.url', u.trim().replace(/\/+$/, '') || DEFAULT_URL);
export const getModel = () => loadSetting<string>('ollama.model', '');
export const saveModel = (m: string) => saveSetting('ollama.model', m);

export type OllamaErrorCode = 'offline' | 'model' | 'http' | 'url' | 'aborted';
export class OllamaError extends Error {
  constructor(public code: OllamaErrorCode, message = '') { super(message || code); }
}
export interface OllamaModel { name: string; size: number; }
export interface ChatMsg { role: 'system' | 'user' | 'assistant'; content: string; images?: string[]; }
export type ConnState = 'checking' | 'connected' | 'offline';

export function isLocalUrl(u: string): boolean {
  try { return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(new URL(u).hostname); } catch { return false; }
}
async function call(path: string, url: string, init: RequestInit = {}): Promise<Response> {
  try {
    const p = new URL(url);
    if (p.protocol !== 'http:' && p.protocol !== 'https:') throw new Error('proto');
  } catch { throw new OllamaError('url'); }
  try { return await fetch(url + path, init); } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new OllamaError('aborted');
    throw new OllamaError('offline');
  }
}
export async function ping(url = getUrl()): Promise<string> {
  const res = await call('/api/version', url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new OllamaError('http', String(res.status));
  return ((await res.json()) as { version?: string }).version ?? '';
}
export async function listModels(url = getUrl()): Promise<OllamaModel[]> {
  const res = await call('/api/tags', url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new OllamaError('http', String(res.status));
  const j = (await res.json()) as { models?: { name: string; size: number }[] };
  return (j.models ?? []).map((m) => ({ name: m.name, size: m.size }));
}
/** Pergunta ao Ollama se o modelo suporta imagens (campo "capabilities"; plano B: projetor de visão). */
export async function supportsVision(name: string, url = getUrl()): Promise<boolean> {
  const res = await call('/api/show', url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: name }), signal: AbortSignal.timeout(6000) });
  if (!res.ok) return false;
  const j = (await res.json()) as { capabilities?: string[]; projector_info?: unknown; details?: { families?: string[] } };
  if (Array.isArray(j.capabilities)) return j.capabilities.includes('vision');
  const fam = j.details?.families ?? [];
  return Boolean(j.projector_info) || fam.includes('clip') || fam.includes('mllama');
}
export async function chatStream(o: { model: string; messages: ChatMsg[]; onToken: (t: string) => void; signal?: AbortSignal; url?: string }): Promise<string> {
  const res = await call('/api/chat', o.url ?? getUrl(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: o.signal,
    // num_ctx limitado para controlar o uso de memória em PCs com 8 GB.
    body: JSON.stringify({ model: o.model, messages: o.messages, stream: true, options: { num_ctx: 4096 } }),
  });
  if (!res.ok) {
    let msg = '';
    try { msg = ((await res.json()) as { error?: string }).error ?? ''; } catch { /* sem corpo */ }
    throw res.status === 404 ? new OllamaError('model', msg) : new OllamaError('http', msg || String(res.status));
  }
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '', full = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        let j: { error?: string; message?: { content?: string } };
        try { j = JSON.parse(line); } catch { continue; }
        if (j.error) throw new OllamaError('http', j.error);
        const tok = j.message?.content ?? '';
        if (tok) { full += tok; o.onToken(tok); }
      }
    }
  } catch (e) {
    if (e instanceof OllamaError) throw e;
    if (e instanceof DOMException && e.name === 'AbortError') throw new OllamaError('aborted');
    throw new OllamaError('offline');
  }
  return full;
}
