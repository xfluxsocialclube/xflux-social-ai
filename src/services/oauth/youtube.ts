/**
 * Login YouTube para app desktop: navegador externo, loopback 127.0.0.1 e PKCE.
 * O cliente configura suas próprias credenciais; tokens ficam no cofre do Windows.
 */
import { removeLocalAccount, saveLocalAccount, updateLocalAccountState } from '../accounts/local';
import type { ConnectedAccount } from '../publishing/types';
import { readAppCredentials, readTokens, saveTokens, VaultError } from '../security/credentialVault';
import { http, isDesktop, loopbackStart, loopbackWait, OAuthError, openBrowser } from './native';
import { pkcePair, randomString } from './pkce';

const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const REVOKE = 'https://oauth2.googleapis.com/revoke';
const CHANNELS = 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true';
const UPLOAD = 'https://www.googleapis.com/auth/youtube.upload';
export const YT_SCOPES = [UPLOAD, 'https://www.googleapis.com/auth/youtube.readonly'];
const obj = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? v as Record<string, unknown> : {});
const str = (v: unknown): string => typeof v === 'string' ? v : '';

export async function connectYouTube(): Promise<ConnectedAccount> {
  if (!isDesktop()) throw new OAuthError('desktop');
  const app = await readAppCredentials('youtube');
  if (!app) throw new OAuthError('generic', 'missing-app-credentials');
  const { verifier, challenge } = await pkcePair();
  const state = randomString(24);
  const port = await loopbackStart();
  const redirect = `http://127.0.0.1:${port}/callback`;
  const params = new URLSearchParams({
    client_id: app.clientId, redirect_uri: redirect, response_type: 'code', scope: YT_SCOPES.join(' '),
    code_challenge: challenge, code_challenge_method: 'S256', state, access_type: 'offline', prompt: 'consent',
  });
  await openBrowser(`${AUTH}?${params.toString()}`);
  let cb;
  try { cb = await loopbackWait(300); }
  catch (e) { throw new OAuthError(String(e).includes('timeout') ? 'timeout' : 'generic'); }
  if (cb.error) throw new OAuthError(cb.error === 'access_denied' ? 'denied' : 'generic');
  if (!cb.code || cb.state !== state) throw new OAuthError('state');
  const tok = await http('POST', TOKEN, { form: {
    client_id: app.clientId, client_secret: app.clientSecret, code: cb.code, code_verifier: verifier,
    grant_type: 'authorization_code', redirect_uri: redirect,
  } });
  const tb = obj(tok.body);
  const accessToken = str(tb.access_token), refreshToken = str(tb.refresh_token);
  const granted = str(tb.scope).split(' ').filter(Boolean);
  if (tok.status !== 200 || !accessToken || !refreshToken) throw new OAuthError('exchange');
  if (!granted.includes(UPLOAD)) throw new OAuthError('denied');
  const expiresAt = new Date(Date.now() + (Number(tb.expires_in) || 3600) * 1000).toISOString();
  const me = await http('GET', CHANNELS, { bearer: accessToken });
  const items = me.status === 200 ? obj(me.body).items : null;
  const first = Array.isArray(items) ? obj(items[0]) : {};
  const channelId = str(first.id);
  if (!channelId) throw new OAuthError('profile');
  const displayName = str(obj(first.snippet).title) || 'YouTube';
  try { await saveTokens('youtube', channelId, { accessToken, refreshToken, expiresAt, scopes: granted }); }
  catch (e) { if (e instanceof VaultError) throw new OAuthError('vault'); throw e; }
  const now = new Date().toISOString();
  const account: ConnectedAccount = {
    id: channelId, network: 'youtube', displayName, state: 'connected',
    scopes: granted, connectedAt: now, expiresAt, lastCheckedAt: now,
  };
  saveLocalAccount(account);
  return account;
}

export async function getYouTubeAccessToken(accountId: string): Promise<string> {
  const t = await readTokens('youtube', accountId);
  if (!t) throw new OAuthError('generic', 'no-token');
  if (t.expiresAt && Date.parse(t.expiresAt) - Date.now() > 120_000) return t.accessToken;
  const app = await readAppCredentials('youtube');
  if (!t.refreshToken || !app) {
    updateLocalAccountState(accountId, 'expired', { code: 'token-expired', message: 'no-refresh-token' });
    throw new OAuthError('denied');
  }
  const r = await http('POST', TOKEN, { form: {
    client_id: app.clientId, client_secret: app.clientSecret, refresh_token: t.refreshToken, grant_type: 'refresh_token',
  } });
  const b = obj(r.body);
  if (r.status !== 200 || !str(b.access_token)) {
    if (str(b.error) === 'invalid_grant') updateLocalAccountState(accountId, 'expired', { code: 'token-expired', message: 'invalid_grant' });
    throw new OAuthError(str(b.error) === 'invalid_grant' ? 'denied' : 'exchange');
  }
  const accessToken = str(b.access_token);
  const expiresAt = new Date(Date.now() + (Number(b.expires_in) || 3600) * 1000).toISOString();
  await saveTokens('youtube', accountId, { ...t, accessToken, refreshToken: str(b.refresh_token) || t.refreshToken, expiresAt });
  return accessToken;
}
export async function verifyYouTube(accountId: string): Promise<void> {
  const token = await getYouTubeAccessToken(accountId);
  const r = await http('GET', CHANNELS, { bearer: token });
  if (r.status === 401) { updateLocalAccountState(accountId, 'expired', { code: 'token-expired', message: '401' }); throw new OAuthError('denied'); }
  if (r.status !== 200) throw new OAuthError('generic');
  updateLocalAccountState(accountId, 'connected');
}
export async function disconnectYouTube(accountId: string): Promise<void> {
  try {
    const t = await readTokens('youtube', accountId);
    const token = t?.refreshToken ?? t?.accessToken;
    if (token) await http('POST', REVOKE, { form: { token } });
  } catch { /* sem rede: a remoção local continua */ }
  await removeLocalAccount(accountId);
}
