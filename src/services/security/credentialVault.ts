/**
 * Cofre de credenciais: ponte entre o app e o cofre nativo do Windows.
 * Tokens e chaves não são gravados em localStorage, IndexedDB, SQLite ou arquivos.
 */
import { invoke } from '@tauri-apps/api/core';

export type VaultErrorCode = 'unavailable' | 'invalid' | 'failed';
export class VaultError extends Error {
  constructor(public code: VaultErrorCode, message = '') { super(message || code); }
}
export interface TokenBundle {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes?: string[];
}
export interface AppCredentials { clientId: string; clientSecret: string; }

const MAX_KEY = 200;
const MAX_VALUE = 1200;
export const isVaultAvailable = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const part = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '-');

export function credentialKey(network: string, accountId: string): string {
  const key = `xflux/${part(network)}/${part(accountId)}`;
  if (!network.trim() || !accountId.trim() || key.length > MAX_KEY) throw new VaultError('invalid', 'Identificador inválido.');
  return key;
}
async function call<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  if (!isVaultAvailable()) throw new VaultError('unavailable', 'O cofre só existe no aplicativo para Windows.');
  try { return await invoke<T>(cmd, args); }
  catch (e) { throw new VaultError('failed', typeof e === 'string' ? e : 'Falha ao acessar o cofre.'); }
}
async function put(key: string, value: unknown): Promise<void> {
  const text = JSON.stringify(value);
  if (text.length > MAX_VALUE) throw new VaultError('invalid', 'Credencial grande demais para o cofre.');
  await call<void>('secure_store_credential', { account: key, value: text });
}
async function get(key: string): Promise<unknown | null> {
  const raw = await call<string | null>('secure_read_credential', { account: key });
  if (!raw) return null;
  try { return JSON.parse(raw) as unknown; } catch { return null; }
}
export async function saveTokens(network: string, accountId: string, bundle: TokenBundle): Promise<void> {
  if (!bundle.accessToken) throw new VaultError('invalid', 'Token vazio.');
  await put(credentialKey(network, accountId), bundle);
}
export async function readTokens(network: string, accountId: string): Promise<TokenBundle | null> {
  const v = (await get(credentialKey(network, accountId))) as Partial<TokenBundle> | null;
  if (!v || typeof v.accessToken !== 'string' || !v.accessToken) return null;
  return {
    accessToken: v.accessToken,
    refreshToken: typeof v.refreshToken === 'string' ? v.refreshToken : undefined,
    expiresAt: typeof v.expiresAt === 'string' ? v.expiresAt : undefined,
    scopes: Array.isArray(v.scopes) ? v.scopes.filter((s): s is string => typeof s === 'string') : undefined,
  };
}
export async function deleteTokens(network: string, accountId: string): Promise<void> {
  await call<void>('secure_delete_credential', { account: credentialKey(network, accountId) });
}
export async function saveAppCredentials(network: string, c: AppCredentials): Promise<void> {
  if (!c.clientId.trim() || !c.clientSecret.trim()) throw new VaultError('invalid', 'Credenciais vazias.');
  await put(credentialKey(network, 'app'), { clientId: c.clientId.trim(), clientSecret: c.clientSecret.trim() });
}
export async function readAppCredentials(network: string): Promise<AppCredentials | null> {
  const v = (await get(credentialKey(network, 'app'))) as Partial<AppCredentials> | null;
  if (!v || typeof v.clientId !== 'string' || typeof v.clientSecret !== 'string' || !v.clientId || !v.clientSecret) return null;
  return { clientId: v.clientId, clientSecret: v.clientSecret };
}
export async function deleteAppCredentials(network: string): Promise<void> {
  await call<void>('secure_delete_credential', { account: credentialKey(network, 'app') });
}
