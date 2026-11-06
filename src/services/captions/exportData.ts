/** Exportação do banco de legendas para CSV e XLSX. Os cabeçalhos seguem o idioma atual e são reconhecidos na reimportação. */
import { toCsv } from './csv';
import { writeXlsx } from './xlsx';
import { NETWORKS } from '../networks';
import type { Caption } from './types';

export type ExportHeaders = { ref: string; product: string; category: string; caption: string; cta: string; hashtags: string; network: string; keywords: string; used: string; usedCount: string };
export function buildExportRows(list: Caption[], h: ExportHeaders): string[][] {
  const name = (id: string) => NETWORKS.find((n) => n.id === id)?.name ?? id;
  const head = [h.ref, h.product, h.category, h.caption, h.cta, h.hashtags, h.network, h.keywords, h.used, h.usedCount];
  return [head, ...list.map((c) => [
    c.ref, c.product, c.category, c.text, c.cta, c.hashtags.join(' '), c.networks.map(name).join(', '), c.keywords.join(', '),
    c.usedAt.length ? c.usedAt.reduce((a, b) => (a > b ? a : b)).slice(0, 10) : '', c.usedAt.length ? String(c.usedAt.length) : '',
  ])];
}
export function download(data: BlobPart, fileName: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export const exportCsv = (rows: string[][], file: string) => download(toCsv(rows), file, 'text/csv;charset=utf-8');
export function exportXlsx(rows: string[][], file: string) {
  const bytes = writeXlsx(rows, 'Legendas', [8, 24, 18, 60, 28, 30, 18, 24, 12, 8]);
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  download(copy, file, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
