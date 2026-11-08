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


def test_meta_oauth_start_uses_verified_session_and_one_time_state(monkeypatch, tmp_path):
    from urllib.parse import parse_qs, urlparse
    from cryptography.fernet import Fernet
    import app.main as backend

    configure_identity(monkeypatch)
    monkeypatch.setattr(backend, "DB_PATH", tmp_path / "meta-oauth.sqlite3")
    monkeypatch.setenv("META_APP_ID", "meta-app-test")
    monkeypatch.setenv("META_APP_SECRET", "meta-secret-test")
    monkeypatch.setenv("META_OAUTH_REDIRECT_URI", "https://api.xflux.test/v1/oauth/meta/callback")
    monkeypatch.setenv("XFLUX_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode())
    response = client.post("/v1/oauth/instagram/start", headers=auth("verified-user"))
    assert response.status_code == 200
    result = response.json()
    parsed = urlparse(result["authorizationUrl"])
    params = parse_qs(parsed.query)
    assert parsed.scheme == "https"
    assert parsed.netloc == "www.facebook.com"
    assert params["client_id"] == ["meta-app-test"]
    assert params["redirect_uri"] == ["https://api.xflux.test/v1/oauth/meta/callback"]
    assert result["expiresInSeconds"] == 600
    with backend.connect_db() as db:
        row = db.execute("SELECT network, session_subject, consumed_at FROM oauth_states").fetchone()
    assert row["network"] == "instagram"
    assert row["session_subject"] == "verified-user"
    assert row["consumed_at"] is None


def test_meta_oauth_is_not_advertised_without_encryption_key(monkeypatch):
    monkeypatch.setenv("META_APP_ID", "meta-app-test")
    monkeypatch.setenv("META_APP_SECRET", "meta-secret-test")
    monkeypatch.setenv("META_OAUTH_REDIRECT_URI", "https://api.xflux.test/v1/oauth/meta/callback")
    monkeypatch.delenv("XFLUX_TOKEN_ENCRYPTION_KEY", raising=False)
    body = client.get("/v1/health").json()
    assert all(not p["oauth"] for p in body["providers"] if p["network"] in ("instagram", "facebook"))


def test_meta_callback_paginates_pages_and_encrypts_linked_instagram_tokens(monkeypatch, tmp_path):
    import app.main as backend
    from app.oauth_state import issue_oauth_state
    from app.token_vault import decrypt_token
    from cryptography.fernet import Fernet

    monkeypatch.setattr(backend, "DB_PATH", tmp_path / "meta-callback.sqlite3")
    monkeypatch.setenv("META_APP_ID", "meta-app-test")
    monkeypatch.setenv("META_APP_SECRET", "meta-secret-test")
    monkeypatch.setenv("META_OAUTH_REDIRECT_URI", "https://api.xflux.test/v1/oauth/meta/callback")
    monkeypatch.setenv("META_GRAPH_VERSION", "v25.0")
    monkeypatch.setenv("XFLUX_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode())
    with backend.connect_db() as db:
        state = issue_oauth_state(db, network="instagram", session_subject="owner-ig")
        db.commit()

    responses = iter([
        {"access_token": "short-user-token"},
        {"access_token": "long-user-token", "expires_in": 5184000},
        {
            "data": [{
                "id": "page-1", "name": "Loja Um", "access_token": "page-token-1",
                "instagram_business_account": {"id": "ig-1"},
            }],
            "paging": {"next": "https://graph.facebook.com/v25.0/me/accounts?after=next"},
        },
        {
            "data": [{
                "id": "page-2", "name": "Loja Dois", "access_token": "page-token-2",
                "instagram_business_account": {"id": "ig-2"},
            }],
        },
    ])
    monkeypatch.setattr(backend, "_meta_json", lambda url, **kwargs: next(responses))
    response = backend.meta_oauth_callback(code="authorization-code", state=state)
    assert response.status_code == 200
    with backend.connect_db() as db:
        rows = db.execute(
            "SELECT network, display_name, encrypted_token, provider_account_id, expires_at "
            "FROM accounts WHERE owner_id = ? ORDER BY provider_account_id",
            ("owner-ig",),
        ).fetchall()
    assert [row["provider_account_id"] for row in rows] == ["ig-1", "ig-2"]
    assert all(row["network"] == "instagram" for row in rows)
    assert all(row["expires_at"] is None for row in rows)
    assert decrypt_token(rows[0]["encrypted_token"]) == "page-token-1"
    assert decrypt_token(rows[1]["encrypted_token"]) == "page-token-2"
