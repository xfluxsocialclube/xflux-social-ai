"""Validação de tokens de sessão assinados por um provedor de identidade.

O backend não emite tokens nem aceita um identificador de cliente enviado no corpo.
O subject é extraído exclusivamente de um JWT verificado.
"""
from __future__ import annotations

import os

import jwt
from fastapi import HTTPException


def authenticated_subject(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    secret = os.getenv("XFLUX_JWT_SECRET", "")
    issuer = os.getenv("XFLUX_JWT_ISSUER", "")
    audience = os.getenv("XFLUX_JWT_AUDIENCE", "")
    if len(secret) < 32 or not issuer or not audience:
        raise HTTPException(
            status_code=503,
            detail="Verified identity provider configuration is required",
        )

    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        claims = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            issuer=issuer,
            audience=audience,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Unauthorized") from None

    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject.strip() or len(subject) > 255:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return subject
