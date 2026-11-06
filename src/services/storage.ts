/**
 * Contrato futuro para provedores de armazenamento.
 * Nenhum provedor está implementado na Fase 1 — apenas a arquitetura.
 */
import type { TranslationKey } from '../i18n/pt';

export type StorageProviderId = 'local' | 'gdrive' | 'onedrive' | 'other-cloud' | 'own-server';

export interface StorageProvider {
  id: StorageProviderId;
  connect(): Promise<void>;
  list(path: string): Promise<string[]>;
}

export const STORAGE_PROVIDERS: { id: StorageProviderId; labelKey: TranslationKey }[] = [
  { id: 'local', labelKey: 'sto.local' },
  { id: 'gdrive', labelKey: 'sto.gdrive' },
  { id: 'onedrive', labelKey: 'sto.onedrive' },
  { id: 'other-cloud', labelKey: 'sto.other' },
  { id: 'own-server', labelKey: 'sto.server' },
];
