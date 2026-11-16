interface Env {
  DB: D1Database;
  META_APP_ID: string;
  META_APP_SECRET: string;
  META_CONFIG_ID: string;
  META_REDIRECT_URI: string;
  TOKEN_ENCRYPTION_KEY: string;
  META_GRAPH_VERSION?: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "cache-control": "no-store" },
  });

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");

async function sha256(value: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function encryptionKey(env: Env) {
  const raw = fromB64(env.TOKEN_ENCRYPTION_KEY);
  if (raw.byteLength !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptToken(token: string, env: Env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(env), new TextEncoder().encode(token));
  return `${b64(iv)}.${b64(new Uint8Array(cipher))}`;
}

async function authenticate(request: Request, env: Env) {
  const deviceId = request.headers.get("x-xflux-device");
  const secret = request.headers.get("x-xflux-device-secret");
  if (!deviceId || !secret) return null;
  const row = await env.DB.prepare("SELECT secret_hash FROM devices WHERE device_id = ?").bind(deviceId).first<{secret_hash:string}>();
  if (!row) return null;
  return (await sha256(secret)) === row.secret_hash ? deviceId : null;
}

function cors(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-allow-headers", "content-type,x-xflux-device,x-xflux-device-secret");
  headers.set("cache-control", "no-store");
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    const url = new URL(request.url);
    try {
      if (url.pathname === "/health" && request.method === "GET") {
        return cors(json({ ok: true, service: "xflux-meta-auth", version: 1 }));
      }

      if (url.pathname === "/device/register" && request.method === "POST") {
        const deviceId = crypto.randomUUID();
        const deviceSecret = b64(crypto.getRandomValues(new Uint8Array(32)));
        await env.DB.prepare("INSERT INTO devices (device_id, secret_hash, created_at) VALUES (?, ?, ?)")
          .bind(deviceId, await sha256(deviceSecret), Math.floor(Date.now() / 1000)).run();
        return cors(json({ deviceId, deviceSecret }));
      }

      if (url.pathname === "/oauth/meta/start" && request.method === "POST") {
        const deviceId = await authenticate(request, env);
        if (!deviceId) return cors(json({ error: "unauthorized" }, 401));
        const state = b64(crypto.getRandomValues(new Uint8Array(32)));
        const now = Math.floor(Date.now() / 1000);
        await env.DB.prepare("INSERT INTO oauth_states (state, device_id, expires_at) VALUES (?, ?, ?)")
          .bind(state, deviceId, now + 600).run();
        const auth = new URL(`https://www.facebook.com/${env.META_GRAPH_VERSION || "v27.0"}/dialog/oauth`);
        auth.searchParams.set("client_id", env.META_APP_ID);
        auth.searchParams.set("config_id", env.META_CONFIG_ID);
        auth.searchParams.set("redirect_uri", env.META_REDIRECT_URI);
        auth.searchParams.set("response_type", "code");
        auth.searchParams.set("state", state);
        return cors(json({ authorizationUrl: auth.toString() }));
      }

      if (url.pathname === "/oauth/meta/callback" && request.method === "GET") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");
        if (providerError) return new Response("A autorização foi cancelada ou recusada. Volte ao XFLUX.", { status: 400 });
        if (!code || !state) return new Response("Resposta OAuth incompleta.", { status: 400 });
        const now = Math.floor(Date.now() / 1000);
        const saved = await env.DB.prepare("SELECT device_id, expires_at FROM oauth_states WHERE state = ?")
          .bind(state).first<{device_id:string;expires_at:number}>();
        await env.DB.prepare("DELETE FROM oauth_states WHERE state = ?").bind(state).run();
        if (!saved || saved.expires_at < now) return new Response("Solicitação de login expirada. Volte ao XFLUX e tente novamente.", { status: 400 });

        const tokenUrl = new URL(`https://graph.facebook.com/${env.META_GRAPH_VERSION || "v27.0"}/oauth/access_token`);
        tokenUrl.searchParams.set("client_id", env.META_APP_ID);
        tokenUrl.searchParams.set("client_secret", env.META_APP_SECRET);
        tokenUrl.searchParams.set("redirect_uri", env.META_REDIRECT_URI);
        tokenUrl.searchParams.set("code", code);
        const tokenResponse = await fetch(tokenUrl.toString(), { method: "GET" });
        const tokenData = await tokenResponse.json() as {access_token?:string;token_type?:string;expires_in?:number;error?:{message?:string}};
        if (!tokenResponse.ok || !tokenData.access_token) {
          return new Response("A Meta não confirmou a autorização. Volte ao XFLUX e tente novamente.", { status: 502 });
        }
        const encrypted = await encryptToken(tokenData.access_token, env);
        await env.DB.prepare(`INSERT INTO social_tokens (device_id, platform, encrypted_token, token_type, expires_at, updated_at)
          VALUES (?, 'meta', ?, ?, ?, ?)
          ON CONFLICT(device_id, platform) DO UPDATE SET encrypted_token=excluded.encrypted_token,
          token_type=excluded.token_type, expires_at=excluded.expires_at, updated_at=excluded.updated_at`)
          .bind(saved.device_id, encrypted, tokenData.token_type || "bearer",
            tokenData.expires_in ? now + tokenData.expires_in : null, now).run();
        return new Response("<!doctype html><html lang='pt-BR'><meta charset='utf-8'><title>XFLUX conectado</title><body style='font:16px system-ui;max-width:560px;margin:12vh auto;padding:24px;color:#172033'><h2>Autorização concluída</h2><p>O acesso foi protegido e registrado. Você já pode fechar esta janela e voltar ao XFLUX.</p></body></html>", {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
      }

      if (url.pathname === "/oauth/meta/status" && request.method === "GET") {
        const deviceId = await authenticate(request, env);
        if (!deviceId) return cors(json({ error: "unauthorized" }, 401));
        const row = await env.DB.prepare("SELECT expires_at, updated_at FROM social_tokens WHERE device_id = ? AND platform = 'meta'")
          .bind(deviceId).first<{expires_at:number|null;updated_at:number}>();
        return cors(json({ connected: !!row, expiresAt: row?.expires_at ?? null, updatedAt: row?.updated_at ?? null }));
      }

      return cors(json({ error: "not_found" }, 404));
    } catch {
      return cors(json({ error: "internal_error" }, 500));
    }
  },
};
