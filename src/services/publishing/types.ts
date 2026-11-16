/** Tipos da camada de publicação (Fase 5). Nada aqui publica de verdade: descreve estados, rotas e tentativas. */

/** Estado de um item na fila, do ponto de vista do usuário. */
export type QueueState = 'queued' | 'due' | 'awaiting-user' | 'failed' | 'published' | 'blocked' | 'cancelled';

/** Quem confirmou a publicação. 'platform' só existirá quando um servidor receber a confirmação oficial da rede. */
export type ConfirmedBy = 'user' | 'platform';

export type AttemptOutcome = 'started' | 'user-confirmed' | 'platform-confirmed' | 'failed' | 'cancelled';
export interface Attempt {
  id: string; at: string;               // ISO
  mode: 'assisted' | 'api';
  outcome: AttemptOutcome;
  errorCode?: ErrorCode; note?: string;
}

/** Dados de entrega gravados no registro da publicação planejada (campo opcional: dados da Fase 4 continuam válidos). */
export interface Delivery {
  mode: 'assisted' | 'api';
  state: 'awaiting-user' | 'failed' | 'confirmed';
  confirmedBy?: ConfirmedBy;
  externalId?: string;                  // id devolvido pela plataforma (só na publicação por API)
  attempts: Attempt[];                  // no máximo MAX_ATTEMPTS, as mais recentes
  nextRetryAt?: string;
}
export const MAX_ATTEMPTS = 20;

/** Erros previstos. Cada um diz se vale tentar de novo e qual é o próximo passo para o usuário. */
export type ErrorCode =
  | 'not-connected' | 'token-expired' | 'token-revoked' | 'permission-missing'
  | 'rate-limited' | 'media-invalid' | 'media-unreachable' | 'platform-rejected'
  | 'audit-required' | 'backend-unreachable' | 'network-error' | 'user-reported' | 'unknown';
export type NextAction = 'reconnect' | 'wait' | 'fix-media' | 'retry' | 'assisted' | 'contact-support';

export type Availability = 'official' | 'official-restricted' | 'not-confirmed';
export type ScheduleSupport = 'official' | 'not-documented';
export type Unattended = 'possible-with-backend' | 'restricted-by-policy' | 'not-available';

/** Motivos pelos quais uma publicação ainda não pode ser automática. */
export type Blocker =
  | 'no-backend' | 'backend-unreachable' | 'provider-not-enabled' | 'no-account' | 'token-expired' | 'token-revoked' | 'account-error'
  | 'not-officially-available' | 'policy-requires-user' | 'backend-no-publishing' | 'official-review-pending' | 'api-submit-not-implemented';

/** Estado de uma conta conectada, após autorização oficial validada e registrada localmente. */
export type AccountState = 'connected' | 'expiring' | 'expired' | 'revoked' | 'error';
export interface ConnectedAccount {
  id: string; network: string; displayName: string; state: 'connected' | 'expired' | 'revoked' | 'error';
  scopes: string[]; connectedAt: string; expiresAt: string | null; lastCheckedAt: string; lastError?: { code: string; message: string };
}
/** Situação mostrada ao usuário para uma rede. 'not-connected' = nenhuma conta autorizada e registrada neste computador. */
export type ConnectionView = 'not-connected' | AccountState;
