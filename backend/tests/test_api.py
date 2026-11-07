from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_only_real_capabilities():
    response = client.get("/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["service"] == "xflux-backend"
    assert body["capabilities"] == ["accounts"]
    assert all(not provider["oauth"] and not provider["publishing"] for provider in body["providers"])


def test_accounts_require_session_when_secret_missing(monkeypatch):
    monkeypatch.setattr("app.main.SESSION_TOKEN", "")
    response = client.get("/v1/accounts")
    assert response.status_code == 503


def test_accounts_reject_wrong_session(monkeypatch):
    monkeypatch.setattr("app.main.SESSION_TOKEN", "correct-secret")
    response = client.get("/v1/accounts", headers={"Authorization": "Bearer wrong-secret"})
    assert response.status_code == 401


def test_production_rejects_short_session_secret(monkeypatch):
    monkeypatch.setattr("app.main.ENVIRONMENT", "production")
    monkeypatch.setattr("app.main.SESSION_TOKEN", "short")
    monkeypatch.setenv("XFLUX_ALLOWED_ORIGINS", "https://app.example.com")
    response = client.get("/v1/accounts", headers={"Authorization": "Bearer short"})
    assert response.status_code == 503


def test_production_rejects_missing_origin_allowlist(monkeypatch):
    monkeypatch.setattr("app.main.ENVIRONMENT", "production")
    monkeypatch.setattr("app.main.SESSION_TOKEN", "s" * 40)
    monkeypatch.delenv("XFLUX_ALLOWED_ORIGINS", raising=False)
    response = client.get("/v1/accounts", headers={"Authorization": f"Bearer {'s' * 40}"})
    assert response.status_code == 503


def test_production_rejects_wildcard_origin(monkeypatch):
    monkeypatch.setattr("app.main.ENVIRONMENT", "production")
    monkeypatch.setattr("app.main.SESSION_TOKEN", "s" * 40)
    monkeypatch.setenv("XFLUX_ALLOWED_ORIGINS", "*")
    response = client.get("/v1/accounts", headers={"Authorization": f"Bearer {'s' * 40}"})
    assert response.status_code == 503


def test_production_accepts_explicit_https_origin_and_strong_secret(monkeypatch):
    monkeypatch.setattr("app.main.ENVIRONMENT", "production")
    monkeypatch.setattr("app.main.SESSION_TOKEN", "s" * 40)
    monkeypatch.setenv("XFLUX_ALLOWED_ORIGINS", "https://app.example.com")
    response = client.get("/v1/accounts", headers={"Authorization": f"Bearer {'s' * 40}"})
    assert response.status_code == 200


def test_account_listing_exposes_metadata_only(monkeypatch, tmp_path):
    import app.main as backend

    monkeypatch.setattr(backend, "SESSION_TOKEN", "test-secret")
    monkeypatch.setattr(backend, "DB_PATH", tmp_path / "xflux-test.sqlite3")
    with backend.connect_db() as db:
        db.execute(
            "INSERT INTO accounts (id, network, display_name, state, scopes_json, connected_at, expires_at, last_checked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("acc-1", "youtube", "Canal de teste", "connected", '["youtube.upload"]', "2026-01-01T10:00:00Z", None, "2026-01-01T10:00:00Z"),
        )
    response = client.get("/v1/accounts", headers={"Authorization": "Bearer test-secret"})
    assert response.status_code == 200
    account = response.json()["accounts"][0]
    assert account["displayName"] == "Canal de teste"
    assert "access_token" not in account
    assert "refresh_token" not in account


def test_disconnect_requires_valid_session(monkeypatch):
    monkeypatch.setattr("app.main.SESSION_TOKEN", "test-secret")
    response = client.delete("/v1/accounts/acc-1", headers={"Authorization": "Bearer wrong-secret"})
    assert response.status_code == 401


def test_oauth_is_not_faked(monkeypatch):
    monkeypatch.setattr("app.main.ENVIRONMENT", "development")
    monkeypatch.setattr("app.main.SESSION_TOKEN", "test-secret")
    response = client.post("/v1/oauth/youtube/start", headers={"Authorization": "Bearer test-secret"})
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]
