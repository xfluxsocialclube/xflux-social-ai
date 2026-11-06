/**
 * Catálogo do que cada plataforma oferece OFICIALMENTE para publicar, conforme a pesquisa de 05/11/2026.
 * Fontes e detalhes: docs/INTEGRACOES-OFICIAIS.md. As frases mostradas ao usuário ficam nas traduções (pub.fact.*).
 * Regra: o que não foi confirmado em fonte oficial aparece como "não confirmado" ou "não documentado". Nada é presumido.
 */
import type { TranslationKey } from '../../i18n/pt';
import type { Availability, ScheduleSupport, Unattended } from './types';

export interface PlatformFacts {
  id: string;
  checkedOn: string;
  directPublish: Availability;      // publicar vídeo por API oficial
  nativeSchedule: ScheduleSupport;  // a API da plataforma agenda sozinha?
  unattended: Unattended;           // dá para publicar sem o usuário na frente, respeitando as regras oficiais?
  facts: TranslationKey[];
  sources: { label: string; url: string }[];
}
export const CHECKED_ON = '2026-11-05';
const k = (id: string, n: number) => Array.from({ length: n }, (_, i) => `pub.fact.${id}.${i + 1}` as TranslationKey);

export const CATALOG: PlatformFacts[] = [
  { id: 'instagram', checkedOn: CHECKED_ON, directPublish: 'official', nativeSchedule: 'not-documented', unattended: 'possible-with-backend', facts: k('instagram', 6),
    sources: [{ label: 'Instagram Platform — Content Publishing', url: 'https://developers.facebook.com/documentation/instagram-platform/content-publishing' }] },
  { id: 'facebook', checkedOn: CHECKED_ON, directPublish: 'official', nativeSchedule: 'not-documented', unattended: 'possible-with-backend', facts: k('facebook', 7),
    sources: [{ label: 'Video API — Reels Publishing API', url: 'https://developers.facebook.com/documentation/video-api/guides/reels-publishing' }] },
  { id: 'tiktok', checkedOn: CHECKED_ON, directPublish: 'official-restricted', nativeSchedule: 'not-documented', unattended: 'restricted-by-policy', facts: k('tiktok', 6),
    sources: [{ label: 'TikTok for Developers — Direct Post', url: 'https://developers.tiktok.com/doc/content-posting-api-reference-direct-post' }, { label: 'TikTok — Content Sharing Guidelines', url: 'https://developers.tiktok.com/doc/content-sharing-guidelines' }] },
  { id: 'shopee', checkedOn: CHECKED_ON, directPublish: 'not-confirmed', nativeSchedule: 'not-documented', unattended: 'not-available', facts: k('shopee', 4),
    sources: [{ label: 'Shopee Open Platform (documentos)', url: 'https://open.shopee.com/developer-guide' }] },
  { id: 'pinterest', checkedOn: CHECKED_ON, directPublish: 'official-restricted', nativeSchedule: 'not-documented', unattended: 'possible-with-backend', facts: k('pinterest', 4),
    sources: [{ label: 'Pinterest — Access tiers', url: 'https://developers.pinterest.com/docs/key-concepts/access-tiers/' }] },
  { id: 'youtube', checkedOn: CHECKED_ON, directPublish: 'official', nativeSchedule: 'official', unattended: 'possible-with-backend', facts: k('youtube', 5),
    sources: [{ label: 'YouTube Data API — videos.insert', url: 'https://developers.google.com/youtube/data/reference/rest/v3/videos/insert' }] },
];
export const getFacts = (id: string) => CATALOG.find((c) => c.id === id);
