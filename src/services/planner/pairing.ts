/** Associação vídeo/imagem ↔ legenda. Só usa critérios objetivos (ID, produto, categoria, palavras-chave). Nunca inventa informação. */
import { dbDeleteMany, dbGetAll, dbPut, dbPutMany } from '../db';
import { meaningfulTokens, nowIso, refKey, tokens, uid, yieldToUi } from '../captions/text';
import { isAvailable } from '../captions/store';
import type { Caption } from '../captions/types';
import type { Category, MediaItem } from '../library/types';
import type { MatchReason, Pairing, PairingStatus } from './types';

export const listPairings = () => dbGetAll<Pairing>('pairings');
export const savePairing = (p: Pairing) => dbPut('pairings', { ...p, updatedAt: nowIso() });
export const removePairings = (ids: string[]) => dbDeleteMany('pairings', ids);

export async function createPairing(mediaId: string, captionId: string, status: PairingStatus, source: 'auto' | 'manual', score = 0, reasons: MatchReason[] = []): Promise<Pairing> {
  const at = nowIso();
  const p: Pairing = { id: uid(), mediaId, captionId, status, source, score, reasons, createdAt: at, updatedAt: at };
  await dbPut('pairings', p); return p;
}
export const setPairingStatus = (p: Pairing, status: PairingStatus) => savePairing({ ...p, status });

export const MIN_SCORE = 30;
const SCORE = { id: 100, product: 60, productPartial: 30, category: 20, categoryFile: 10, keyword: 10, keywordMax: 30 };

export function scoreMatch(media: MediaItem, categoryName: string, cap: Caption): { score: number; reasons: MatchReason[] } {
  const base = media.name.replace(/\.[^.]+$/, '');
  const file = new Set(tokens(base).map((w) => (/^\d+$/.test(w) ? String(Number(w)) : w)));
  const catTokens = new Set(tokens(categoryName));
  const reasons: MatchReason[] = []; let score = 0;
  const ref = cap.ref ? refKey(cap.ref) : '';
  if (ref && file.has(ref)) { score += SCORE.id; reasons.push({ kind: 'id', detail: cap.ref }); }
  const pt = meaningfulTokens(cap.product);
  if (pt.length) {
    const hit = pt.filter((w) => file.has(w));
    if (hit.length === pt.length) { score += SCORE.product; reasons.push({ kind: 'product', detail: cap.product }); }
    else if (hit.length >= 1 && hit.length / pt.length >= 0.5 && hit.some((w) => w.length >= 4)) { score += SCORE.productPartial; reasons.push({ kind: 'productPartial', detail: hit.join(' ') }); }
  }
  const ct = tokens(cap.category);
  if (ct.length) {
    if (catTokens.size && ct.length === catTokens.size && ct.every((w) => catTokens.has(w))) { score += SCORE.category; reasons.push({ kind: 'category', detail: cap.category }); }
    else if (ct.every((w) => file.has(w))) { score += SCORE.categoryFile; reasons.push({ kind: 'categoryFile', detail: cap.category }); }
  }
  const kws = cap.keywords.filter((k) => { const kt = tokens(k); return kt.length > 0 && kt.every((w) => file.has(w) || catTokens.has(w)); });
  if (kws.length) { score += Math.min(SCORE.keywordMax, kws.length * SCORE.keyword); reasons.push({ kind: 'keywords', detail: kws.join(', ') }); }
  return { score, reasons };
}

export interface Suggestion { mediaId: string; captionId: string; score: number; reasons: MatchReason[]; }
/** Gera sugestões 1 vídeo ↔ 1 legenda. Ignora vídeos e legendas que já estão em alguma associação ou decisão do usuário. */
export async function buildSuggestions(media: MediaItem[], cats: Category[], captions: Caption[], existing: Pairing[]): Promise<Suggestion[]> {
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const busyMedia = new Set(existing.map((p) => p.mediaId)); const busyCap = new Set(existing.map((p) => p.captionId));
  const freeMedia = media.filter((m) => !busyMedia.has(m.id));
  const freeCaps = captions.filter((c) => !busyCap.has(c.id) && isAvailable(c));
  const cands: Suggestion[] = [];
  for (let i = 0; i < freeMedia.length; i++) {
    if (i > 0 && i % 40 === 0) await yieldToUi();
    const m = freeMedia[i]; const cn = m.categoryId ? catName.get(m.categoryId) ?? '' : '';
    for (const c of freeCaps) { const r = scoreMatch(m, cn, c); if (r.score >= MIN_SCORE) cands.push({ mediaId: m.id, captionId: c.id, ...r }); }
  }
  const capById = new Map(captions.map((c) => [c.id, c])); const mediaById = new Map(media.map((m) => [m.id, m]));
  const num = (c?: Caption) => { const n = Number(c?.ref); return Number.isFinite(n) && c?.ref ? n : Number.MAX_SAFE_INTEGER; };
  cands.sort((a, b) => b.score - a.score || num(capById.get(a.captionId)) - num(capById.get(b.captionId)) || (mediaById.get(a.mediaId)!.name).localeCompare(mediaById.get(b.mediaId)!.name));
  const usedM = new Set<string>(); const usedC = new Set<string>(); const out: Suggestion[] = [];
  for (const s of cands) { if (usedM.has(s.mediaId) || usedC.has(s.captionId)) continue; usedM.add(s.mediaId); usedC.add(s.captionId); out.push(s); }
  return out;
}
/** Substitui as sugestões antigas (não confirmadas) pelas novas. Confirmadas e pendentes não são alteradas. */
export async function applySuggestions(sugs: Suggestion[], existing: Pairing[]): Promise<number> {
  const old = existing.filter((p) => p.status === 'suggested').map((p) => p.id);
  const at = nowIso();
  const list: Pairing[] = sugs.map((s) => ({ id: uid(), mediaId: s.mediaId, captionId: s.captionId, status: 'suggested', source: 'auto', score: s.score, reasons: s.reasons, createdAt: at, updatedAt: at }));
  await removePairings(old); await dbPutMany('pairings', list);
  return list.length;
}
