import { isTauri } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { deleteOAuthCredential, readOAuthCredential, storeOAuthCredential } from '../security/credentialVault';

const WORKER_URL = 'https://xflux-social-ai.shopeexflux.workers.dev';
const DEVICE_PROVIDER = 'xflux-device';
const DEVICE_ACCOUNT = 'meta';
const META_PROVIDER = 'meta';
const REQUEST_TIMEOUT_MS = 15000;
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 300; // até 10 minutos, como a validade do Worker
const MAX_CONSECUTIVE_FAILURES = 5;

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

/** Lançado quando o usuário cancela a conexão (ou sai da tela). */
export class MetaCancelled extends Error {
  constructor() { super('Conexão cancelada.'); this.name = 'MetaCancelled'; }
}
class MetaHttpError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'MetaHttpError'; }
}

async function jsonRequest<T>(path: string, init: RequestInit = {}, session?: DeviceSession, signal?: AbortSignal): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (session) {
    headers.set('x-xflux-device', session.deviceId);
    headers.set('x-xflux-device-secret', session.deviceSecret);
  }
  const signals: AbortSignal[] = [AbortSignal.timeout(REQUEST_TIMEOUT_MS)];
  if (signal) signals.push(signal);

  let response: Response;
  try {
    response = await fetch(`${WORKER_URL}${path}`, {
      ...init,
      credentials: 'omit',
      cache: 'no-store',
      headers,
      signal: AbortSignal.any(signals),
    });
  } catch {
    if (signal?.aborted) throw new MetaCancelled();
    throw new MetaHttpError(0, 'Sem resposta do serviço de autorização. Verifique sua internet e tente novamente.');
  }
  if (!response.ok) {
    if (response.status === 410) throw new MetaHttpError(410, 'A autorização demorou demais. Volte ao XFLUX e tente novamente.');
    if (response.status === 401) throw new MetaHttpError(401, 'A instalação não foi reconhecida. Tente conectar novamente.');
    if (response.status === 503) throw new MetaHttpError(503, 'O serviço de autorização da Meta ainda não foi configurado. Avise o responsável pelo XFLUX.');
    throw new MetaHttpError(response.status, 'Não foi possível concluir a conexão com a Meta. Tente novamente.');
  }
  return response.json() as Promise<T>;
}

async function getDeviceSession(signal?: AbortSignal): Promise<DeviceSession> {
  const saved = await readOAuthCredential(DEVICE_PROVIDER, DEVICE_ACCOUNT);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as DeviceSession;
      if (parsed.deviceId && parsed.deviceSecret) return parsed;
    } catch {
      // Registro local inválido: cria um novo sem afetar os dados do usuário.
    }
  }
  const created = await jsonRequest<DeviceSession>('/device/register', { method: 'POST' }, undefined, signal);
  if (!created.deviceId || !created.deviceSecret) throw new Error('O serviço não confirmou o registro desta instalação.');
  await storeOAuthCredential(DEVICE_PROVIDER, JSON.stringify(created), DEVICE_ACCOUNT);
  return created;
}

const wait = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) { reject(new MetaCancelled()); return; }
  const onAbort = () => { window.clearTimeout(id); reject(new MetaCancelled()); };
  const id = window.setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
  signal?.addEventListener('abort', onAbort, { once: true });
});

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

export interface ConnectOptions {
  /** Permite cancelar a conexão (botão Cancelar ou saída da tela). */
  signal?: AbortSignal;
  /** Recebe o link de autorização para a tela oferecer "Copiar link". */
  onAuthorizationUrl?: (url: string) => void;
}

export async function connectMetaAuthorization(onStatus?: (message: string) => void, options: ConnectOptions = {}): Promise<void> {
  const { signal, onAuthorizationUrl } = options;
  if (!isTauri()) throw new Error('A conexão oficial está disponível no aplicativo instalado para Windows.');

  onStatus?.('Preparando a conexão segura...');
  const session = await getDeviceSession(signal);
  const started = await jsonRequest<OAuthStartResponse>('/oauth/meta/start', {
    method: 'POST',
    body: JSON.stringify({}),
  }, session, signal);

  let authorization: URL;
  try {
    authorization = new URL(started.authorizationUrl);
  } catch {
    throw new Error('A Meta retornou um endereço de autorização inválido.');
  }
  if (authorization.protocol !== 'https:' || authorization.hostname !== 'www.facebook.com') {
    throw new Error('O endereço de autorização não pertence ao site oficial da Meta.');
  }
  // O ID de um app da Meta é numérico. Se não for, o Facebook mostraria "ID do App inválido":
  // melhor avisar aqui, sem abrir nenhuma página.
  const clientId = authorization.searchParams.get('client_id') ?? '';
  if (!/^\d{8,20}$/.test(clientId)) {
    throw new Error('O serviço de autorização da Meta está sem o ID do aplicativo ou com ele inválido. Nenhuma página foi aberta. Avise o responsável pelo XFLUX.');
  }

  onAuthorizationUrl?.(authorization.toString());
  onStatus?.('Abrindo o login oficial da Meta...');
  try {
    await openUrl(authorization.toString());
    onStatus?.('Aguardando você concluir a autorização no navegador...');
  } catch {
    onStatus?.('Não foi possível abrir o navegador automaticamente. Use "Copiar link de autorização" e cole no navegador que você usa. Aguardando...');
  }

  // A resposta OAuth fica disponível por até dez minutos e só pode ser retirada uma vez.
  let failures = 0;
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
    await wait(POLL_INTERVAL_MS, signal);
    let result: OAuthResult;
    try {
      result = await jsonRequest<OAuthResult>('/oauth/meta/result', { method: 'GET' }, session, signal);
      failures = 0;
    } catch (error) {
      if (error instanceof MetaCancelled) throw error;
      // Erros definitivos encerram; falhas de rede passageiras permitem novas consultas.
      if (error instanceof MetaHttpError && (error.status === 401 || error.status === 410 || error.status === 503)) throw error;
      failures += 1;
      if (failures >= MAX_CONSECUTIVE_FAILURES) throw error;
      continue;
    }
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
