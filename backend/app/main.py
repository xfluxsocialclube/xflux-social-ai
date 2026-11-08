"""Base inicial do servidor XFLUX. OAuth/publicação permanecem desativados até integração real."""
from __future__ import annotations

import hmac
import json
import os
import sqlite3
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

from app.oauth_state import ensure_oauth_state_table

NETWORKS = ("instagram", "facebook", "tiktok", "shopee", "pinterest", "youtube")
DB_PATH = Path(os.getenv("XFLUX_DATABASE_PATH", "./data/xflux.sqlite3"))
SESSION_TOKEN = os.getenv("XFLUX_SESSION_TOKEN", "")
ENVIRONMENT = os.getenv("XFLUX_ENV", "development").lower()
app = FastAPI(title="XFLUX Backend", version="1.0.0")
origins = [
    value.strip()
    for value in os.getenv(
        "XFLUX_ALLOWED_ORIGINS", "http://localhost:1420,tauri://localhost"
    ).split(",")
    if value.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


def production_origins_are_safe() -> bool:
    """Require an explicit, non-wildcard production origin allowlist."""
    configured = os.getenv("XFLUX_ALLOWED_ORIGINS", "").strip()
    if not configured:
        return False

    allowed = [value.strip() for value in configured.split(",") if value.strip()]
    if not allowed or "*" in allowed:
        return False

    for origin in allowed:
        parsed = urlsplit(origin)
        is_https_web_origin = (
            parsed.scheme == "https"
            and bool(parsed.netloc)
            and not parsed.username
            and not parsed.password
            and not parsed.path
            and not parsed.query
            and not parsed.fragment
        )
        is_tauri_local_origin = origin == "tauri://localhost"
        if not (is_https_web_origin or is_tauri_local_origin):
            return False
    return True


def connect_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute(
        "CREATE TABLE IF NOT EXISTS accounts ("
        "id TEXT PRIMARY KEY, network TEXT NOT NULL, display_name TEXT NOT NULL, "
        "state TEXT NOT NULL, scopes_json TEXT NOT NULL DEFAULT '[]', "
        "connected_at TEXT NOT NULL, expires_at TEXT, last_checked_at TEXT NOT NULL)"
    )
    ensure_oauth_state_table(db)
    db.commit()
    return db


def require_session(authorization: str | None = Header(default=None)) -> None:
    # A chave compartilhada é apenas uma barreira temporária para ambiente privado.
    # Não representa autenticação multiusuário e não deve ser usada como login público.
    if not SESSION_TOKEN or (
        ENVIRONMENT == "production"
        and (
            len(SESSION_TOKEN) < 32
            or not production_origins_are_safe()
        )
    ):
        raise HTTPException(
            status_code=503,
            detail="Secure XFLUX session and production origin configuration are required",
        )
    if authorization is None or not hmac.compare_digest(
        authorization, f"Bearer {SESSION_TOKEN}"
    ):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/v1/health")
def health() -> dict[str, Any]:
    return {
        "service": "xflux-backend",
        "apiVersion": "1",
        "capabilities": ["accounts"],
        "providers": [
            {"network": network, "oauth": False, "publishing": False}
            for network in NETWORKS
        ],
    }


@app.get("/v1/accounts", dependencies=[Depends(require_session)])
def accounts() -> dict[str, list[Any]]:
    with connect_db() as db:
        rows = db.execute(
            "SELECT id, network, display_name, state, scopes_json, connected_at, "
            "expires_at, last_checked_at FROM accounts ORDER BY connected_at DESC"
        ).fetchall()
    return {
        "accounts": [
            {
                "id": row["id"],
                "network": row["network"],
                "displayName": row["display_name"],
                "state": row["state"],
                "scopes": json.loads(row["scopes_json"]),
                "connectedAt": row["connected_at"],
                "expiresAt": row["expires_at"],
                "lastCheckedAt": row["last_checked_at"],
            }
            for row in rows
        ]
    }


@app.delete(
    "/v1/accounts/{account_id}",
    status_code=204,
    dependencies=[Depends(require_session)],
)
def disconnect_account(account_id: str) -> Response:
    with connect_db() as db:
        db.execute("DELETE FROM accounts WHERE id = ?", (account_id,))
    return Response(status_code=204)


@app.post("/v1/oauth/{network}/start", dependencies=[Depends(require_session)])
def start_oauth(network: str) -> None:
    if network not in NETWORKS:
        raise HTTPException(status_code=404, detail="Unknown network")
    raise HTTPException(
        status_code=503, detail=f"OAuth for {network} is not configured"
    )
