"""Validação de sessões XFLUX emitidas por um provedor de identidade.

Em desenvolvimento aceita HS256 com segredo local. Em produção exige JWKS
HTTPS e RS256; a chave pública é obtida do provedor, nunca do navegador.
O backend não emite tokens nem aceita um identificador de cliente no corpo.
"""
from __future__ import annotations

import os
from urllib.parse import urlsplit

import jwt
from fastapi import HTTPException


def _decode_production_token(token: str, issuer: str, audience: str) -> dict:
    jwks_url = os.getenv("XFLUX_JWKS_URL", "").strip()
    parsed = urlsplit(jwks_url)
    if (
        parsed.scheme != "https"
        or not parsed.netloc
        or parsed.username
        or parsed.password
        or parsed.fragment
    ):
        raise HTTPException(
            status_code=503,
            detail="A valid HTTPS identity JWKS URL is required in production",
        )

    try:
        signing_key = jwt.PyJWKClient(
            jwks_url, cache_jwk_set=True, lifespan=300, timeout=5
        ).get_signing_key_from_jwt(token).key
    except jwt.PyJWKClientConnectionError:
        raise HTTPException(
            status_code=503, detail="Identity provider is temporarily unavailable"
        ) from None
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Unauthorized") from None

    try:
        return jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            issuer=issuer,
            audience=audience,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Unauthorized") from None


def _decode_development_token(token: str, issuer: str, audience: str) -> dict:
    secret = os.getenv("XFLUX_JWT_SECRET", "")
    if len(secret) < 32:
        raise HTTPException(
            status_code=503,
            detail="A development JWT secret with at least 32 characters is required",
        )
    try:
        return jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            issuer=issuer,
            audience=audience,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Unauthorized") from None


def authenticated_subject(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    issuer = os.getenv("XFLUX_JWT_ISSUER", "").strip()
    audience = os.getenv("XFLUX_JWT_AUDIENCE", "").strip()
    if not issuer or not audience:
        raise HTTPException(
            status_code=503,
            detail="Identity provider issuer and audience are required",
        )

    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if os.getenv("XFLUX_ENV", "development").lower() == "production":
        claims = _decode_production_token(token, issuer, audience)
    else:
        claims = _decode_development_token(token, issuer, audience)

    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject.strip() or len(subject) > 255:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return subject
