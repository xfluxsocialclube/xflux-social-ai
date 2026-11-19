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

async function decryptToken(value: string, env: Env) {
  const [ivPart, cipherPart] = value.split(".");
  if (!ivPart || !cipherPart) throw new Error("Encrypted token format is invalid");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(ivPart) },
    await encryptionKey(env),
    fromB64(cipherPart),
  );
  return new TextDecoder().decode(plain);
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

const callbackPage = (heading: string, message: string, status = 200) =>
  new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>XFLUX Social AI</title><body style="font:16px system-ui;max-width:560px;margin:12vh auto;padding:24px;color:#172033"><h2>${heading}</h2><p>${message}</p></body></html>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });

async function saveOAuthError(deviceId: string, code: string, now: number, env: Env) {
  await env.DB.prepare("INSERT OR REPLACE INTO oauth_results (device_id, encrypted_token, token_type, token_expires_at, delivery_expires_at) VALUES (?, '', ?, NULL, ?)")
    .bind(deviceId, `error:${code}`, now + 600).run();
}

export default {
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS oauth_results (
      device_id TEXT PRIMARY KEY,
      encrypted_token TEXT NOT NULL,
      token_type TEXT,
      token_expires_at INTEGER,
      delivery_expires_at INTEGER NOT NULL
    )`).run();
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("DELETE FROM oauth_results WHERE delivery_expires_at < ?").bind(now).run();
    await env.DB.prepare("DELETE FROM oauth_states WHERE expires_at < ?").bind(now).run();
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    const url = new URL(request.url);
    try {
      if (url.pathname === "/" && request.method === "GET") {
        return cors(json({
          ok: true,
          service: "xflux-meta-auth",
          message: "XFLUX Social AI - serviço de autorização Meta ativo",
          health: "/health",
          endpoints: ["/health", "/device/register", "/oauth/meta/start", "/oauth/meta/callback", "/oauth/meta/result", "/oauth/meta/status"],
        }));
      }

      if (url.pathname === "/health" && request.method === "GET") {
        return cors(json({ ok: true, service: "xflux-meta-auth", version: 2 }));
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
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS oauth_results (
          device_id TEXT PRIMARY KEY,
          encrypted_token TEXT NOT NULL,
          token_type TEXT,
          token_expires_at INTEGER,
          delivery_expires_at INTEGER NOT NULL
        )`).run();
        const state = b64(crypto.getRandomValues(new Uint8Array(32)));
        const now = Math.floor(Date.now() / 1000);
        await env.DB.prepare("INSERT INTO oauth_states (state, device_id, expires_at) VALUES (?, ?, ?)")
          .bind(state, deviceId, now + 600).run();
        const appId = (env.META_APP_ID || "").trim();
        const configId = (env.META_CONFIG_ID || "").trim();
        const redirectUri = (env.META_REDIRECT_URI || "").trim();
        if (!/^\d{8,20}$/.test(appId) || !/^\d+$/.test(configId) || !redirectUri.startsWith("https://")) {
          return cors(json({ error: "meta_not_configured" }, 503));
        }
        const auth = new URL(`https://www.facebook.com/${env.META_GRAPH_VERSION || "v27.0"}/dialog/oauth`);
        auth.searchParams.set("client_id", appId);
        auth.searchParams.set("config_id", configId);
        auth.searchParams.set("redirect_uri", redirectUri);
        auth.searchParams.set("response_type", "code");
        auth.searchParams.set("state", state);
        return cors(json({ authorizationUrl: auth.toString() }));
      }

      if (url.pathname === "/oauth/meta/callback" && request.method === "GET") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");
        if (!state) return callbackPage("Resposta incompleta", "Não recebemos o identificador desta solicitação. Volte ao XFLUX e tente novamente.", 400);
        const now = Math.floor(Date.now() / 1000);
        const saved = await env.DB.prepare("SELECT device_id, expires_at FROM oauth_states WHERE state = ?")
          .bind(state).first<{device_id:string;expires_at:number}>();
        await env.DB.prepare("DELETE FROM oauth_states WHERE state = ?").bind(state).run();
        if (!saved || saved.expires_at < now) return callbackPage("Solicitação expirada", "Volte ao XFLUX e inicie a conexão novamente.", 400);
        if (providerError) {
          await saveOAuthError(saved.device_id, "authorization_cancelled", now, env);
          return callbackPage("Autorização não concluída", "A Meta recusou ou cancelou a autorização. Volte ao XFLUX para tentar novamente.", 400);
        }
        if (!code) {
          await saveOAuthError(saved.device_id, "incomplete_response", now, env);
          return callbackPage("Resposta incompleta", "Não recebemos o código de autorização da Meta. Volte ao XFLUX e tente novamente.", 400);
        }

        const tokenUrl = new URL(`https://graph.facebook.com/${env.META_GRAPH_VERSION || "v27.0"}/oauth/access_token`);
        tokenUrl.searchParams.set("client_id", (env.META_APP_ID || "").trim());
        tokenUrl.searchParams.set("client_secret", (env.META_APP_SECRET || "").trim());
        tokenUrl.searchParams.set("redirect_uri", (env.META_REDIRECT_URI || "").trim());
        tokenUrl.searchParams.set("code", code);
        const tokenResponse = await fetch(tokenUrl.toString(), { method: "GET" });
        const tokenData = await tokenResponse.json() as {access_token?:string;token_type?:string;expires_in?:number;error?:{message?:string}};
        if (!tokenResponse.ok || !tokenData.access_token) {
          await saveOAuthError(saved.device_id, "token_exchange_failed", now, env);
          return callbackPage("A Meta não confirmou a autorização", "Volte ao XFLUX e tente novamente. Nenhuma conta foi marcada como conectada.", 502);
        }

        // O token fica somente em uma caixa de entrega criptografada e temporária.
        // O aplicativo o retira uma única vez e o salva no cofre seguro do Windows.
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS oauth_results (
          device_id TEXT PRIMARY KEY,
          encrypted_token TEXT NOT NULL,
          token_type TEXT,
          token_expires_at INTEGER,
          delivery_expires_at INTEGER NOT NULL
        )`).run();
        const encrypted = await encryptToken(tokenData.access_token, env);
        await env.DB.prepare("INSERT OR REPLACE INTO oauth_results (device_id, encrypted_token, token_type, token_expires_at, delivery_expires_at) VALUES (?, ?, ?, ?, ?)")
          .bind(saved.device_id, encrypted, tokenData.token_type || "bearer",
            tokenData.expires_in ? now + tokenData.expires_in : null, now + 600).run();
        return callbackPage("Autorização concluída", "Volte ao XFLUX. O aplicativo está finalizando a conexão e guardará a credencial no cofre seguro deste computador.");
      }

      if (url.pathname === "/oauth/meta/result" && request.method === "GET") {
        const deviceId = await authenticate(request, env);
        if (!deviceId) return cors(json({ error: "unauthorized" }, 401));
        const row = await env.DB.prepare("SELECT encrypted_token, token_type, token_expires_at, delivery_expires_at FROM oauth_results WHERE device_id = ?")
          .bind(deviceId).first<{encrypted_token:string;token_type:string|null;token_expires_at:number|null;delivery_expires_at:number}>();
        if (!row) return cors(json({ pending: true }));
        // A exclusão condicional faz a entrega ser consumida uma única vez, inclusive com duas janelas abertas.
        const consumed = await env.DB.prepare("DELETE FROM oauth_results WHERE device_id = ? AND encrypted_token = ?")
          .bind(deviceId, row.encrypted_token).run();
        if (consumed.meta.changes !== 1) return cors(json({ pending: true }));
        const now = Math.floor(Date.now() / 1000);
        if (row.delivery_expires_at < now) return cors(json({ pending: false, error: "delivery_expired" }, 410));
        if (row.token_type?.startsWith("error:")) return cors(json({ pending: false, error: row.token_type.slice(6) }));
        const accessToken = await decryptToken(row.encrypted_token, env);
        return cors(json({ pending: false, accessToken, tokenType: row.token_type || "bearer", expiresAt: row.token_expires_at }));
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
