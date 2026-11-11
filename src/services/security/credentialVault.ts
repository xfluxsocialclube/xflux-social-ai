/**
 * Cofre de credenciais do sistema operacional.
 * Tokens OAuth nunca devem ser gravados em localStorage/IndexedDB.
 * Disponível somente no aplicativo desktop Tauri; no navegador, falha de forma explícita.
 */
import { invoke } from '@tauri-apps/api/core';

const KEY_PREFIX = 'oauth:';

function credentialKey(provider: string, account = 'default'): string {
  const safeProvider = provider.toLowerCase().replace(/[^a-z0-9._-]/g, '');
  const safeAccount = account.toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (!safeProvider || !safeAccount) throw new Error('Identificador de credencial inválido.');
  return `${KEY_PREFIX}${safeProvider}:${safeAccount}`;
}

export async function storeOAuthCredential(provider: string, value: string, account = 'default'): Promise<void> {
  if (!value || value.length > 64_000) throw new Error('Credencial vazia ou acima do limite permitido.');
  await invoke('secure_store_credential', { account: credentialKey(provider, account), value });
}

export async function readOAuthCredential(provider: string, account = 'default'): Promise<string | null> {
  return invoke<string | null>('secure_read_credential', { account: credentialKey(provider, account) });
}

export async function deleteOAuthCredential(provider: string, account = 'default'): Promise<void> {
  await invoke('secure_delete_credential', { account: credentialKey(provider, account) });
}
