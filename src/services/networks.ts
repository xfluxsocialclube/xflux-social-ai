/** Redes do produto, na ordem de prioridade. Nenhuma integração real está ativa (ver services/publishing/adapters.ts). */
export interface NetworkModule { id: string; name: string; color: string; }
export const NETWORKS: NetworkModule[] = [
  { id: 'instagram', name: 'Instagram', color: '#c45bff' },
  { id: 'facebook', name: 'Facebook', color: '#4f7cff' },
  { id: 'tiktok', name: 'TikTok', color: '#3dd6d0' },
  { id: 'shopee', name: 'Shopee Video', color: '#ff9a4d' },
  { id: 'pinterest', name: 'Pinterest', color: '#ff5b7a' },
  { id: 'youtube', name: 'YouTube Shorts', color: '#ff6b5b' },
];
