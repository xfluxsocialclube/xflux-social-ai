/** Funções de texto compartilhadas (normalização, busca, palavras). */
export const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** Texto sem acentos, minúsculo, só letras/números separados por espaço. */
export const normKey = (s: string) => stripAccents(s).replace(/[^a-z0-9]+/g, ' ').trim();
export const STOP_WORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'para', 'com', 'sem', 'e', 'a', 'o', 'as', 'os', 'um', 'uma', 'em', 'no', 'na', 'por',
  'the', 'of', 'and', 'for', 'with', 'to', 'in', 'on', 'el', 'la', 'los', 'las', 'del', 'y', 'con', 'para', 'por',
  'video', 'videos', 'mp4', 'mov', 'img', 'final',
]);
export const tokens = (s: string): string[] => normKey(s).split(' ').filter(Boolean);
export const meaningfulTokens = (s: string): string[] => tokens(s).filter((w) => !STOP_WORDS.has(w));
export const uid = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();
export const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));
/** Valor numérico de um identificador ("007" -> "7") para comparar números com e sem zeros à esquerda. */
export const refKey = (s: string) => { const k = normKey(s).replace(/ /g, ''); return /^\d+$/.test(k) ? String(Number(k)) : k; };
