import sqlite3
import time

import jwt
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
SECRET = "test-signing-secret-that-is-at-least-32-bytes-long"


def token(subject="user-1", **overrides):
    now = int(time.time())
    claims = {
        "sub": subject,
        "iss": "https://identity.xflux.test",
        "aud": "xflux-api",
        "iat": now,
        "exp": now + 300,
    }
    claims.update(overrides)
    return jwt.encode(claims, SECRET, algorithm="HS256")


def auth(subject="user-1"):
    return {"Authorization": f"Bearer {token(subject)}"}


def configure_identity(monkeypatch):
    monkeypatch.setenv("XFLUX_JWT_SECRET", SECRET)
    monkeypatch.setenv("XFLUX_JWT_ISSUER", "https://identity.xflux.test")
    monkeypatch.setenv("XFLUX_JWT_AUDIENCE", "xflux-api")
    monkeypatch.setattr("app.main.ENVIRONMENT", "development")


def test_health_reports_only_real_capabilities():
    response = client.get("/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["service"] == "xflux-backend"
    assert body["capabilities"] == ["accounts"]
    assert all(not provider["oauth"] and not provider["publishing"] for provider in body["providers"])


def test_accounts_require_identity_configuration(monkeypatch):
    monkeypatch.delenv("XFLUX_JWT_SECRET", raising=False)
    monkeypatch.delenv("XFLUX_JWT_ISSUER", raising=False)
    monkeypatch.delenv("XFLUX_JWT_AUDIENCE", raising=False)
    response = client.get("/v1/accounts", headers=auth())
    assert response.status_code == 503


def test_accounts_reject_missing_or_invalid_bearer(monkeypatch):
    configure_identity(monkeypatch)
    assert client.get("/v1/accounts").status_code == 401
    assert client.get("/v1/accounts", headers={"Authorization": "Bearer invalid"}).status_code == 401


def test_accounts_reject_wrong_signature(monkeypatch):
    configure_identity(monkeypatch)
    forged = jwt.encode(
        {"sub": "user-1", "iss": "https://identity.xflux.test", "aud": "xflux-api",
         "iat": int(time.time()), "exp": int(time.time()) + 300},
        "attacker-secret-that-is-not-the-configured-secret",
        algorithm="HS256",
    )
    response = client.get("/v1/accounts", headers={"Authorization": f"Bearer {forged}"})
    assert response.status_code == 401


def test_accounts_reject_wrong_issuer_audience_and_expiry(monkeypatch):
    configure_identity(monkeypatch)
    now = int(time.time())
    cases = [
        token(iss="https://attacker.invalid"),
        token(aud="another-api"),
        token(exp=now - 30),
        token(sub=""),
    ]
    for value in cases:
        response = client.get("/v1/accounts", headers={"Authorization": f"Bearer {value}"})
        assert response.status_code == 401


def test_production_requires_explicit_https_origin(monkeypatch):
    configure_identity(monkeypatch)
    monkeypatch.setattr("app.main.ENVIRONMENT", "production")
    monkeypatch.delenv("XFLUX_ALLOWED_ORIGINS", raising=False)
    assert client.get("/v1/accounts", headers=auth()).status_code == 503
    monkeypatch.setenv("XFLUX_ALLOWED_ORIGINS", "*")
    assert client.get("/v1/accounts", headers=auth()).status_code == 503
    monkeypatch.setenv("XFLUX_ALLOWED_ORIGINS", "https://app.example.com")
    assert client.get("/v1/accounts", headers=auth()).status_code == 200


def test_account_listing_is_isolated_by_verified_subject(monkeypatch, tmp_path):
    import app.main as backend

    configure_identity(monkeypatch)
    monkeypatch.setattr(backend, "DB_PATH", tmp_path / "xflux-test.sqlite3")
    with backend.connect_db() as db:
        db.executemany(
            "INSERT INTO accounts (id, owner_id, network, display_name, state, scopes_json, connected_at, expires_at, last_checked_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                ("acc-1", "user-1", "youtube", "Canal do usuário 1", "connected", '["youtube.upload"]', "2026-01-01T10:00:00Z", None, "2026-01-01T10:00:00Z"),
                ("acc-2", "user-2", "instagram", "Conta do usuário 2", "connected", '["instagram_basic"]', "2026-01-02T10:00:00Z", None, "2026-01-02T10:00:00Z"),
            ],
        )

    first = client.get("/v1/accounts", headers=auth("user-1"))
    second = client.get("/v1/accounts", headers=auth("user-2"))
    assert [a["id"] for a in first.json()["accounts"]] == ["acc-1"]
    assert [a["id"] for a in second.json()["accounts"]] == ["acc-2"]
    assert "access_token" not in first.text
    assert "refresh_token" not in first.text


def test_disconnect_cannot_delete_another_users_account(monkeypatch, tmp_path):
    import app.main as backend

    configure_identity(monkeypatch)
    monkeypatch.setattr(backend, "DB_PATH", tmp_path / "disconnect-test.sqlite3")
    with backend.connect_db() as db:
        db.execute(
            "INSERT INTO accounts (id, owner_id, network, display_name, state, scopes_json, connected_at, last_checked_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("private-account", "user-2", "instagram", "Private", "connected", "[]", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"),
        )

    response = client.delete("/v1/accounts/private-account", headers=auth("user-1"))
    assert response.status_code == 204
    with backend.connect_db() as db:
        row = db.execute("SELECT owner_id FROM accounts WHERE id = ?", ("private-account",)).fetchone()
    assert row["owner_id"] == "user-2"


def test_legacy_accounts_are_not_exposed_after_owner_migration(monkeypatch, tmp_path):
    import app.main as backend

    configure_identity(monkeypatch)
    path = tmp_path / "legacy.sqlite3"
    with sqlite3.connect(path) as db:
        db.execute(
            "CREATE TABLE accounts (id TEXT PRIMARY KEY, network TEXT NOT NULL, display_name TEXT NOT NULL, "
            "state TEXT NOT NULL, scopes_json TEXT NOT NULL DEFAULT '[]', connected_at TEXT NOT NULL, "
            "expires_at TEXT, last_checked_at TEXT NOT NULL)"
        )
        db.execute(
            "INSERT INTO accounts (id, network, display_name, state, connected_at, last_checked_at) "
            "VALUES ('old-1', 'youtube', 'Legacy', 'connected', '2026-01-01', '2026-01-01')"
        )
    monkeypatch.setattr(backend, "DB_PATH", path)
    response = client.get("/v1/accounts", headers=auth())
    assert response.status_code == 200
    assert response.json()["accounts"] == []


def test_oauth_is_not_faked(monkeypatch):
    configure_identity(monkeypatch)
    response = client.post("/v1/oauth/youtube/start", headers=auth())
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]


def test_production_sessions_require_https_jwks_and_rs256(monkeypatch):
    from types import SimpleNamespace
    from cryptography.hazmat.primitives.asymmetric import rsa

    import app.main as backend

    configure_identity(monkeypatch)
    monkeypatch.setattr(backend, "ENVIRONMENT", "production")
    monkeypatch.setenv("XFLUX_ENV", "production")
    monkeypatch.setenv("XFLUX_ALLOWED_ORIGINS", "https://app.example.com")
    monkeypatch.delenv("XFLUX_JWKS_URL", raising=False)

    # Production must not silently fall back to the development shared secret.
    assert client.get("/v1/accounts", headers=auth()).status_code == 503
    monkeypatch.setenv("XFLUX_JWKS_URL", "http://identity.example.com/.well-known/jwks.json")
    assert client.get("/v1/accounts", headers=auth()).status_code == 503

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()
    now = int(time.time())
    signed = jwt.encode(
        {
            "sub": "production-user",
            "iss": "https://identity.xflux.test",
            "aud": "xflux-api",
            "iat": now,
            "exp": now + 300,
        },
        private_key,
        algorithm="RS256",
        headers={"kid": "xflux-test-key"},
    )

    class FakeJwksClient:
        def __init__(self, url, **kwargs):
            assert url == "https://identity.xflux.test/.well-known/jwks.json"
            assert kwargs["timeout"] == 5

        def get_signing_key_from_jwt(self, received):
            assert received == signed
            return SimpleNamespace(key=public_key)

    monkeypatch.setattr(jwt, "PyJWKClient", FakeJwksClient)
    monkeypatch.setenv("XFLUX_JWKS_URL", "https://identity.xflux.test/.well-known/jwks.json")
    response = client.get("/v1/accounts", headers={"Authorization": f"Bearer {signed}"})
    assert response.status_code == 200
