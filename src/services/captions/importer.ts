/** Validação e preparo das linhas importadas (cabeçalho, mapeamento, incompletas, duplicadas). */
import { normKey, yieldToUi } from './text';
import type { CaptionDraft, ColumnMapping, ImportResult, RowIssue } from './types';

const NETWORK_ALIASES: Record<string, string> = {
  instagram: 'instagram', insta: 'instagram', ig: 'instagram', reels: 'instagram', 'instagram reels': 'instagram',
  facebook: 'facebook', face: 'facebook', fb: 'facebook',
  tiktok: 'tiktok', 'tik tok': 'tiktok', tt: 'tiktok',
  shopee: 'shopee', 'shopee video': 'shopee', 'shopee videos': 'shopee',
  pinterest: 'pinterest', pin: 'pinterest',
  youtube: 'youtube', yt: 'youtube', shorts: 'youtube', 'youtube shorts': 'youtube', 'you tube': 'youtube',
};
const ALL_WORDS = new Set(['todas', 'todos', 'all', 'todas as redes', 'todas redes', 'qualquer', 'any', 'geral', 'todas las redes', 'cualquiera', 'general']);

export function parseNetworks(cell: string): { ids: string[]; unknown: string[] } {
  const ids: string[] = []; const unknown: string[] = [];
  for (const part of cell.split(/[,;/|\n+&]+|\s+e\s+|\s+and\s+|\s+y\s+/i)) {
    const k = normKey(part); if (!k) continue;
    if (ALL_WORDS.has(k)) return { ids: [], unknown };
    const id = NETWORK_ALIASES[k];
    if (id) { if (!ids.includes(id)) ids.push(id); } else unknown.push(part.trim());
  }
  return { ids, unknown };
}
export function parseHashtags(cell: string): string[] {
  const out: string[] = []; const seen = new Set<string>();
  for (const raw of cell.split(/[\s,;]+/)) {
    const w = raw.trim().replace(/^#+/, ''); if (!w) continue;
    const tag = `#${w}`; const k = tag.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(tag); }
  }
  return out;
}
export function parseKeywords(cell: string): string[] {
  return Array.from(new Set(cell.split(/[,;|\n]+/).map((s) => s.trim()).filter(Boolean)));
}

export async function buildDrafts(
  rows: string[][], mapping: ColumnMapping, hasHeader: boolean, existingKeys: Set<string>,
  opts: { allowDuplicates?: boolean; rowBase?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<ImportResult> {
  const data = hasHeader ? rows.slice(1) : rows;
  const offset = (hasHeader ? 2 : 1) + (opts.rowBase ?? 0); // número da linha como aparece no Excel
  const res: ImportResult = { total: data.length, empty: 0, ready: [], issues: [] };
  const seen = new Set<string>();
  const cell = (r: string[], f: keyof ColumnMapping) => (mapping[f] >= 0 ? (r[mapping[f]] ?? '').trim() : '');
  for (let i = 0; i < data.length; i++) {
    if (i > 0 && i % 200 === 0) { opts.onProgress?.(i, data.length); await yieldToUi(); } // não trava a tela
    const r = data[i]; const row = i + offset;
    if (r.every((c) => !c || !c.trim())) { res.empty++; continue; }
    const text = cell(r, 'caption');
    if (!text) { res.issues.push({ row, kind: 'missingCaption' } satisfies RowIssue); continue; }
    const key = normKey(text);
    if (seen.has(key) && !opts.allowDuplicates) { res.issues.push({ row, kind: 'duplicateInFile' }); continue; }
    if (existingKeys.has(key) && !opts.allowDuplicates) { res.issues.push({ row, kind: 'duplicateInBank' }); continue; }
    seen.add(key);
    const net = parseNetworks(cell(r, 'network'));
    if (net.unknown.length) res.issues.push({ row, kind: 'unknownNetwork', detail: net.unknown.join(', ') });
    const product = cell(r, 'product');
    if (!product) res.issues.push({ row, kind: 'noProduct' });
    res.ready.push({
      ref: cell(r, 'ref'), product, category: cell(r, 'category'), text, cta: cell(r, 'cta'),
      hashtags: parseHashtags(cell(r, 'hashtags')), networks: net.ids, keywords: parseKeywords(cell(r, 'keywords')), key, sourceRow: row,
    });
  }
  opts.onProgress?.(data.length, data.length);
  return res;
}
