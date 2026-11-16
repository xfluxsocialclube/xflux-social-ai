/**
 * Adaptadores de publicação, um por rede, independentes entre si.
 * Nenhum adaptador simula sucesso: a publicação permanece assistida até existir
 * OAuth local, regra oficial compatível e envio por API implementado e testado.
 */
import { NETWORKS } from '../networks';
import type { TranslationKey } from '../../i18n/pt';
import { connectionOf } from '../accounts/local';
import { getFacts } from './catalog';
import type { ConnectionView } from './types';

export type IntegrationStage = 'assisted-only' | 'official-api-to-validate';
export type PublishResult = { ok: false; reason: 'not-connected' | 'not-available' };
export interface PublishRequest { network: string; mediaPath: string | null; text: string; scheduledAt: string; }

export interface PublishAdapter {
  id: string; name: string; color: string; priority: number;
  stage: IntegrationStage; stageKey: TranslationKey;
  connection(): ConnectionView;
  publish(req: PublishRequest): Promise<PublishResult>;
}
const make = (id: string): PublishAdapter => {
  const network = NETWORKS.find((item) => item.id === id)!;
  const facts = getFacts(id);
  const assistedOnly = facts?.directPublish === 'not-confirmed';
  return {
    id, name: network.name, color: network.color, priority: NETWORKS.indexOf(network) + 1,
    stage: assistedOnly ? 'assisted-only' : 'official-api-to-validate',
    stageKey: assistedOnly ? 'net.stage.assisted' : 'net.stage.validate',
    connection: () => connectionOf(id).view,
    publish: async () => (assistedOnly
      ? { ok: false, reason: 'not-available' }
      : { ok: false, reason: 'not-connected' }),
  };
};
export const ADAPTERS: PublishAdapter[] = NETWORKS.map((network) => make(network.id));
export const getAdapter = (id: string) => ADAPTERS.find((adapter) => adapter.id === id);
