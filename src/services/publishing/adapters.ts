/**
 * Adaptadores de publicação, um por rede.
 * O estado de conexão é local ao dispositivo. Nenhum adaptador consulta um servidor XFLUX.
 * Até existir OAuth local e envio oficial implementados e testados, nada é simulado.
 */
import { NETWORKS } from '../networks';
import type { TranslationKey } from '../../i18n/pt';
import { getFacts } from './catalog';
import type { ConnectionView } from './types';

export type IntegrationStage = 'assisted-only' | 'official-api-to-validate';
export type PublishResult = { ok: false; reason: 'not-connected' | 'not-available' };
export interface PublishRequest { network: string; mediaPath: string | null; text: string; scheduledAt: string; }

export interface PublishAdapter {
  id: string; name: string; color: string; priority: number;
  stage: IntegrationStage; stageKey: TranslationKey;
  /** Até o fluxo OAuth local da rede ser implementado, a conta não é considerada conectada. */
  connection(): ConnectionView;
  publish(req: PublishRequest): Promise<PublishResult>;
}
const make = (id: string): PublishAdapter => {
  const n = NETWORKS.find((x) => x.id === id)!; const facts = getFacts(id);
  const assistedOnly = facts?.directPublish === 'not-confirmed';
  return {
    id, name: n.name, color: n.color, priority: NETWORKS.indexOf(n) + 1,
    stage: assistedOnly ? 'assisted-only' : 'official-api-to-validate',
    stageKey: assistedOnly ? 'net.stage.assisted' : 'net.stage.validate',
    connection: () => 'not-connected',
    publish: async () => (assistedOnly ? { ok: false, reason: 'not-available' } : { ok: false, reason: 'not-connected' }),
  };
};
export const ADAPTERS: PublishAdapter[] = NETWORKS.map((n) => make(n.id));
export const getAdapter = (id: string) => ADAPTERS.find((a) => a.id === id);
