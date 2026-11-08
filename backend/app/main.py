"""Backend XFLUX: contas e OAuth real da Meta (Facebook Login for Business)."""
from __future__ import annotations

import html
import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware

from app.auth import authenticated_subject
from app.oauth_state import (
    consume_oauth_state_for_callback,
    ensure_oauth_state_table,
    issue_oauth_state,
)
from app.token_vault import encrypt_token

NETWORKS = ("instagram", "facebook", "tiktok", "shopee", "pinterest", "youtube")
META_NETWORKS = ("instagram", "facebook")
DB_PATH = Path(os.getenv("XFLUX_DATABASE_PATH", "./data/xflux.sqlite3"))
ENVIRONMENT = os.getenv("XFLUX_ENV", "development").lower()
app = FastAPI(title="XFLUX Backend", version="1.1.0")
origins = [
    value.strip()
    for value in os.getenv("XFLUX_ALLOWED_ORIGINS", "http://localhost:1420,tauri://localhost").split(",")
    if value.strip()
]
app.add_middleware(
    CORSMiddleware, allow_origins=origins, allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


def production_origins_are_safe() -> bool:
    configured = os.getenv("XFLUX_ALLOWED_ORIGINS", "").strip()
    if not configured:
        return False
    allowed = [value.strip() for value in configured.split(",") if value.strip()]
    if not allowed or "*" in allowed:
        return False
    for origin in allowed:
        parsed = urlsplit(origin)
        safe_https = parsed.scheme == "https" and bool(parsed.netloc) and not parsed.username and not parsed.password and not parsed.path and not parsed.query and not parsed.fragment
        if not (safe_https or origin == "tauri://localhost"):
            return False
    return True


def connect_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute(
        "CREATE TABLE IF NOT EXISTS accounts ("
        "id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, network TEXT NOT NULL, "
        "display_name TEXT NOT NULL, state TEXT NOT NULL, "
        "scopes_json TEXT NOT NULL DEFAULT '[]', connected_at TEXT NOT NULL, "
        "expires_at TEXT, last_checked_at TEXT NOT NULL)"
    )
    columns = {row["name"] for row in db.execute("PRAGMA table_info(accounts)")}
    if "owner_id" not in columns:
        db.execute("ALTER TABLE accounts ADD COLUMN owner_id TEXT NOT NULL DEFAULT ''")
    if "encrypted_token" not in columns:
        db.execute("ALTER TABLE accounts ADD COLUMN encrypted_token TEXT NOT NULL DEFAULT ''")
    if "provider_account_id" not in columns:
        db.execute("ALTER TABLE accounts ADD COLUMN provider_account_id TEXT NOT NULL DEFAULT ''")
    db.execute("CREATE INDEX IF NOT EXISTS idx_accounts_owner_connected ON accounts(owner_id, connected_at DESC)")
    ensure_oauth_state_table(db)
    db.commit()
    return db


def require_session(authorization: str | None = Header(default=None)) -> str:
    if ENVIRONMENT == "production" and not production_origins_are_safe():
        raise HTTPException(status_code=503, detail="Secure production origin configuration is required")
    return authenticated_subject(authorization)


def _meta_config() -> tuple[str, str, str, str]:
    app_id = os.getenv("META_APP_ID", "").strip()
    app_secret = os.getenv("META_APP_SECRET", "").strip()
    redirect_uri = os.getenv("META_OAUTH_REDIRECT_URI", "").strip()
    version = os.getenv("META_GRAPH_VERSION", "v25.0").strip()
    if not app_id or not app_secret or not redirect_uri or not os.getenv("XFLUX_TOKEN_ENCRYPTION_KEY", "").strip():
        raise HTTPException(status_code=503, detail="Meta OAuth credentials, callback URL and token encryption key must be configured")
    parsed = urlsplit(redirect_uri)
    if parsed.scheme != "https" and not (ENVIRONMENT != "production" and parsed.hostname in ("localhost", "127.0.0.1")):
        raise HTTPException(status_code=503, detail="Meta OAuth callback must use HTTPS")
    if not version.startswith("v") or not version[1:].replace(".", "").isdigit():
        raise HTTPException(status_code=503, detail="Invalid Meta Graph API version")
    return app_id, app_secret, redirect_uri, version


def _meta_json(url: str, *, form: dict[str, str] | None = None) -> dict[str, Any]:
    data = urlencode(form).encode("utf-8") if form is not None else None
    request = Request(url, data=data, headers={"Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"} if data else {"Accept": "application/json"})
    try:
        with urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=502, detail="Meta could not complete the authorization request") from None
    if not isinstance(payload, dict) or payload.get("error"):
        raise HTTPException(status_code=502, detail="Meta rejected the authorization request")
    return payload


@app.get("/v1/health")
def health() -> dict[str, Any]:
    identity_ready = bool(os.getenv("XFLUX_JWT_ISSUER", "").strip() and os.getenv("XFLUX_JWT_AUDIENCE", "").strip())
    if ENVIRONMENT == "production":
        identity_ready = identity_ready and urlsplit(os.getenv("XFLUX_JWKS_URL", "").strip()).scheme == "https"
    else:
        identity_ready = identity_ready and len(os.getenv("XFLUX_JWT_SECRET", "")) >= 32
    meta_ready = identity_ready and all(os.getenv(key, "").strip() for key in ("META_APP_ID", "META_APP_SECRET", "META_OAUTH_REDIRECT_URI", "XFLUX_TOKEN_ENCRYPTION_KEY"))
    return {
        "service": "xflux-backend", "apiVersion": "1",
        "capabilities": ["accounts", "oauth"] if meta_ready else ["accounts"],
        "providers": [
            {"network": network, "oauth": meta_ready if network in META_NETWORKS else False, "publishing": False}
            for network in NETWORKS
        ],
    }


@app.get("/v1/accounts")
def accounts(owner_id: str = Depends(require_session)) -> dict[str, list[Any]]:
    with connect_db() as db:
        rows = db.execute(
            "SELECT id, network, display_name, state, scopes_json, connected_at, expires_at, last_checked_at "
            "FROM accounts WHERE owner_id = ? ORDER BY connected_at DESC", (owner_id,),
        ).fetchall()
    return {"accounts": [{
        "id": row["id"], "network": row["network"], "displayName": row["display_name"],
        "state": row["state"], "scopes": json.loads(row["scopes_json"]),
        "connectedAt": row["connected_at"], "expiresAt": row["expires_at"],
        "lastCheckedAt": row["last_checked_at"],
    } for row in rows]}


@app.delete("/v1/accounts/{account_id}", status_code=204)
def disconnect_account(account_id: str, owner_id: str = Depends(require_session)) -> Response:
    with connect_db() as db:
        db.execute("DELETE FROM accounts WHERE id = ? AND owner_id = ?", (account_id, owner_id))
    return Response(status_code=204)


@app.post("/v1/oauth/{network}/start")
def start_oauth(network: str, owner_id: str = Depends(require_session)) -> dict[str, Any]:
    if network not in NETWORKS:
        raise HTTPException(status_code=404, detail="Unknown network")
    if network not in META_NETWORKS:
        raise HTTPException(status_code=503, detail=f"OAuth for {network} is not configured")
    app_id, _, redirect_uri, version = _meta_config()
    scopes = [
        "pages_show_list", "pages_read_engagement", "pages_manage_posts",
        "publish_video", "instagram_basic", "instagram_content_publish",
    ]
    with connect_db() as db:
        state = issue_oauth_state(db, network=network, session_subject=owner_id)
        db.commit()
    params = {
        "client_id": app_id, "redirect_uri": redirect_uri, "response_type": "code",
        "state": state, "scope": ",".join(scopes), "auth_type": "rerequest",
    }
    return {"authorizationUrl": f"https://www.facebook.com/{version}/dialog/oauth?{urlencode(params)}", "expiresInSeconds": 600}


@app.get("/v1/oauth/meta/callback")
def meta_oauth_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
) -> Response:
    if error or not code or not state:
        return Response("<h2>XFLUX: autorização cancelada ou inválida.</h2>", media_type="text/html", status_code=400)
    try:
        app_id, app_secret, redirect_uri, version = _meta_config()
        with connect_db() as db:
            # A rede e o usuário são recuperados do state de uso único, nunca do navegador.
            # A rede faz parte do state armazenado e é validada antes de recuperar o proprietário.
            owner_id = consume_oauth_state_for_callback(db, state=state, network="instagram")
            network = "instagram"
            if owner_id is None:
                owner_id = consume_oauth_state_for_callback(db, state=state, network="facebook")
                network = "facebook"
            if owner_id is None:
                raise HTTPException(status_code=400, detail="OAuth state is invalid or expired")
            db.commit()

        short_token = _meta_json(
            f"https://graph.facebook.com/{version}/oauth/access_token?{urlencode({'client_id': app_id, 'client_secret': app_secret, 'redirect_uri': redirect_uri, 'code': code})}"
        )
        user_token = str(short_token.get("access_token", ""))
        if not user_token:
            raise HTTPException(status_code=502, detail="Meta did not return an access token")
        long_token = _meta_json(
            f"https://graph.facebook.com/{version}/oauth/access_token?{urlencode({'grant_type': 'fb_exchange_token', 'client_id': app_id, 'client_secret': app_secret, 'fb_exchange_token': user_token})}"
        )
        access_token = str(long_token.get("access_token", ""))
        if not access_token:
            raise HTTPException(status_code=502, detail="Meta did not return a long-lived token")
        page_data = _meta_json(
            f"https://graph.facebook.com/{version}/me/accounts?{urlencode({'fields': 'id,name,access_token,tasks,instagram_business_account', 'access_token': access_token})}"
        )
        pages = page_data.get("data", [])
        if not isinstance(pages, list):
            raise HTTPException(status_code=502, detail="Meta returned an invalid pages response")
        saved = 0
        scopes = ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "publish_video", "instagram_basic", "instagram_content_publish"]
        now = datetime.now(timezone.utc).isoformat()
        expires = datetime.fromtimestamp(datetime.now(timezone.utc).timestamp() + int(long_token.get("expires_in", 0)), timezone.utc).isoformat() if long_token.get("expires_in") else None
        with connect_db() as db:
            for page in pages:
                if not isinstance(page, dict) or not page.get("id") or not page.get("access_token"):
                    continue
                page_id = str(page["id"])
                page_name = str(page.get("name") or "Facebook Page")
                page_token = str(page["access_token"])
                targets = []
                if network == "facebook":
                    targets.append(("facebook", page_id, page_name, page_token))
                ig = page.get("instagram_business_account")
                if network == "instagram" and isinstance(ig, dict) and ig.get("id"):
                    targets.append(("instagram", str(ig["id"]), f"Instagram · {page_name}", page_token))
                for target_network, provider_id, display_name, token_value in targets:
                    db.execute("DELETE FROM accounts WHERE owner_id = ? AND network = ? AND provider_account_id = ?", (owner_id, target_network, provider_id))
                    account_id = str(uuid.uuid4())
                    db.execute(
                        """INSERT INTO accounts
                           (id, owner_id, network, display_name, state, scopes_json, connected_at,
                            expires_at, last_checked_at, encrypted_token, provider_account_id)
                           VALUES (?, ?, ?, ?, 'connected', ?, ?, ?, ?, ?, ?)
                           ON CONFLICT(id) DO NOTHING""",
                        (account_id, owner_id, target_network, display_name, json.dumps(scopes), now,
                         expires, now, encrypt_token(token_value), provider_id),
                    )
                    saved += 1
            db.commit()
        if saved == 0:
            detail = "Nenhuma Página do Facebook foi encontrada." if network == "facebook" else "Nenhuma conta profissional do Instagram vinculada a uma Página foi encontrada."
            return Response(f"<h2>XFLUX</h2><p>{html.escape(detail)} Verifique as permissões e a vinculação no Meta Business.</p>", media_type="text/html", status_code=200)
        return Response("<h2>XFLUX: conta conectada com sucesso.</h2><p>Volte ao aplicativo e atualize a central de integrações.</p>", media_type="text/html")
    except HTTPException as exc:
        return Response(f"<h2>XFLUX</h2><p>{html.escape(str(exc.detail))}</p>", media_type="text/html", status_code=exc.status_code)
    except Exception:
        return Response("<h2>XFLUX</h2><p>Não foi possível concluir a conexão. Tente novamente.</p>", media_type="text/html", status_code=500)
