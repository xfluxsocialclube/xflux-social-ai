import type { TranslationKey } from '../i18n/pt';

export type PageId = 'overview' | 'guide' | 'library' | 'captions' | 'pairing' | 'calculator' | 'schedule' | 'publishing' | 'autopilot' | 'networks' | 'shopee' | 'reports' | 'goodmorning' | 'help' | 'settings';
export interface NavItem { id: PageId; labelKey: TranslationKey; }

/** Ordem do menu: fluxo principal de organização, planejamento e publicação assistida. */
export const NAV_ITEMS: NavItem[] = [
  { id: 'overview', labelKey: 'nav.overview' },
  { id: 'guide', labelKey: 'nav.guide' },
  { id: 'library', labelKey: 'nav.library' },
  { id: 'captions', labelKey: 'nav.captions' },
  { id: 'pairing', labelKey: 'nav.pairing' },
  { id: 'calculator', labelKey: 'nav.calculator' },
  { id: 'schedule', labelKey: 'nav.schedule' },
  { id: 'publishing', labelKey: 'nav.publishing' },
  { id: 'autopilot', labelKey: 'nav.autopilot' },
  { id: 'networks', labelKey: 'nav.networks' },
  { id: 'shopee', labelKey: 'nav.shopee' },
  { id: 'reports', labelKey: 'nav.reports' },
  { id: 'goodmorning', labelKey: 'nav.goodmorning' },
  { id: 'help', labelKey: 'nav.help' },
  { id: 'settings', labelKey: 'nav.settings' },
];
