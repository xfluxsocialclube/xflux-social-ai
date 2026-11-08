/**
 * Cliente do servidor do XFLUX. Só funciona se o usuário (ou a empresa) configurar o endereço do servidor.
 * Sem servidor configurado, NADA é conectado e nada é simulado. Nenhum segredo de rede social passa por aqui.
 */
import { loadSetting, saveSetting } from '../settings';
import { parseAccounts, parseHealth, parseOAuthStart, type HealthResponse, type OAuthStartResponse } from './contract';
import type { ConnectedAccount } from '../publishing/types';

export type BackendErrorKind = 'not-configured' | 'invalid-url' | 'unreachable' | 'unauthorized' | 'invalid-response' | 'http';
export class BackendError extends Error {
  constructor(public kind: BackendErrorKind, public status?: number) { super(kind); }
}
const TIMEOUT_MS = 8000;
const TOKEN_KEY = 'xflux.backend.token';

export const getBackendUrl = () => loadSetting<string>('backend.url', '');
export function setBackendUrl(url: string) { saveSetting('backend.url', url.trim().replace(/\/+$/, '')); }
/** JWT de sessão XFLUX emitido pelo provedor de identidade configurado (não é token de rede social). Fica só na sessão do navegador. */
export const getSessionToken = (): string => { try { return sessionStorage.getItem(TOKEN_KEY) ?? ''; } catch { return ''; } };
export function setSessionToken(t: string) { try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); } catch { /* sem armazenamento: segue sem token */ } }

/** Exige HTTPS (exceto localhost, para desenvolvimento). Evita enviar dados por conexão aberta. */
export function validateBackendUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    if (u.username || u.password || u.hash) return false;
    return u.protocol === 'https:' || (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'));
  } catch { return false; }
}

async function call(path: string, init: RequestInit = {}): Promise<unknown> {
  const base = getBackendUrl();
  if (!base) throw new BackendError('not-configured');
  if (!validateBackendUrl(base)) throw new BackendError('invalid-url');
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const token = getSessionToken();
  try {
    const res = await fetch(`${base}${path}`, { ...init, signal: ctrl.signal, credentials: 'omit', headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    if (res.status === 401 || res.status === 403) throw new BackendError('unauthorized', res.status);
    if (!res.ok) throw new BackendError('http', res.status);
    if (res.status === 204) return null;
    try { return await res.json(); } catch { throw new BackendError('invalid-response'); }
  } catch (e) {
    if (e instanceof BackendError) throw e;
    throw new BackendError('unreachable');
  } finally { clearTimeout(timer); }
}

export async function health(): Promise<HealthResponse> {
  const h = parseHealth(await call('/v1/health')); if (!h) throw new BackendError('invalid-response'); return h;
}
export async function fetchAccounts(): Promise<ConnectedAccount[]> {
  const a = parseAccounts(await call('/v1/accounts')); if (!a) throw new BackendError('invalid-response'); return a;
}
export async function startOAuth(network: string, reconnectAccountId?: string): Promise<OAuthStartResponse> {
  const r = parseOAuthStart(await call(`/v1/oauth/${encodeURIComponent(network)}/start`, { method: 'POST', body: JSON.stringify(reconnectAccountId ? { reconnectAccountId } : {}) }));
  if (!r) throw new BackendError('invalid-response');
  let u: URL; try { u = new URL(r.authorizationUrl); } catch { throw new BackendError('invalid-response'); }
  if (u.protocol !== 'https:') throw new BackendError('invalid-response'); // a autorização oficial sempre é HTTPS
  return r;
}
export async function disconnectAccount(id: string): Promise<void> { await call(`/v1/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
