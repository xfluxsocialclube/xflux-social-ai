/**
 * Decide COMO uma publicação pode acontecer. Hoje a rota é sempre "assistida": o aplicativo ainda não envia nada às redes.
 * A lista de "bloqueios" mostra ao usuário, de forma honesta, o que falta para existir publicação automática.
 */
import { composeCaption } from '../captions/store';
import type { Caption } from '../captions/types';
import type { MediaItem } from '../library/types';
import { connectionOf, type BackendSnapshot } from '../backend/accounts';
import type { PlannedPost } from '../planner/types';
import { getFacts } from './catalog';
import type { Blocker } from './types';

/** Enquanto o envio por API não estiver implementado e testado com credenciais reais, nenhuma publicação é automática. */
export const API_PUBLISH_IMPLEMENTED = false;

export interface RouteInfo { route: 'assisted' | 'api'; blockers: Blocker[]; }
export function planRoute(network: string, snap: BackendSnapshot, now = new Date()): RouteInfo {
  const facts = getFacts(network); const b: Blocker[] = [];
  if (!facts || facts.directPublish === 'not-confirmed') b.push('not-officially-available');
  if (!snap.url) b.push('no-backend');
  else if (snap.reachable !== true) b.push('backend-unreachable');
  else {
    const prov = snap.health?.providers.find((p) => p.network === network);
    if (!prov || !prov.publishing) b.push('provider-not-enabled');
    const c = connectionOf(network, snap, now);
    if (c.view === 'not-connected') b.push('no-account'); else if (c.view === 'expired') b.push('token-expired'); else if (c.view === 'revoked') b.push('token-revoked'); else if (c.view === 'error') b.push('account-error');
    if (!snap.health?.capabilities.includes('publishing')) b.push('backend-no-publishing');
  }
  if (facts?.unattended === 'restricted-by-policy') b.push('policy-requires-user');
  if (facts?.directPublish === 'official-restricted') b.push('official-review-pending');
  if (!API_PUBLISH_IMPLEMENTED) b.push('api-submit-not-implemented');
  return { route: b.length === 0 ? 'api' : 'assisted', blockers: b };
}

export type FieldKey = 'caption' | 'title' | 'description' | 'tags' | 'board' | 'privacy';
export interface PackageField { key: FieldKey; value: string; copy: boolean; userChoice?: boolean; }
export interface PublishPackage {
  network: string; fields: PackageField[]; mediaName: string | null;
  scheduledLocal: string; scheduledUtc: string; timeZone: string;
}
const firstLine = (t: string) => t.split(/\r?\n/)[0].trim();

/** Monta os campos que cada rede pede, só com dados do próprio usuário. Escolhas que são dele (quadro, privacidade) ficam em branco. */
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
