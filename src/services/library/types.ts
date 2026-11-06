export type MediaKind = 'image' | 'video';
export interface MediaItem {
  id: string;
  name: string;
  ext: string;
  mime: string;
  kind: MediaKind;
  size: number;
  hash: string;            // SHA-256 do conteúdo (detecção de duplicados)
  path: string;            // caminho relativo dentro da pasta da biblioteca
  importedAt: string;      // ISO
  categoryId: string | null;
  width?: number;
  height?: number;
  duration?: number;       // segundos (vídeos)
  thumb?: Blob;            // miniatura pequena (não é o arquivo original)
  ai: null;                // reservado: resultado de análise por IA (futuro)
}
export interface Category { id: string; name: string; }
export type HistoryAction = 'import' | 'duplicate' | 'delete' | 'category';
export interface HistoryEntry { id: string; at: string; action: HistoryAction; mediaId: string; name: string; }
/** Registro de uso de um arquivo em uma publicação (alimentado pelos módulos de publicação futuros). */
export interface UsageRecord { id: string; mediaId: string; mediaName: string; network: string; postRef: string | null; at: string; }
export type RejectReason = 'type' | 'size' | 'error';
export interface ImportReport { imported: number; duplicates: number; rejected: { name: string; reason: RejectReason }[]; }
