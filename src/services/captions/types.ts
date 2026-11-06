/** Tipos do FLUX Caption Bank (banco de legendas). */
export type CaptionField = 'ref' | 'product' | 'category' | 'caption' | 'cta' | 'hashtags' | 'network' | 'keywords';
export const CAPTION_FIELDS: CaptionField[] = ['caption', 'product', 'category', 'ref', 'cta', 'hashtags', 'network', 'keywords'];

export interface Caption {
  id: string;
  ref: string;            // número/identificador informado pelo usuário na planilha
  product: string;
  category: string;
  text: string;           // legenda
  cta: string;            // chamada para ação
  hashtags: string[];     // sempre começam com #
  networks: string[];     // ids de redes (ver services/networks.ts); lista vazia = qualquer rede
  keywords: string[];
  key: string;            // texto normalizado, usado para achar legendas duplicadas
  usedAt: string[];       // datas (ISO) em que a legenda foi marcada como usada
  batchId: string;        // lote de importação
  createdAt: string;
  updatedAt: string;
}
/** Rascunho de legenda ainda não gravada no banco. */
export type CaptionDraft = Omit<Caption, 'id' | 'usedAt' | 'batchId' | 'createdAt' | 'updatedAt'> & { sourceRow: number };

export type ColumnMapping = Record<CaptionField, number>; // índice da coluna na planilha; -1 = não usar

export type IssueKind = 'missingCaption' | 'duplicateInFile' | 'duplicateInBank' | 'unknownNetwork' | 'noProduct';
export interface RowIssue { row: number; kind: IssueKind; detail?: string; }
export interface ImportResult {
  total: number;          // linhas de dados lidas (sem cabeçalho)
  empty: number;          // linhas totalmente em branco (ignoradas)
  ready: CaptionDraft[];  // prontas para importar
  issues: RowIssue[];
}
