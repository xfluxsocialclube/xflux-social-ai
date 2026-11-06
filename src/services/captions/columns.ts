/** Identificação automática das colunas da planilha (cabeçalhos em português, inglês e espanhol). */
import { normKey } from './text';
import { CAPTION_FIELDS, type CaptionField, type ColumnMapping } from './types';

const SYN: Record<CaptionField, string[]> = {
  caption: ['legenda', 'legendas', 'caption', 'captions', 'texto', 'texto da legenda', 'copy', 'mensagem', 'post', 'descricao', 'leyenda', 'texto da publicacao', 'texto do post'],
  product: ['produto', 'nome do produto', 'nome produto', 'product', 'product name', 'item', 'producto', 'nombre del producto', 'nome'],
  category: ['categoria', 'category', 'nicho', 'segmento', 'tipo', 'categorias'],
  ref: ['id', 'numero', 'n', 'no', 'num', 'nro', 'codigo', 'cod', 'ref', 'referencia', 'identificador', 'number', 'numero identificador', 'sku', 'indice'],
  cta: ['cta', 'chamada para acao', 'chamada', 'call to action', 'llamada a la accion', 'chamada acao', 'convite'],
  hashtags: ['hashtags', 'hashtag', 'tags', 'etiquetas', '#'],
  network: ['rede', 'rede social', 'redes', 'redes sociais', 'network', 'social network', 'plataforma', 'platform', 'red social', 'red', 'destino', 'canal'],
  keywords: ['palavras chave', 'palavra chave', 'palavras', 'keywords', 'keyword', 'palabras clave', 'palabra clave', 'termos', 'chaves'],
};
const PRIORITY: CaptionField[] = ['caption', 'product', 'category', 'ref', 'cta', 'hashtags', 'network', 'keywords'];

export function emptyMapping(): ColumnMapping { return { caption: -1, product: -1, category: -1, ref: -1, cta: -1, hashtags: -1, network: -1, keywords: -1 }; }

/** Sugere o mapeamento. O usuário sempre confirma ou corrige na tela. */
export function detectMapping(headers: string[], sampleRows: string[][] = []): ColumnMapping {
  const map = emptyMapping();
  const heads = headers.map((h) => normKey(h));
  const cands: { f: CaptionField; c: number; score: number }[] = [];
  heads.forEach((h, c) => {
    if (!h) return;
    for (const f of CAPTION_FIELDS) {
      let best = 0;
      for (const s of SYN[f]) {
        const ns = normKey(s) || s;
        if (h === ns) best = Math.max(best, 100);
        else if ((` ${h} `).includes(` ${ns} `)) best = Math.max(best, h.startsWith(ns) ? 65 : 55);
      }
      if (best) cands.push({ f, c, score: best });
    }
  });
  cands.sort((a, b) => b.score - a.score || PRIORITY.indexOf(a.f) - PRIORITY.indexOf(b.f));
  const usedCols = new Set<number>();
  for (const { f, c } of cands) { if (map[f] === -1 && !usedCols.has(c)) { map[f] = c; usedCols.add(c); } }
  // Sem coluna de legenda pelo nome: usa a coluna de textos mais longos (sugestão; o usuário confirma).
  if (map.caption === -1 && sampleRows.length) {
    let bestCol = -1; let bestAvg = 0;
    for (let c = 0; c < headers.length; c++) {
      if (usedCols.has(c)) continue;
      const avg = sampleRows.reduce((s, r) => s + (r[c]?.length ?? 0), 0) / sampleRows.length;
      if (avg > bestAvg) { bestAvg = avg; bestCol = c; }
    }
    if (bestAvg >= 20) map.caption = bestCol;
  }
  return map;
}
