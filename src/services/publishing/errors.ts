/** Classificação de erros, política de nova tentativa e regras de expiração de autorização. Funções puras. */
import type { AccountState, ConnectedAccount, ErrorCode, NextAction } from './types';

export interface ErrorInfo { retryable: boolean; action: NextAction; }
export const ERROR_INFO: Record<ErrorCode, ErrorInfo> = {
  'not-connected': { retryable: false, action: 'reconnect' },
  'token-expired': { retryable: false, action: 'reconnect' },
  'token-revoked': { retryable: false, action: 'reconnect' },
  'permission-missing': { retryable: false, action: 'reconnect' },
  'rate-limited': { retryable: true, action: 'wait' },
  'media-invalid': { retryable: false, action: 'fix-media' },
  'media-unreachable': { retryable: true, action: 'retry' },
  'platform-rejected': { retryable: false, action: 'assisted' },
  'audit-required': { retryable: false, action: 'assisted' },
  'backend-unreachable': { retryable: true, action: 'retry' },
  'network-error': { retryable: true, action: 'retry' },
  'user-reported': { retryable: true, action: 'retry' },
  unknown: { retryable: true, action: 'contact-support' },
};

/** Traduz o que um servidor responde (HTTP e/ou código) para um erro conhecido. Nunca inventa: o que não reconhece vira 'unknown'. */
export function classifyError(input: { http?: number; code?: string }): ErrorCode {
  const c = (input.code ?? '').toLowerCase();
  if (c.includes('expired') || c === 'access_token_invalid') return 'token-expired';
  if (c.includes('revoked') || c.includes('deauthorized')) return 'token-revoked';
  if (c.includes('scope') || c.includes('permission')) return 'permission-missing';
  if (c.includes('rate') || c.includes('quota') || c.includes('too_many') || c.includes('limit')) return 'rate-limited';
  if (c.includes('unaudited') || c.includes('audit')) return 'audit-required';
  if (c.includes('media') && (c.includes('invalid') || c.includes('format') || c.includes('duration') || c.includes('resolution') || c.includes('aspect'))) return 'media-invalid';
  if (c.includes('media') && (c.includes('unreachable') || c.includes('download') || c.includes('fetch'))) return 'media-unreachable';
  if (c.includes('rejected') || c.includes('policy')) return 'platform-rejected';
  switch (input.http) {
    case 401: return 'token-expired';
    case 403: return 'permission-missing';
    case 429: return 'rate-limited';
    case 400: case 422: return 'media-invalid';
    case 502: case 503: case 504: return 'backend-unreachable';
    default: return input.http && input.http >= 500 ? 'unknown' : 'unknown';
  }
}

/** Espera antes da próxima tentativa (minutos): 1, 5, 30, 120 e 360. Depois de 5 tentativas não há nova tentativa automática. */
export const RETRY_MINUTES = [1, 5, 30, 120, 360] as const;
export function nextRetry(failedAttempts: number, code: ErrorCode, now = new Date()): string | null {
  if (!ERROR_INFO[code].retryable) return null;
  const wait = RETRY_MINUTES[failedAttempts - 1];
  if (wait === undefined || failedAttempts < 1) return null;
  return new Date(now.getTime() + wait * 60000).toISOString();
}

export const EXPIRING_SOON_DAYS = 7;
/** Situação de uma conta. 'expiring' avisa antes de expirar para o usuário reconectar sem perder publicações. */
export function accountState(a: ConnectedAccount, now = new Date()): AccountState {
  if (a.state !== 'connected') return a.state;
  if (a.expiresAt) {
    const ms = new Date(a.expiresAt).getTime() - now.getTime();
    if (Number.isNaN(ms)) return 'error';
    if (ms <= 0) return 'expired';
    if (ms <= EXPIRING_SOON_DAYS * 86400000) return 'expiring';
  }
  return 'connected';
}
