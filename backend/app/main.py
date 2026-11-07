"""Base inicial do servidor XFLUX. OAuth/publicação permanecem desativados até integração real."""
from __future__ import annotations
import os
import sqlite3
import hmac
import json
from pathlib import Path
from typing import Any
from fastapi import Depends, FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

NETWORKS = ("instagram", "facebook", "tiktok", "shopee", "pinterest", "youtube")
DB_PATH = Path(os.getenv("XFLUX_DATABASE_PATH", "./data/xflux.sqlite3"))
SESSION_TOKEN = os.getenv("XFLUX_SESSION_TOKEN", "")
app = FastAPI(title="XFLUX Backend", version="1.0.0")
origins = [x.strip() for x in os.getenv("XFLUX_ALLOWED_ORIGINS", "http://localhost:1420,tauri://localhost").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=["GET", "POST", "DELETE", "OPTIONS"], allow_headers=["Authorization", "Content-Type"])

def connect_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, network TEXT NOT NULL, display_name TEXT NOT NULL, state TEXT NOT NULL, scopes_json TEXT NOT NULL DEFAULT '[]', connected_at TEXT NOT NULL, expires_at TEXT, last_checked_at TEXT NOT NULL)")
    db.commit()
    return db

def require_session(authorization: str | None = Header(default=None)) -> None:
    if not SESSION_TOKEN:
        raise HTTPException(status_code=503, detail="XFLUX_SESSION_TOKEN is not configured")
    if authorization is None or not hmac.compare_digest(authorization, f"Bearer {SESSION_TOKEN}"):
        raise HTTPException(status_code=401, detail="Unauthorized")

@app.get("/v1/health")
def health() -> dict[str, Any]:
    return {"service": "xflux-backend", "apiVersion": "1", "capabilities": ["accounts"], "providers": [{"network": n, "oauth": False, "publishing": False} for n in NETWORKS]}

@app.get("/v1/accounts", dependencies=[Depends(require_session)])
def accounts() -> dict[str, list[Any]]:
    with connect_db() as db:
        rows = db.execute("SELECT id, network, display_name, state, scopes_json, connected_at, expires_at, last_checked_at FROM accounts ORDER BY connected_at DESC").fetchall()
    return {"accounts": [{"id": r["id"], "network": r["network"], "displayName": r["display_name"], "state": r["state"], "scopes": json.loads(r["scopes_json"]), "connectedAt": r["connected_at"], "expiresAt": r["expires_at"], "lastCheckedAt": r["last_checked_at"]} for r in rows]}

@app.delete("/v1/accounts/{account_id}", status_code=204, dependencies=[Depends(require_session)])
def disconnect_account(account_id: str) -> Response:
    with connect_db() as db:
        db.execute("DELETE FROM accounts WHERE id = ?", (account_id,))
    return Response(status_code=204)

@app.post("/v1/oauth/{network}/start", dependencies=[Depends(require_session)])
def start_oauth(network: str) -> None:
    if network not in NETWORKS:
        raise HTTPException(status_code=404, detail="Unknown network")
    raise HTTPException(status_code=503, detail=f"OAuth for {network} is not configured")
