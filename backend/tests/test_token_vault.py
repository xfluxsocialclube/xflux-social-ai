import pytest
from cryptography.fernet import Fernet

from app.token_vault import decrypt_token, encrypt_token


def test_token_round_trip_uses_authenticated_encryption(monkeypatch):
    monkeypatch.setenv("XFLUX_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode("ascii"))
    original = "provider-access-token-sensitive-value"
    encrypted = encrypt_token(original)
    assert encrypted != original
    assert original not in encrypted
    assert decrypt_token(encrypted) == original


def test_same_token_gets_a_different_envelope_each_time(monkeypatch):
    monkeypatch.setenv("XFLUX_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode("ascii"))
    assert encrypt_token("same-token") != encrypt_token("same-token")


def test_missing_or_invalid_key_fails_closed(monkeypatch):
    monkeypatch.delenv("XFLUX_TOKEN_ENCRYPTION_KEY", raising=False)
    with pytest.raises(RuntimeError):
        encrypt_token("token")
    monkeypatch.setenv("XFLUX_TOKEN_ENCRYPTION_KEY", "not-a-fernet-key")
    with pytest.raises(RuntimeError):
        encrypt_token("token")


def test_tampered_ciphertext_is_rejected(monkeypatch):
    monkeypatch.setenv("XFLUX_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode("ascii"))
    encrypted = encrypt_token("provider-token")
    tampered = encrypted[:-1] + ("A" if encrypted[-1] != "A" else "B")
    with pytest.raises(ValueError):
        decrypt_token(tampered)


def test_ciphertext_from_another_key_is_rejected(monkeypatch):
    first_key = Fernet.generate_key().decode("ascii")
    second_key = Fernet.generate_key().decode("ascii")
    monkeypatch.setenv("XFLUX_TOKEN_ENCRYPTION_KEY", first_key)
    encrypted = encrypt_token("provider-token")
    monkeypatch.setenv("XFLUX_TOKEN_ENCRYPTION_KEY", second_key)
    with pytest.raises(ValueError):
        decrypt_token(encrypted)


@pytest.mark.parametrize("value", ["", None, 123])
def test_empty_or_non_string_tokens_are_rejected(value, monkeypatch):
    monkeypatch.setenv("XFLUX_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode("ascii"))
    with pytest.raises(ValueError):
        encrypt_token(value)
