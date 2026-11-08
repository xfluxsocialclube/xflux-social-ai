"""Base inicial do servidor XFLUX. OAuth/publicação permanecem desativados até integração real."""
from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

from app.auth import authenticated_subject
from app.oauth_state import ensure_oauth_state_table

NETWORKS = ("instagram", "facebook", "tiktok", "shopee", "pinterest", "youtube")
DB_PATH = Path(os.getenv("XFLUX_DATABASE_PATH", "./data/xflux.sqlite3"))
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
        "id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, network TEXT NOT NULL, "
        "display_name TEXT NOT NULL, state TEXT NOT NULL, "
        "scopes_json TEXT NOT NULL DEFAULT '[]', connected_at TEXT NOT NULL, "
        "expires_at TEXT, last_checked_at TEXT NOT NULL)"
    )
    # Migração compatível: registros antigos ficam sem proprietário e não são
    # expostos a nenhum usuário autenticado.
    columns = {row["name"] for row in db.execute("PRAGMA table_info(accounts)")}
    if "owner_id" not in columns:
        db.execute("ALTER TABLE accounts ADD COLUMN owner_id TEXT NOT NULL DEFAULT ''")
    db.execute(
        "CREATE INDEX IF NOT EXISTS idx_accounts_owner_connected "
        "ON accounts(owner_id, connected_at DESC)"
    )
    ensure_oauth_state_table(db)
    db.commit()
    return db


def require_session(authorization: str | None = Header(default=None)) -> str:
    if ENVIRONMENT == "production" and not production_origins_are_safe():
        raise HTTPException(
            status_code=503,
            detail="Secure production origin configuration is required",
        )
    return authenticated_subject(authorization)


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


@app.get("/v1/accounts")
def accounts(owner_id: str = Depends(require_session)) -> dict[str, list[Any]]:
    with connect_db() as db:
        rows = db.execute(
            "SELECT id, network, display_name, state, scopes_json, connected_at, "
            "expires_at, last_checked_at FROM accounts WHERE owner_id = ? "
            "ORDER BY connected_at DESC", (owner_id,)
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
)
def disconnect_account(account_id: str, owner_id: str = Depends(require_session)) -> Response:
    with connect_db() as db:
        db.execute("DELETE FROM accounts WHERE id = ? AND owner_id = ?", (account_id, owner_id))
    return Response(status_code=204)


@app.post("/v1/oauth/{network}/start", dependencies=[Depends(require_session)])
def start_oauth(network: str) -> None:
    if network not in NETWORKS:
        raise HTTPException(status_code=404, detail="Unknown network")
    raise HTTPException(
        status_code=503, detail=f"OAuth for {network} is not configured"
    )
