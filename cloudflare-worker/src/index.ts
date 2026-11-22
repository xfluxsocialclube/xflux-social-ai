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


function logOAuth(stage: string, details: Record<string, unknown> = {}) {
  // Structured logs contain only explicitly approved diagnostic fields.
  console.log(JSON.stringify({ component: "xflux_meta_oauth", stage, ...details }));
}

function safeMetaMessage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value
    .replace(/(access_token|client_secret|code|state)=([^&\\s]+)/gi, "$1=[REDACTED]")
    .replace(/[A-Za-z0-9_-]{80,}/g, "[REDACTED]")
    .slice(0, 300);
}

async function saveOAuthError(deviceId: string, code: string, now: number, env: Env) {
  await env.DB.prepare("INSERT OR REPLACE INTO oauth_results (device_id, encrypted_token, token_type, token_expires_at, delivery_expires_at) VALUES (?, '', ?, NULL, ?)")
    .bind(deviceId, `error:${code}`, now + 300).run();
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

        logOAuth("callback_received", {
          has_code: Boolean(code),
          has_provider_error: Boolean(providerError),
        });

        if (!state) {
          logOAuth("state_validation", { outcome: "absent" });
          logOAuth("callback_error_branch", { branch: "missing_state" });
          return callbackPage("Resposta incompleta", "Não recebemos o identificador desta solicitação. Volte ao XFLUX e tente novamente.", 400);
        }

        const now = Math.floor(Date.now() / 1000);
        let saved: { device_id: string; expires_at: number } | null;
        try {
          saved = await env.DB.prepare("SELECT device_id, expires_at FROM oauth_states WHERE state = ?")
            .bind(state).first<{ device_id: string; expires_at: number }>();
          await env.DB.prepare("DELETE FROM oauth_states WHERE state = ?").bind(state).run();
        } catch (error) {
          logOAuth("state_validation", {
            outcome: "d1_error",
            error_name: error instanceof Error ? error.name : "UnknownError",
          });
          throw error;
        }

        if (!saved) {
          logOAuth("state_validation", { outcome: "not_found" });
          logOAuth("callback_error_branch", { branch: "state_not_found" });
          return callbackPage("Solicitação expirada", "Volte ao XFLUX e inicie a conexão novamente.", 400);
        }
        if (saved.expires_at < now) {
          logOAuth("state_validation", { outcome: "expired" });
          logOAuth("callback_error_branch", { branch: "state_expired" });
          return callbackPage("Solicitação expirada", "Volte ao XFLUX e inicie a conexão novamente.", 400);
        }
        logOAuth("state_validation", { outcome: "ok" });

        if (providerError) {
          logOAuth("callback_error_branch", { branch: "provider_error" });
          await saveOAuthError(saved.device_id, "authorization_cancelled", now, env);
          return callbackPage("Autorização não concluída", "A Meta recusou ou cancelou a autorização. Volte ao XFLUX para tentar novamente.", 400);
        }
        if (!code) {
          logOAuth("callback_error_branch", { branch: "missing_code" });
          await saveOAuthError(saved.device_id, "incomplete_response", now, env);
          return callbackPage("Resposta incompleta", "Não recebemos o código de autorização da Meta. Volte ao XFLUX e tente novamente.", 400);
        }

        const graphVersion = env.META_GRAPH_VERSION || "v27.0";
        const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
        tokenUrl.searchParams.set("client_id", env.META_APP_ID);
        tokenUrl.searchParams.set("client_secret", env.META_APP_SECRET);
        tokenUrl.searchParams.set("redirect_uri", env.META_REDIRECT_URI);
        tokenUrl.searchParams.set("code", code);

        logOAuth("token_exchange_started", {
          graph_version: graphVersion,
          has_app_id: Boolean(env.META_APP_ID),
          has_app_secret: Boolean(env.META_APP_SECRET),
          has_redirect_uri: Boolean(env.META_REDIRECT_URI),
        });

        const tokenResponse = await fetch(tokenUrl.toString(), { method: "GET" });
        let tokenData: {
          access_token?: string;
          token_type?: string;
          expires_in?: number;
          error?: { type?: string; code?: number; error_subcode?: number; message?: string };
        };
        try {
          tokenData = await tokenResponse.json() as typeof tokenData;
        } catch {
          logOAuth("token_exchange_response", {
            outcome: "invalid_json",
            http_status: tokenResponse.status,
          });
          logOAuth("callback_error_branch", { branch: "token_exchange_invalid_json" });
          await saveOAuthError(saved.device_id, "token_exchange_failed", now, env);
          return callbackPage("A Meta não confirmou a autorização", "Volte ao XFLUX e tente novamente. Nenhuma conta foi marcada como conectada.", 502);
        }

        if (!tokenResponse.ok || !tokenData.access_token) {
          logOAuth("token_exchange_response", {
            outcome: "failed",
            http_status: tokenResponse.status,
            error_type: tokenData.error?.type,
            error_code: tokenData.error?.code,
            error_subcode: tokenData.error?.error_subcode,
            error_message: safeMetaMessage(tokenData.error?.message),
          });
          logOAuth("callback_error_branch", { branch: "token_exchange_failed" });
          await saveOAuthError(saved.device_id, "token_exchange_failed", now, env);
          return callbackPage("A Meta não confirmou a autorização", "Volte ao XFLUX e tente novamente. Nenhuma conta foi marcada como conectada.", 502);
        }

        logOAuth("token_exchange_response", {
          outcome: "success",
          http_status: tokenResponse.status,
          has_access_token: true,
        });

        // This Worker version only exchanges and hands off the token.
        // It does not enumerate Facebook Pages or Instagram accounts.
        logOAuth("assets_accounts_lookup", {
          outcome: "not_implemented_in_current_flow",
          pages_count: null,
          instagram_accounts_count: null,
        });

        try {
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
              tokenData.expires_in ? now + tokenData.expires_in : null, now + 300).run();
          logOAuth("d1_handoff_write", { outcome: "success" });
        } catch (error) {
          logOAuth("d1_handoff_write", {
            outcome: "failed",
            error_name: error instanceof Error ? error.name : "UnknownError",
          });
          throw error;
        }

        logOAuth("callback_completed", { outcome: "success" });
        return callbackPage("Autorização concluída", "Volte ao XFLUX. O aplicativo está finalizando a conexão e guardará a credencial no cofre seguro deste computador.");
      }

      if (url.pathname === "/oauth/meta/result" && request.method === "GET") {
        const deviceId = await authenticate(request, env);
        if (!deviceId) return cors(json({ error: "unauthorized" }, 401));
        const row = await env.DB.prepare("SELECT encrypted_token, token_type, token_expires_at, delivery_expires_at FROM oauth_results WHERE device_id = ?")
          .bind(deviceId).first<{encrypted_token:string;token_type:string|null;token_expires_at:number|null;delivery_expires_at:number}>();
        if (!row) {
          logOAuth("d1_handoff_read", { outcome: "pending" });
          return cors(json({ pending: true }));
        }
        // A exclusão condicional faz a entrega ser consumida uma única vez, inclusive com duas janelas abertas.
        const consumed = await env.DB.prepare("DELETE FROM oauth_results WHERE device_id = ? AND encrypted_token = ?")
          .bind(deviceId, row.encrypted_token).run();
        if (consumed.meta.changes !== 1) {
          logOAuth("d1_handoff_consume", { outcome: "not_consumed" });
          return cors(json({ pending: true }));
        }
        logOAuth("d1_handoff_consume", { outcome: "success" });
        const now = Math.floor(Date.now() / 1000);
        if (row.delivery_expires_at < now) {
          logOAuth("d1_handoff_read", { outcome: "expired" });
          return cors(json({ pending: false, error: "delivery_expired" }, 410));
        }
        if (row.token_type?.startsWith("error:")) {
          logOAuth("d1_handoff_read", { outcome: "stored_oauth_error", error_code: row.token_type.slice(6) });
          return cors(json({ pending: false, error: row.token_type.slice(6) }));
        }
        const accessToken = await decryptToken(row.encrypted_token, env);
        logOAuth("d1_handoff_read", { outcome: "success" });
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
