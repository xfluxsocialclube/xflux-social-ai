/**
 * Contrato entre o aplicativo e o servidor do XFLUX (versão 1). Documentado em docs/BACKEND-CONTRATO.md e docs/openapi-backend.yaml.
 * O servidor guarda segredos e tokens das redes. O aplicativo só recebe o ESTADO das contas, nunca os tokens.
 */
import type { ConnectedAccount } from '../publishing/types';

export type BackendCapability = 'accounts' | 'oauth' | 'publishing' | 'scheduler';
export interface ProviderInfo { network: string; oauth: boolean; publishing: boolean; }
export interface HealthResponse { service: 'xflux-backend'; apiVersion: '1'; capabilities: BackendCapability[]; providers: ProviderInfo[]; }
export interface AccountsResponse { accounts: ConnectedAccount[]; }
export interface OAuthStartResponse { authorizationUrl: string; expiresInSeconds: number; }

const isStr = (v: unknown): v is string => typeof v === 'string';
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const CAPS: BackendCapability[] = ['accounts', 'oauth', 'publishing', 'scheduler'];
const ACC_STATES = ['connected', 'expired', 'revoked', 'error'];

export function parseHealth(v: unknown): HealthResponse | null {
  if (!isObj(v) || v.service !== 'xflux-backend' || v.apiVersion !== '1' || !Array.isArray(v.capabilities) || !Array.isArray(v.providers)) return null;
  const providers: ProviderInfo[] = [];
  for (const p of v.providers) { if (!isObj(p) || !isStr(p.network) || typeof p.oauth !== 'boolean' || typeof p.publishing !== 'boolean') return null; providers.push({ network: p.network, oauth: p.oauth, publishing: p.publishing }); }
  return { service: 'xflux-backend', apiVersion: '1', capabilities: v.capabilities.filter((c): c is BackendCapability => CAPS.includes(c as BackendCapability)), providers };
}
export function parseAccounts(v: unknown): ConnectedAccount[] | null {
  if (!isObj(v) || !Array.isArray(v.accounts)) return null;
  const out: ConnectedAccount[] = [];
  for (const a of v.accounts) {
    if (!isObj(a) || !isStr(a.id) || !isStr(a.network) || !isStr(a.displayName) || !isStr(a.state) || !ACC_STATES.includes(a.state) || !Array.isArray(a.scopes) || !isStr(a.connectedAt) || !isStr(a.lastCheckedAt)) return null;
    if (a.expiresAt !== null && a.expiresAt !== undefined && !isStr(a.expiresAt)) return null;
    const le = isObj(a.lastError) && isStr(a.lastError.code) && isStr(a.lastError.message) ? { code: a.lastError.code, message: a.lastError.message } : undefined;
    out.push({ id: a.id, network: a.network, displayName: a.displayName, state: a.state as ConnectedAccount['state'], scopes: a.scopes.filter(isStr), connectedAt: a.connectedAt, expiresAt: (a.expiresAt as string | null | undefined) ?? null, lastCheckedAt: a.lastCheckedAt, lastError: le });
  }
  return out;
}
export function parseOAuthStart(v: unknown): OAuthStartResponse | null {
  if (!isObj(v) || !isStr(v.authorizationUrl) || typeof v.expiresInSeconds !== 'number') return null;
  return { authorizationUrl: v.authorizationUrl, expiresInSeconds: v.expiresInSeconds };
}
