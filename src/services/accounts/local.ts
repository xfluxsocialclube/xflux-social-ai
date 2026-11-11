/**
 * Contas conectadas neste computador (sem servidor XFLUX).
 * Metadados sem segredo ficam nas preferências locais.
 * Tokens ficam exclusivamente no cofre seguro do sistema operacional.
 */
import { loadSetting, saveSetting } from '../settings';
import { accountState } from '../publishing/errors';
import type { ConnectedAccount, ConnectionView } from '../publishing/types';
import { deleteOAuthCredential } from '../security/credentialVault';

const KEY = 'accounts.local';
/** Nenhum fluxo OAuth local foi implementado e validado nesta versão. */
const LOGIN_READY: readonly string[] = [];
export const isLoginImplemented = (network: string): boolean => LOGIN_READY.includes(network);

export function listLocalAccounts(): ConnectedAccount[] {
  const value = loadSetting<unknown>(KEY, []);
  return Array.isArray(value) ? (value as ConnectedAccount[]) : [];
}

/** Só chamar depois de uma autorização oficial concluída e validada. */
export function saveLocalAccount(account: ConnectedAccount): void {
  saveSetting(KEY, [...listLocalAccounts().filter((item) => item.id !== account.id), account]);
}

export async function removeLocalAccount(id: string): Promise<void> {
  const account = listLocalAccounts().find((item) => item.id === id);
  if (!account) return;
  // Não remove o registro local se a credencial não puder ser apagada do cofre.
  await deleteOAuthCredential(account.network, account.id);
  saveSetting(KEY, listLocalAccounts().filter((item) => item.id !== id));
}

/** Sem conta guardada neste computador, a rede é sempre "não conectada". */
export function connectionOf(network: string, now = new Date()): { view: ConnectionView; account?: ConnectedAccount } {
  const account = listLocalAccounts()
    .filter((item) => item.network === network)
    .sort((a, b) => b.connectedAt.localeCompare(a.connectedAt))[0];
  if (!account) return { view: 'not-connected' };
  return { view: accountState(account, now), account };
}
