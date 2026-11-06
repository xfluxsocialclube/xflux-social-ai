/** Motor de distribuição: coloca pacotes de conteúdo (vídeo + legenda) nos dias e horários do plano. Função pura e testável. */
import { diffDays, enumerateDays, weekdayIdx } from './dates';
import { uid } from '../captions/text';
import type { Caption } from '../captions/types';
import type { PendingReason, PlanConfig, PlannedPost } from './types';

export interface GenInput {
  planId: string; config: PlanConfig;
  /** Associações CONFIRMADAS (mídia + legenda). */
  pairings: { id: string; mediaId: string; captionId: string }[];
  captions: Map<string, Caption>;
  allMediaIds: string[];                 // usado só quando o usuário permite publicar sem associação
  mediaLastUse: Map<string, string>;     // mediaId -> último dia de uso (AAAA-MM-DD)
  captionLastUse: Map<string, string>;
  fromDate?: string;                     // gera apenas a partir desta data
  occupied?: Set<string>;                // "dia|hora|rede" já ocupados por publicações mantidas
}
const refNum = (c?: Caption) => { const n = Number(c?.ref); return Number.isFinite(n) && c?.ref !== '' ? n : Number.MAX_SAFE_INTEGER; };

export function planDays(config: PlanConfig, fromDate?: string): string[] {
  return enumerateDays(config.startDate, config.lengthDays).filter((d) => config.weekdays.includes(weekdayIdx(d)) && (!fromDate || d >= fromDate));
}
export const sortedTimes = (config: PlanConfig) => Array.from(new Set(config.times)).sort();

export function generatePosts(input: GenInput): PlannedPost[] {
  const { config, captions } = input;
  const mediaLast = new Map(input.mediaLastUse); const capLast = new Map(input.captionLastUse);
  const out: PlannedPost[] = []; const times = sortedTimes(config); const nets = config.networks;
  if (!nets.length || !times.length) return out;
  let slot = 0;

  const mediaOk = (id: string, day: string) => { const l = mediaLast.get(id); return !l || config.mediaRepeatDays <= 0 || diffDays(l, day) >= config.mediaRepeatDays; };
  const captionOk = (id: string, day: string) => { const l = capLast.get(id); return !l || (config.captionReuseDays > 0 && diffDays(l, day) >= config.captionReuseDays); };
  const netOk = (capId: string, net: string) => { const n = captions.get(capId)?.networks ?? []; return n.length === 0 || n.includes(net); };
  const order = (a: { mediaId: string; captionId: string }, b: { mediaId: string; captionId: string }) =>
    (mediaLast.get(a.mediaId) ?? '').localeCompare(mediaLast.get(b.mediaId) ?? '') || refNum(captions.get(a.captionId)) - refNum(captions.get(b.captionId));

  for (const day of planDays(config, input.fromDate)) {
    for (const time of times) {
      const slotNets = config.crossPost ? nets : [nets[slot % nets.length]]; slot++;
      const free = slotNets.filter((n) => !input.occupied?.has(`${day}|${time}|${n}`));
      if (!free.length) continue;
      const base = { planId: input.planId, day, time };
      const picked = new Map<string, { id: string | null; mediaId: string; captionId: string | null; unpaired?: boolean }>();

      const pool = [...input.pairings].filter((p) => captions.has(p.captionId)).sort(order);
      if (config.crossPost && config.captionMode === 'perNetwork' && free.length > 1) {
        // uma legenda diferente para cada rede, mas o MESMO vídeo
        const byMedia = new Map<string, typeof pool>(); pool.forEach((p) => byMedia.set(p.mediaId, [...(byMedia.get(p.mediaId) ?? []), p]));
        for (const [mediaId, list] of byMedia) {
          if (!mediaOk(mediaId, day)) continue;
          const chosen = new Map<string, typeof pool[number]>(); const taken = new Set<string>();
          for (const n of free) { const p = list.find((x) => !taken.has(x.captionId) && captionOk(x.captionId, day) && netOk(x.captionId, n)); if (p) { chosen.set(n, p); taken.add(p.captionId); } }
          if (chosen.size === free.length) { chosen.forEach((p, n) => picked.set(n, { id: p.id, mediaId, captionId: p.captionId })); break; }
        }
      } else {
        const p = pool.find((x) => mediaOk(x.mediaId, day) && captionOk(x.captionId, day) && free.every((n) => netOk(x.captionId, n)));
        if (p) free.forEach((n) => picked.set(n, { id: p.id, mediaId: p.mediaId, captionId: p.captionId }));
      }
      if (!picked.size && config.allowUnpaired) {
        // escolha explícita do usuário: publicar sem associação confirmada (vídeo sem legenda automática)
        const paired = new Set(input.pairings.map((p) => p.mediaId));
        const m = [...input.allMediaIds].filter((id) => mediaOk(id, day)).sort((a, b) => (mediaLast.get(a) ?? '').localeCompare(mediaLast.get(b) ?? '') || Number(paired.has(a)) - Number(paired.has(b)))[0];
        if (m) free.forEach((n) => picked.set(n, { id: null, mediaId: m, captionId: null, unpaired: true }));
      }

      if (picked.size) {
        picked.forEach((v, net) => {
          out.push({ ...base, id: uid(), network: net, mediaId: v.mediaId, captionId: v.captionId, pairingId: v.id, status: 'scheduled', unpaired: v.unpaired });
          mediaLast.set(v.mediaId, day); if (v.captionId) capLast.set(v.captionId, day);
        });
      } else {
        let reason: PendingReason = 'noContent';
        if (!pool.length) reason = 'noPairing';
        else {
          const byMedia = pool.filter((p) => !mediaOk(p.mediaId, day)).length;
          if (byMedia === pool.length) reason = 'noMedia';
          else if (pool.filter((p) => mediaOk(p.mediaId, day) && !captionOk(p.captionId, day)).length === pool.length - byMedia) reason = 'noCaption';
        }
        free.forEach((net) => out.push({ ...base, id: uid(), network: net, mediaId: null, captionId: null, pairingId: null, status: 'pending', reason }));
      }
    }
  }
  return out;
}
