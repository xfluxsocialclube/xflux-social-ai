/** Fila de publicações: deriva o estado de cada publicação planejada e registra tentativas. Não envia nada às redes. */
import { dbPut } from '../db';
import { listPlans, listPosts, confirmPublished, skipPost } from '../planner/plans';
import type { PlannedPost } from '../planner/types';
import { newAttempt, withAttempt, failedCount } from './attempts';
import { ERROR_INFO, nextRetry } from './errors';
import type { ErrorCode, QueueState } from './types';

export const dueAt = (p: Pick<PlannedPost, 'day' | 'time'>) => new Date(`${p.day}T${p.time}:00`);
export function queueState(p: PlannedPost, now = new Date()): QueueState {
  if (p.status === 'published') return 'published';
  if (p.status === 'skipped') return 'cancelled';
  if (p.status === 'pending') return 'blocked';
  if (p.delivery?.state === 'failed') return 'failed';
  if (p.delivery?.state === 'awaiting-user') return 'awaiting-user';
  return dueAt(p) <= now ? 'due' : 'queued';
}
/** Quem confirmou a publicação. Publicações da Fase 4 (sem registro de entrega) foram confirmadas pelo usuário. */
export const confirmedBy = (p: PlannedPost): 'user' | 'platform' | null => (p.status !== 'published' ? null : p.delivery?.confirmedBy ?? 'user');

export interface QueueItem { post: PlannedPost; state: QueueState; planStatus: string; }
export async function loadQueue(now = new Date()): Promise<QueueItem[]> {
  const [plans, posts] = await Promise.all([listPlans(), listPosts()]);
  const st = new Map(plans.map((p) => [p.id, p.status as string]));
  return posts.filter((p) => st.has(p.planId)).map((post) => ({ post, state: queueState(post, now), planStatus: st.get(post.planId)! }))
    .sort((a, b) => (a.post.day + a.post.time).localeCompare(b.post.day + b.post.time));
}
export function countStates(items: QueueItem[]): Record<QueueState, number> {
  const c: Record<QueueState, number> = { queued: 0, due: 0, 'awaiting-user': 0, failed: 0, published: 0, blocked: 0, cancelled: 0 };
  items.forEach((i) => { c[i.state]++; }); return c;
}

/** O usuário começou o fluxo assistido (abriu a rede para publicar). Ainda NÃO é publicação. */
export async function startAssisted(p: PlannedPost): Promise<PlannedPost> {
  const next = { ...p, delivery: withAttempt(p.delivery, newAttempt({ mode: 'assisted', outcome: 'started' }), { state: 'awaiting-user', nextRetryAt: undefined }) };
  await dbPut('posts', next); return next;
}
/** O usuário confirma que publicou. É a única forma de marcar "publicada" nesta fase (a confirmação é do usuário, não da plataforma). */
export async function confirmByUser(p: PlannedPost): Promise<PlannedPost> {
  return confirmPublished(p); // registra a confirmação do usuário, o uso do vídeo e o uso da legenda
}
/** O usuário não conseguiu publicar (ou a plataforma recusou). Registra o motivo e, se fizer sentido, quando tentar de novo. */
export async function reportFailure(p: PlannedPost, code: ErrorCode, note?: string, now = new Date()): Promise<PlannedPost> {
  const attempt = newAttempt({ mode: 'assisted', outcome: 'failed', errorCode: code, note: note?.trim() || undefined });
  const d = withAttempt(p.delivery, attempt, { state: 'failed' });
  const next = { ...p, delivery: { ...d, nextRetryAt: nextRetry(failedCount(d), code, now) ?? undefined } };
  await dbPut('posts', next); return next;
}
/** Volta para a fila para tentar de novo. O histórico de tentativas é mantido. */
export async function retryPost(p: PlannedPost): Promise<PlannedPost> {
  const d = p.delivery; if (!d) return p;
  const next = { ...p, delivery: { ...d, state: 'awaiting-user' as const, nextRetryAt: undefined } };
  await dbPut('posts', next); return next;
}
export async function cancelPost(p: PlannedPost): Promise<void> {
  await skipPost({ ...p, delivery: withAttempt(p.delivery, newAttempt({ mode: 'assisted', outcome: 'cancelled' }), { state: 'failed' }) });
}
export const suggestedAction = (code: ErrorCode) => ERROR_INFO[code].action;

/** Há algo pedindo atenção? (publicação no horário ou com falha, em ciclo ativo) */
export async function publishingAlert(now = new Date()): Promise<boolean> {
  const items = await loadQueue(now);
  return items.some((i) => i.planStatus === 'active' && (i.state === 'due' || i.state === 'failed'));
}
