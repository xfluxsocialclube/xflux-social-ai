/**
 * Decide COMO uma publicação pode acontecer.
 * A operação é local-first: nenhuma rota depende de backend central.
 * Até existir envio oficial implementado e testado, a rota permanece assistida.
 */
import { composeCaption } from '../captions/store';
import type { Caption } from '../captions/types';
import type { MediaItem } from '../library/types';
import type { PlannedPost } from '../planner/types';
import { getFacts } from './catalog';
import type { Blocker } from './types';
import { connectionOf, isLoginImplemented } from '../accounts/local';

/** Nenhuma rede possui envio automático concluído e validado nesta versão. */
export const API_PUBLISH_IMPLEMENTED = false;

export interface RouteInfo { route: 'assisted' | 'api'; blockers: Blocker[]; }
export function planRoute(network: string, now = new Date()): RouteInfo {
  const facts = getFacts(network); const blockers: Blocker[] = [];
  if (!facts || facts.directPublish === 'not-confirmed') blockers.push('not-officially-available');
  if (!isLoginImplemented(network)) blockers.push('provider-not-enabled');
  const connection = connectionOf(network, now);
  if (connection.view === 'not-connected') blockers.push('no-account');
  else if (connection.view === 'expired') blockers.push('token-expired');
  else if (connection.view === 'revoked') blockers.push('token-revoked');
  else if (connection.view === 'error') blockers.push('account-error');
  if (facts?.unattended === 'restricted-by-policy') blockers.push('policy-requires-user');
  if (facts?.directPublish === 'official-restricted') blockers.push('official-review-pending');
  if (!API_PUBLISH_IMPLEMENTED) blockers.push('api-submit-not-implemented');
  return { route: blockers.length === 0 ? 'api' : 'assisted', blockers };
}

export type FieldKey = 'caption' | 'title' | 'description' | 'tags' | 'board' | 'privacy';
export interface PackageField { key: FieldKey; value: string; copy: boolean; userChoice?: boolean; }
export interface PublishPackage {
  network: string; fields: PackageField[]; mediaName: string | null;
  scheduledLocal: string; scheduledUtc: string; timeZone: string;
}
const firstLine = (t: string) => t.split(/\r?\n/)[0].trim();

/** Monta os campos que cada rede pede, só com dados do próprio usuário. */
export function buildPackage(post: PlannedPost, caption: Caption | undefined, media: MediaItem | undefined): PublishPackage {
  const text = caption ? composeCaption(caption) : '';
  const title = caption ? (caption.product || firstLine(caption.text)) : '';
  const f: PackageField[] = [];
  switch (post.network) {
    case 'tiktok': f.push({ key: 'title', value: text, copy: true }, { key: 'privacy', value: '', copy: false, userChoice: true }); break;
    case 'pinterest': f.push({ key: 'title', value: title, copy: true }, { key: 'description', value: text, copy: true }, { key: 'board', value: '', copy: false, userChoice: true }); break;
    case 'youtube': f.push({ key: 'title', value: title, copy: true }, { key: 'description', value: text, copy: true }, { key: 'tags', value: (caption?.keywords ?? []).join(', '), copy: true }, { key: 'privacy', value: '', copy: false, userChoice: true }); break;
    case 'facebook': f.push({ key: 'description', value: text, copy: true }); break;
    default: f.push({ key: 'caption', value: text, copy: true });
  }
  const local = new Date(`${post.day}T${post.time}:00`);
  return {
    network: post.network, fields: f.filter((x) => x.value || x.userChoice), mediaName: media?.name ?? null,
    scheduledLocal: `${post.day} ${post.time}`, scheduledUtc: Number.isNaN(local.getTime()) ? '' : local.toISOString(),
    timeZone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; } })(),
  };
}
