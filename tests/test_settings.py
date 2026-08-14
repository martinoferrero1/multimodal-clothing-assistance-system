from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from core.settings import Settings


ROOT = Path(__file__).resolve().parents[1]


DEPLOYED_SETTINGS = {
    "DATABASE_URL": "postgresql+psycopg://user:password@db/lookeate",
    "AUTH_TOKEN_SECRET": "a-valid-random-auth-secret-value-1234567890",
    "PUBLIC_APP_URL": "https://app.lookeate.example",
    "ALLOWED_HOSTS": "app.lookeate.example,api.lookeate.example",
    "ALLOWED_ORIGINS": '["https://app.lookeate.example"]',
}


def build_settings(**overrides) -> Settings:
    values = {"APP_ENV": "test", "AUTH_TOKEN_SECRET": "test-auth-secret"}
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_env_example_contains_parseable_optional_values(monkeypatch) -> None:
    for field_name in Settings.model_fields:
        monkeypatch.delenv(field_name, raising=False)

    configured = Settings(
        _env_file=ROOT / ".env.example",
        AUTH_TOKEN_SECRET="test-auth-secret",
    )

    assert configured.APP_ENV == "local"
    assert configured.GOOGLE_LLM_TEMPERATURE == 0.2
    assert configured.GROQ_LLM_TEMPERATURE == 0.2
    assert configured.INCLUDE_PROMPT_EXAMPLES is False


@pytest.mark.parametrize("app_env", ["local", "test"])
def test_local_and_test_accept_sqlite_without_provider_credentials(app_env: str) -> None:
    configured = build_settings(APP_ENV=app_env, DATABASE_URL="sqlite:///:memory:")

    assert configured.APP_ENV == app_env
    assert not configured.GOOGLE_API_KEY or not configured.GOOGLE_API_KEY.get_secret_value()
    assert configured.PUBLIC_APP_URL == "http://localhost:3000"


@pytest.mark.parametrize("app_env", ["staging", "production"])
def test_deployed_environments_accept_valid_configuration(app_env: str) -> None:
    configured = build_settings(APP_ENV=app_env, **DEPLOYED_SETTINGS)

    assert configured.APP_ENV == app_env
    assert configured.ALLOWED_HOSTS == ["app.lookeate.example", "api.lookeate.example"]
    assert configured.ALLOWED_ORIGINS == ["https://app.lookeate.example"]
    assert "valid-random" not in repr(configured.AUTH_TOKEN_SECRET)


def test_app_env_is_required_and_unknown_values_are_rejected(monkeypatch) -> None:
    monkeypatch.delenv("APP_ENV")
    with pytest.raises(ValidationError, match="APP_ENV"):
        Settings(_env_file=None, AUTH_TOKEN_SECRET="test-auth-secret")

    with pytest.raises(ValidationError, match="APP_ENV"):
        build_settings(APP_ENV="preview")


@pytest.mark.parametrize("app_env", ["staging", "production"])
def test_deployed_environments_reject_sqlite(app_env: str) -> None:
    with pytest.raises(ValidationError, match="DATABASE_URL"):
        build_settings(APP_ENV=app_env, **(DEPLOYED_SETTINGS | {"DATABASE_URL": "sqlite:///app.db"}))


@pytest.mark.parametrize(
    "auth_secret",
    [
        "short",
        "development-auth-secret-change-me",
        "replace-me-with-a-production-secret-value",
        "this-is-an-example-auth-secret-value",
    ],
)
def test_deployed_environments_reject_unsafe_auth_secrets(auth_secret: str) -> None:
    with pytest.raises(ValidationError) as error:
        build_settings(APP_ENV="production", **(DEPLOYED_SETTINGS | {"AUTH_TOKEN_SECRET": auth_secret}))

    message = str(error.value)
    assert "AUTH_TOKEN_SECRET" in message
    assert auth_secret not in message


def test_auth_secret_is_required_without_exposing_other_inputs(monkeypatch) -> None:
    monkeypatch.delenv("AUTH_TOKEN_SECRET")
    values = DEPLOYED_SETTINGS.copy()
    values.pop("AUTH_TOKEN_SECRET")

    with pytest.raises(ValidationError) as error:
        Settings(_env_file=None, APP_ENV="production", **values)

    assert "AUTH_TOKEN_SECRET" in str(error.value)
    assert "password@db" not in str(error.value)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("PUBLIC_APP_URL", None),
        ("PUBLIC_APP_URL", "http://app.lookeate.example"),
        ("ALLOWED_HOSTS", ""),
        ("ALLOWED_HOSTS", "*"),
        ("ALLOWED_HOSTS", "https://app.lookeate.example"),
        ("ALLOWED_ORIGINS", ""),
        ("ALLOWED_ORIGINS", "*"),
        ("ALLOWED_ORIGINS", "http://app.lookeate.example"),
    ],
)
def test_deployed_environments_reject_invalid_http_identity(field: str, value) -> None:
    with pytest.raises(ValidationError, match=field):
        build_settings(APP_ENV="production", **(DEPLOYED_SETTINGS | {field: value}))


def test_host_and_origin_lists_accept_json_and_comma_delimited_values() -> None:
    configured = build_settings(
        ALLOWED_HOSTS='["localhost", "127.0.0.1"]',
        ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000",
    )

    assert configured.ALLOWED_HOSTS == ["localhost", "127.0.0.1"]
    assert configured.ALLOWED_ORIGINS == [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
