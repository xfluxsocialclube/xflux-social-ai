"""Criptografia autenticada de tokens de provedores externos.

A chave fica exclusivamente no ambiente/gerenciador de segredos do servidor.
Este módulo não persiste tokens nem registra valores em logs.
"""
from __future__ import annotations

import os

from cryptography.fernet import Fernet, InvalidToken


_KEY_ENV = "XFLUX_TOKEN_ENCRYPTION_KEY"


def _fernet() -> Fernet:
    raw_key = os.getenv(_KEY_ENV, "").strip()
    if not raw_key:
        raise RuntimeError(f"{_KEY_ENV} must be configured outside the repository")
    try:
        return Fernet(raw_key.encode("ascii"))
    except (ValueError, UnicodeEncodeError):
        raise RuntimeError(f"{_KEY_ENV} must contain a valid Fernet key") from None


def encrypt_token(token: str) -> str:
    """Encrypt a non-empty provider token; returns a URL-safe authenticated envelope."""
    if not isinstance(token, str) or not token:
        raise ValueError("token must be a non-empty string")
    return _fernet().encrypt(token.encode("utf-8")).decode("ascii")


def decrypt_token(envelope: str) -> str:
    """Decrypt an envelope or fail closed without returning partial/plaintext data."""
    if not isinstance(envelope, str) or not envelope:
        raise ValueError("encrypted token must be a non-empty string")
    try:
        return _fernet().decrypt(envelope.encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeEncodeError, UnicodeDecodeError):
        raise ValueError("encrypted token is invalid or cannot be decrypted") from None
