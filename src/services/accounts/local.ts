/**
 * Contas conectadas neste computador (sem servidor XFLUX).
 * Metadados sem segredo ficam nas preferências locais; tokens ficam no cofre do Windows.
 */
import { loadSetting, saveSetting } from '../settings';
import { accountState } from '../publishing/errors';
import type { ConnectedAccount, ConnectionView } from '../publishing/types';
import { deleteTokens, VaultError } from '../security/credentialVault';

const KEY = 'accounts.local';
/** O fluxo YouTube foi implementado; a validação ponta a ponta ainda depende do teste no Windows. */
const LOGIN_READY: readonly string[] = ['youtube'];
export const isLoginImplemented = (network: string): boolean => LOGIN_READY.includes(network);

export function listLocalAccounts(): ConnectedAccount[] {
  const v = loadSetting<unknown>(KEY, []);
  return Array.isArray(v) ? v as ConnectedAccount[] : [];
}
export function saveLocalAccount(account: ConnectedAccount): void {
  saveSetting(KEY, [...listLocalAccounts().filter((a) => a.id !== account.id), account]);
}
export function updateLocalAccountState(id: string, state: ConnectedAccount['state'], lastError?: { code: string; message: string }): void {
  saveSetting(KEY, listLocalAccounts().map((a) => a.id === id
    ? { ...a, state, lastCheckedAt: new Date().toISOString(), lastError }
    : a));
}
export async function removeLocalAccount(id: string): Promise<void> {
  const acc = listLocalAccounts().find((a) => a.id === id);
  if (!acc) return;
  try { await deleteTokens(acc.network, acc.id); }
  catch (e) {
    if (!(e instanceof VaultError && e.code === 'unavailable')) throw e;
  }
  saveSetting(KEY, listLocalAccounts().filter((a) => a.id !== id));
}
export function connectionOf(network: string, now = new Date()): { view: ConnectionView; account?: ConnectedAccount } {
  const acc = listLocalAccounts().filter((a) => a.network === network)
    .sort((a, b) => b.connectedAt.localeCompare(a.connectedAt))[0];
  if (!acc) return { view: 'not-connected' };
  return { view: accountState(acc, now), account: acc };
}
