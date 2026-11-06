import type { Delivery } from '../publishing/types';

/** Tipos do planejamento. Mantidos "planos" (relacionais) para migrar para SQLite sem reescrever as regras. */
export type PostStatus = 'scheduled' | 'pending' | 'published' | 'skipped';
export type PendingReason = 'noPairing' | 'noMedia' | 'noCaption' | 'noContent';
export type CaptionMode = 'shared' | 'perNetwork';
export type CycleKind = '1w' | '2w' | '3w' | '4w' | 'custom';

export interface PlanConfig {
  startDate: string;          // AAAA-MM-DD
  cycleKind: CycleKind;
  lengthDays: number;         // duração do ciclo em dias (7, 14, 21, 28 ou personalizado)
  weekdays: number[];         // 0 = segunda … 6 = domingo
  times: string[];            // horários (HH:mm); a quantidade = publicações por dia
  networks: string[];         // ids das redes de destino
  crossPost: boolean;         // true: o mesmo pacote vai para todas as redes; false: um pacote por rede, alternando
  captionMode: CaptionMode;   // shared: mesma legenda em todas as redes; perNetwork: uma legenda para cada rede
  mediaRepeatDays: number;    // dias mínimos antes de repetir o mesmo vídeo (0 = sem proteção)
  captionReuseDays: number;   // dias para reutilizar uma legenda (0 = nunca reutilizar)
  allowUnpaired: boolean;     // publicar sem associação confirmada (escolha explícita do usuário)
}
export type PlanStatus = 'draft' | 'active' | 'paused' | 'finished';
export interface Plan {
  id: string; name: string; status: PlanStatus; config: PlanConfig;
  startDate: string; endDate: string; createdAt: string; activatedAt?: string; finishedAt?: string; previousPlanId?: string;
}
export interface PlannedPost {
  id: string; planId: string; day: string; time: string; network: string;
  mediaId: string | null; captionId: string | null; pairingId: string | null;
  status: PostStatus; reason?: PendingReason; unpaired?: boolean; publishedAt?: string;
  /** Fase 5: situação da entrega e histórico de tentativas. Ausente nos dados da Fase 4 (continuam válidos). */
  delivery?: Delivery;
}
export type PairingStatus = 'suggested' | 'confirmed' | 'pending';
export interface MatchReason { kind: 'id' | 'product' | 'productPartial' | 'category' | 'categoryFile' | 'keywords'; detail?: string; }
export interface Pairing {
  id: string; mediaId: string; captionId: string; status: PairingStatus; source: 'auto' | 'manual';
  score: number; reasons: MatchReason[]; createdAt: string; updatedAt: string;
}
