/** Registro de tentativas de publicação (puro). */
import { uid, nowIso } from '../captions/text';
import { MAX_ATTEMPTS, type Attempt, type Delivery } from './types';

export function newAttempt(a: Omit<Attempt, 'id' | 'at'> & { at?: string }): Attempt { return { id: uid(), at: a.at ?? nowIso(), ...a }; }
export function withAttempt(d: Delivery | undefined, attempt: Attempt, patch: Partial<Delivery> = {}): Delivery {
  const base: Delivery = d ?? { mode: attempt.mode, state: 'awaiting-user', attempts: [] };
  return { ...base, mode: attempt.mode, ...patch, attempts: [...base.attempts, attempt].slice(-MAX_ATTEMPTS) };
}
export const failedCount = (d?: Delivery) => (d?.attempts ?? []).filter((a) => a.outcome === 'failed').length;
