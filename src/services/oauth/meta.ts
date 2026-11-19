import { isTauri } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { deleteOAuthCredential, readOAuthCredential, storeOAuthCredential } from '../security/credentialVault';

const WORKER_URL = 'https://xflux-social-ai.shopeexflux.workers.dev';
const DEVICE_PROVIDER = 'xflux-device';
const DEVICE_ACCOUNT = 'meta';
const META_PROVIDER = 'meta';

interface DeviceSession {
  deviceId: string;
  deviceSecret: string;
}

interface MetaToken {
  accessToken: string;
  tokenType: string;
  expiresAt: number | null;
  savedAt: number;
}

interface OAuthStartResponse {
  authorizationUrl: string;
}

interface OAuthResult {
  pending: boolean;
  accessToken?: string;
  tokenType?: string;
  expiresAt?: number | null;
  error?: string;
}

async function jsonRequest<T>(path: string, init: RequestInit = {}, session?: DeviceSession): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (session) {
    headers.set('x-xflux-device', session.deviceId);
    headers.set('x-xflux-device-secret', session.deviceSecret);
  }
  const response = await fetch(`${WORKER_URL}${path}`, {
    ...init,
    credentials: 'omit',
    cache: 'no-store',
    headers,
  });
  if (!response.ok) {
    if (response.status === 410) throw new Error('A autorização demorou demais. Volte ao XFLUX e tente novamente.');
    if (response.status === 401) throw new Error('A instalação não foi reconhecida. Tente conectar novamente.');
    throw new Error('Não foi possível concluir a conexão com a Meta. Tente novamente.');
  }
  return response.json() as Promise<T>;
}

async function getDeviceSession(): Promise<DeviceSession> {
  const saved = await readOAuthCredential(DEVICE_PROVIDER, DEVICE_ACCOUNT);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as DeviceSession;
      if (parsed.deviceId && parsed.deviceSecret) return parsed;
    } catch {
      // Registro local inválido: cria um novo sem afetar os dados do usuário.
    }
  }

  const created = await jsonRequest<DeviceSession>('/device/register', { method: 'POST' });
  if (!created.deviceId || !created.deviceSecret) throw new Error('O serviço não confirmou o registro desta instalação.');
  await storeOAuthCredential(DEVICE_PROVIDER, JSON.stringify(created), DEVICE_ACCOUNT);
  return created;
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export type MetaAuthorizationState = 'none' | 'saved' | 'expired';

export async function getMetaAuthorizationState(): Promise<MetaAuthorizationState> {
  if (!isTauri()) return 'none';
  const raw = await readOAuthCredential(META_PROVIDER);
  if (!raw) return 'none';
  try {
    const token = JSON.parse(raw) as MetaToken;
    if (!token.accessToken) return 'none';
    if (token.expiresAt && token.expiresAt * 1000 <= Date.now()) return 'expired';
    return 'saved';
  } catch {
    return 'none';
  }
}

export async function disconnectMetaAuthorization(): Promise<void> {
  if (!isTauri()) throw new Error('A conexão oficial está disponível no aplicativo instalado para Windows.');
  await deleteOAuthCredential(META_PROVIDER);
}

export async function connectMetaAuthorization(onStatus?: (message: string) => void): Promise<void> {
  if (!isTauri()) throw new Error('A conexão oficial está disponível no aplicativo instalado para Windows.');
  onStatus?.('Preparando a conexão segura...');
  const session = await getDeviceSession();
  const started = await jsonRequest<OAuthStartResponse>('/oauth/meta/start', {
    method: 'POST',
    body: JSON.stringify({}),
  }, session);

  let authorization: URL;
  try {
    authorization = new URL(started.authorizationUrl);
  } catch {
    throw new Error('A Meta retornou um endereço de autorização inválido.');
  }
  if (authorization.protocol !== 'https:' || authorization.hostname !== 'www.facebook.com') {
    throw new Error('O endereço de autorização não pertence ao site oficial da Meta.');
  }

  onStatus?.('Abrindo o login oficial da Meta...');
  await openUrl(authorization.toString());
  onStatus?.('Aguardando você concluir a autorização no navegador...');

  // A resposta OAuth fica disponível por até dez minutos e só pode ser retirada uma vez.
  for (let attempt = 0; attempt < 300; attempt += 1) {
    await wait(2000);
    const result = await jsonRequest<OAuthResult>('/oauth/meta/result', { method: 'GET' }, session);
    if (result.pending) continue;
    if (result.error === 'authorization_cancelled') throw new Error('Você cancelou ou recusou a autorização na Meta.');
    if (result.error === 'token_exchange_failed') throw new Error('A Meta não confirmou a autorização. Confira a configuração do aplicativo e tente novamente.');
    if (result.error) throw new Error('A Meta não concluiu a autorização. Volte ao XFLUX e tente novamente.');
    if (!result.accessToken) throw new Error('A Meta não entregou uma credencial válida. Tente novamente.');
    const token: MetaToken = {
      accessToken: result.accessToken,
      tokenType: result.tokenType || 'bearer',
      expiresAt: result.expiresAt ?? null,
      savedAt: Math.floor(Date.now() / 1000),
    };
    await storeOAuthCredential(META_PROVIDER, JSON.stringify(token));
    onStatus?.('Autorização recebida e salva no cofre seguro do Windows.');
    return;
  }
  throw new Error('A autorização não foi concluída dentro do prazo. Você pode tentar novamente.');
}
