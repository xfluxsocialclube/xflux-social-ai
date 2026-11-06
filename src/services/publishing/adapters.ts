/**
 * Adaptadores de publicação, um por rede, independentes entre si (Fase 5).
 * Nenhum adaptador publica: `publish()` nunca simula sucesso. A publicação é ASSISTIDA até existir servidor,
 * conta conectada de verdade, regra oficial que permita e o envio por API implementado e testado com credenciais reais.
 * Para adicionar uma rede: inclua-a em services/networks.ts, em publishing/catalog.ts e aqui.
 */
import { NETWORKS } from '../networks';
import type { TranslationKey } from '../../i18n/pt';
import { connectionOf } from '../backend/accounts';
import { getFacts } from './catalog';
import type { ConnectionView } from './types';

export type IntegrationStage = 'assisted-only' | 'official-api-to-validate';
export type PublishResult = { ok: false; reason: 'not-connected' | 'not-available' };
export interface PublishRequest { network: string; mediaPath: string | null; text: string; scheduledAt: string; }

export interface PublishAdapter {
  id: string; name: string; color: string; priority: number;
  stage: IntegrationStage; stageKey: TranslationKey;
  /** Situação da conexão, só "conectada" se um servidor do XFLUX verificou a autorização. */
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
    connection: () => connectionOf(id).view,
    publish: async () => (assistedOnly ? { ok: false, reason: 'not-available' } : { ok: false, reason: 'not-connected' }),
  };
};
export const ADAPTERS: PublishAdapter[] = NETWORKS.map((n) => make(n.id));
export const getAdapter = (id: string) => ADAPTERS.find((a) => a.id === id);
