/** Banco de legendas: gravação, edição, uso e regras de reutilização. */
import { dbDeleteMany, dbGetAll, dbPut, dbPutMany } from '../db';
import { loadSetting } from '../settings';
import { normKey, nowIso, uid } from './text';
import type { Caption, CaptionDraft } from './types';

export const listCaptions = () => dbGetAll<Caption>('captions');
export const getCaptionReuseDays = () => loadSetting<number>('captionReuseDays', 0); // 0 = nunca reutilizar

export async function addCaptions(drafts: CaptionDraft[]): Promise<number> {
  const batchId = uid(); const at = nowIso();
  const list: Caption[] = drafts.map(({ sourceRow: _row, ...d }) => ({ ...d, id: uid(), usedAt: [], batchId, createdAt: at, updatedAt: at }));
  await dbPutMany('captions', list); // uma única transação: ou grava tudo, ou nada
  return list.length;
}
export async function saveCaption(c: Caption): Promise<Caption> {
  const updated = { ...c, key: normKey(c.text), updatedAt: nowIso() };
  await dbPut('captions', updated);
  return updated;
}
export const removeCaptions = (ids: string[]) => dbDeleteMany('captions', ids);
export async function markCaptionUsed(c: Caption, at = nowIso()): Promise<Caption> { return saveCaption({ ...c, usedAt: [...c.usedAt, at] }); }
export async function clearCaptionUse(c: Caption): Promise<Caption> { return saveCaption({ ...c, usedAt: [] }); }

export const lastUsed = (c: Caption): string | null => (c.usedAt.length ? c.usedAt.reduce((a, b) => (a > b ? a : b)) : null);
/** Uma legenda está disponível se nunca foi usada ou se já passou o prazo de reutilização (0 = nunca reutilizar). */
export function isAvailable(c: Caption, reuseDays = getCaptionReuseDays(), now = Date.now()): boolean {
  const last = lastUsed(c);
  if (!last) return true;
  if (reuseDays <= 0) return false;
  return now - new Date(last).getTime() >= reuseDays * 86400000;
}
/** Texto completo para copiar/publicar: legenda + chamada para ação + hashtags. */
export function composeCaption(c: Pick<Caption, 'text' | 'cta' | 'hashtags'>): string {
  return [c.text.trim(), c.cta.trim(), c.hashtags.join(' ')].filter(Boolean).join('\n\n');
}
/** Contagem de textos iguais (para destacar duplicadas no banco). */
export function duplicateKeys(list: Caption[]): Set<string> {
  const n = new Map<string, number>(); list.forEach((c) => n.set(c.key, (n.get(c.key) ?? 0) + 1));
  return new Set([...n].filter(([, v]) => v > 1).map(([k]) => k));
}
