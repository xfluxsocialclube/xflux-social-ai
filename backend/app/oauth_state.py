"""Armazenamento e consumo seguro de state OAuth (base para provedores reais).

O state é aleatório, armazenado apenas como hash e consumido uma única vez.
A identidade informada aqui deve ser o identificador imutável da sessão XFLUX,
nunca um identificador vindo diretamente do navegador.
"""
from __future__ import annotations

import hashlib
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone


def _utc_iso(value: datetime) -> str:
    if value.tzinfo is None:
        raise ValueError("datetime precisa ter fuso horário")
    return value.astimezone(timezone.utc).isoformat()


def ensure_oauth_state_table(db: sqlite3.Connection) -> None:
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS oauth_states (
            state_hash TEXT PRIMARY KEY,
            network TEXT NOT NULL,
            session_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            consumed_at TEXT
        )
        """
    )


def issue_oauth_state(
    db: sqlite3.Connection,
    *,
    network: str,
    session_subject: str,
    now: datetime | None = None,
    ttl_seconds: int = 600,
) -> str:
    """Cria state de uso único vinculado à sessão autenticada."""
    if not network or not session_subject:
        raise ValueError("network e session_subject são obrigatórios")
    if ttl_seconds < 1 or ttl_seconds > 900:
        raise ValueError("ttl_seconds deve ficar entre 1 e 900")
    issued_at = now or datetime.now(timezone.utc)
    if issued_at.tzinfo is None:
        raise ValueError("now precisa ter fuso horário")
    state = secrets.token_urlsafe(32)
    state_hash = hashlib.sha256(state.encode("utf-8")).hexdigest()
    session_hash = hashlib.sha256(session_subject.encode("utf-8")).hexdigest()
    expires_at = issued_at + timedelta(seconds=ttl_seconds)
    ensure_oauth_state_table(db)
    db.execute(
        """INSERT INTO oauth_states
           (state_hash, network, session_hash, created_at, expires_at, consumed_at)
           VALUES (?, ?, ?, ?, ?, NULL)""",
        (state_hash, network, session_hash, _utc_iso(issued_at), _utc_iso(expires_at)),
    )
    return state


def consume_oauth_state(
    db: sqlite3.Connection,
    *,
    state: str,
    network: str,
    session_subject: str,
    now: datetime | None = None,
) -> bool:
    """Valida e consome state atomicamente; rejeita replay, expiração e troca de sessão."""
    if not state or not network or not session_subject:
        return False
    checked_at = now or datetime.now(timezone.utc)
    if checked_at.tzinfo is None:
        raise ValueError("now precisa ter fuso horário")
    state_hash = hashlib.sha256(state.encode("utf-8")).hexdigest()
    session_hash = hashlib.sha256(session_subject.encode("utf-8")).hexdigest()
    timestamp = _utc_iso(checked_at)

    # BEGIN IMMEDIATE serializa tentativas concorrentes de consumir o mesmo state.
    db.execute("BEGIN IMMEDIATE")
    try:
        row = db.execute(
            """SELECT network, session_hash, expires_at, consumed_at
               FROM oauth_states WHERE state_hash = ?""",
            (state_hash,),
        ).fetchone()
        if (
            row is None
            or row["network"] != network
            or row["session_hash"] != session_hash
            or row["consumed_at"] is not None
            or row["expires_at"] <= timestamp
        ):
            db.rollback()
            return False
        updated = db.execute(
            """UPDATE oauth_states SET consumed_at = ?
               WHERE state_hash = ? AND consumed_at IS NULL""",
            (timestamp, state_hash),
        )
        if updated.rowcount != 1:
            db.rollback()
            return False
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise
