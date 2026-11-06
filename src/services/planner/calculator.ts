/** Calculadora de conteúdo: publicação ≠ pacote de conteúdo (um vídeo + uma legenda pode virar várias publicações). */
import type { CaptionMode } from './types';

export interface CalcInput {
  weeks: number; daysPerWeek: number; postsPerDay: number;
  networks: number;                 // quantidade de redes de destino
  crossPost: boolean;               // mesmo pacote em todas as redes?
  captionMode: CaptionMode;
  allowMediaReuse: boolean; mediaRepeatDays: number;
  allowCaptionReuse: boolean; captionReuseDays: number;
  availableMedia: number; availableCaptions: number;
}
export interface CalcResult {
  packages: number;           // pacotes de conteúdo (cada um = 1 vídeo/imagem + legenda(s))
  publications: number;       // publicações nas redes
  mediaNeeded: number; captionsNeeded: number;
  mediaMissing: number; captionsMissing: number;
  mediaSaved: number; captionsSaved: number;   // economizados pelo reaproveitamento
  coverableWeeks: number;     // semanas que o estoque atual cobre com as mesmas regras (máx. 52)
}
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.floor(Number.isFinite(n) ? n : 0)));

/** Quantidade mínima de itens diferentes para que nenhum se repita antes de `days` dias (pior caso). */
export function uniqueNeeded(packages: number, weeks: number, daysPerWeek: number, postsPerDay: number, days: number): number {
  const w = Math.max(1, days);
  const publishDays = Math.min(weeks * daysPerWeek, Math.floor(w / 7) * daysPerWeek + Math.min(w % 7, daysPerWeek));
  return Math.min(packages, publishDays * postsPerDay);
}

export function calculate(raw: CalcInput): CalcResult {
  const i = { ...raw, weeks: clamp(raw.weeks, 0, 52), daysPerWeek: clamp(raw.daysPerWeek, 0, 7), postsPerDay: clamp(raw.postsPerDay, 0, 20), networks: clamp(raw.networks, 1, 6) };
  const at = (weeks: number) => {
    const packages = weeks * i.daysPerWeek * i.postsPerDay;
    const publications = i.crossPost ? packages * i.networks : packages;
    const perPackage = i.crossPost && i.captionMode === 'perNetwork' ? i.networks : 1;
    const captionsTotal = packages * perPackage;
    const mediaNeeded = i.allowMediaReuse ? uniqueNeeded(packages, weeks, i.daysPerWeek, i.postsPerDay, i.mediaRepeatDays) : packages;
    const captionsNeeded = i.allowCaptionReuse
      ? uniqueNeeded(packages, weeks, i.daysPerWeek, i.postsPerDay, i.captionReuseDays) * perPackage : captionsTotal;
    return { packages, publications, captionsTotal, mediaNeeded, captionsNeeded };
  };
  const r = at(i.weeks);
  let coverable = 0;
  for (let w = 1; w <= 52; w++) { const x = at(w); if (x.mediaNeeded <= i.availableMedia && x.captionsNeeded <= i.availableCaptions) coverable = w; else break; }
  return {
    packages: r.packages, publications: r.publications, mediaNeeded: r.mediaNeeded, captionsNeeded: r.captionsNeeded,
    mediaMissing: Math.max(0, r.mediaNeeded - i.availableMedia), captionsMissing: Math.max(0, r.captionsNeeded - i.availableCaptions),
    mediaSaved: r.packages - r.mediaNeeded, captionsSaved: r.captionsTotal - r.captionsNeeded, coverableWeeks: coverable,
  };
}
