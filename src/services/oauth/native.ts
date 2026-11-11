/** Ponte com os comandos nativos de src-tauri/src/oauth.rs. */
import { invoke } from '@tauri-apps/api/core';
export const isDesktop = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
export type OAuthErrorCode = 'desktop' | 'timeout' | 'denied' | 'state' | 'exchange' | 'profile' | 'vault' | 'generic';
export class OAuthError extends Error {
  constructor(public code: OAuthErrorCode, message = '') { super(message || code); }
}
export interface Callback { code: string | null; state: string | null; error: string | null; }
export async function loopbackStart(): Promise<number> {
  const r = await invoke<{ port: number }>('oauth_loopback_start');
  return r.port;
}
export const loopbackWait = (timeoutSecs: number) => invoke<Callback>('oauth_loopback_wait', { timeoutSecs });
export const openBrowser = (url: string) => invoke<void>('oauth_open_browser', { url });
export async function openExternal(url: string): Promise<void> {
  if (isDesktop()) await openBrowser(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}
export async function http(
  method: 'GET' | 'POST', url: string, opts: { form?: Record<string, string>; bearer?: string } = {},
): Promise<{ status: number; body: unknown }> {
  return invoke<{ status: number; body: unknown }>('oauth_http_request', {
    method, url, form: opts.form ? Object.entries(opts.form) : null, bearer: opts.bearer ?? null,
  });
}
