/**
 * Contas conectadas: o que o servidor informou da última vez. O aplicativo NUNCA cria uma conta por conta própria.
 * Se o servidor não responde, mostramos o último estado conhecido marcado como "não verificado agora".
 */
import { loadSetting, saveSetting } from '../settings';
import { accountState } from '../publishing/errors';
import type { ConnectedAccount, ConnectionView } from '../publishing/types';
import { BackendError, fetchAccounts, getBackendUrl, health } from './client';
import type { HealthResponse } from './contract';

export interface BackendSnapshot {
  url: string; fetchedAt: string | null;
  reachable: boolean | null;               // null = ainda não verificado
  error?: BackendError['kind'];
  health: HealthResponse | null;
  accounts: ConnectedAccount[];
  accountsFetchedAt: string | null;
}
const KEY = 'backend.snapshot';
export const emptySnapshot = (): BackendSnapshot => ({ url: getBackendUrl(), fetchedAt: null, reachable: null, health: null, accounts: [], accountsFetchedAt: null });
export function loadSnapshot(): BackendSnapshot {
  const s = loadSetting<BackendSnapshot | null>(KEY, null);
  if (!s || s.url !== getBackendUrl()) return emptySnapshot(); // outro servidor: descarta o cache
  return s;
}
/** Consulta o servidor e guarda o resultado. Em caso de falha mantém as últimas contas conhecidas, marcando o servidor como inacessível. */
export async function refreshSnapshot(): Promise<BackendSnapshot> {
  const prev = loadSnapshot(); const now = new Date().toISOString();
  if (!getBackendUrl()) { const s = emptySnapshot(); saveSetting(KEY, s); return s; }
  try {
    const h = await health();
    let accounts = prev.accounts; let accountsFetchedAt = prev.accountsFetchedAt;
    if (h.capabilities.includes('accounts')) { accounts = await fetchAccounts(); accountsFetchedAt = now; }
    const s: BackendSnapshot = { url: getBackendUrl(), fetchedAt: now, reachable: true, health: h, accounts, accountsFetchedAt };
    saveSetting(KEY, s); return s;
  } catch (e) {
    const s: BackendSnapshot = { ...prev, url: getBackendUrl(), fetchedAt: now, reachable: false, error: e instanceof BackendError ? e.kind : 'unreachable' };
    saveSetting(KEY, s); return s;
  }
}
/** Situação de uma rede para mostrar ao usuário. Sem conta verificada por servidor, é sempre "não conectada". */
export function connectionOf(network: string, snap = loadSnapshot(), now = new Date()): { view: ConnectionView; account?: ConnectedAccount; verified: boolean } {
  const acc = snap.accounts.filter((a) => a.network === network).sort((a, b) => b.connectedAt.localeCompare(a.connectedAt))[0];
  if (!acc) return { view: 'not-connected', verified: snap.reachable === true };
  return { view: accountState(acc, now), account: acc, verified: snap.reachable === true };
}
