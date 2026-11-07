from fastapi.testclient import TestClient
from app.main import app
client = TestClient(app)

def test_health_reports_only_real_capabilities():
    response = client.get("/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["service"] == "xflux-backend"
    assert body["capabilities"] == ["accounts"]
    assert all(not p["oauth"] and not p["publishing"] for p in body["providers"])

def test_accounts_require_session_when_secret_missing(monkeypatch):
    monkeypatch.setattr("app.main.SESSION_TOKEN", "")
    response = client.get("/v1/accounts")
    assert response.status_code == 503

def test_oauth_is_not_faked(monkeypatch):
    monkeypatch.setattr("app.main.SESSION_TOKEN", "test-secret")
    response = client.post("/v1/oauth/youtube/start", headers={"Authorization": "Bearer test-secret"})
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]
