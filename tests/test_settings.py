from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from core.settings import Settings


ROOT = Path(__file__).resolve().parents[1]


DEPLOYED_SETTINGS = {
    "DATABASE_URL": "postgresql+psycopg://user:password@db/lookeate",
    "SESSION_CSRF_SECRET": "a-valid-random-session-csrf-secret-value-1234567890",
    "SESSION_COOKIE_NAME": "__Host-lookeate_session",
    "SESSION_COOKIE_SECURE": True,
    "PUBLIC_APP_URL": "https://app.lookeate.example",
    "ALLOWED_HOSTS": "app.lookeate.example,api.lookeate.example",
    "ALLOWED_ORIGINS": '["https://app.lookeate.example"]',
    "RATE_LIMIT_REDIS_URL": "rediss://rate-limiter.lookeate.example:6380/0",
    "RATE_LIMIT_KEY_SECRET": "a-valid-random-rate-limit-key-secret-value-1234567890",
    "STORE_APPROVER_EMAILS": "approver@lookeate.example",
    "STORE_EMAIL_WEBHOOK_URL": "https://email.lookeate.example",
    "STORE_EMAIL_WEBHOOK_TOKEN": "a-valid-random-store-email-webhook-token-value-1234567890",
    "STORE_TOTP_ENCRYPTION_KEY": "YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXpBQkNERUY=",
    "STORE_EMAIL_VERIFICATION_MOCKED": False,
}


def build_settings(**overrides) -> Settings:
    values = {"APP_ENV": "test", "SESSION_CSRF_SECRET": "test-session-csrf-secret"}
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_env_example_contains_parseable_optional_values(monkeypatch) -> None:
    for field_name in Settings.model_fields:
        monkeypatch.delenv(field_name, raising=False)

    configured = Settings(
        _env_file=ROOT / ".env.example",
        SESSION_CSRF_SECRET="test-session-csrf-secret",
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
    assert "valid-random" not in repr(configured.SESSION_CSRF_SECRET)
    assert "valid-random" not in repr(configured.RATE_LIMIT_KEY_SECRET)


def test_app_env_is_required_and_unknown_values_are_rejected(monkeypatch) -> None:
    monkeypatch.delenv("APP_ENV")
    with pytest.raises(ValidationError, match="APP_ENV"):
        Settings(_env_file=None, SESSION_CSRF_SECRET="test-session-csrf-secret")

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
        build_settings(APP_ENV="production", **(DEPLOYED_SETTINGS | {"SESSION_CSRF_SECRET": auth_secret}))

    message = str(error.value)
    assert "SESSION_CSRF_SECRET" in message
    assert auth_secret not in message


def test_auth_secret_is_required_without_exposing_other_inputs(monkeypatch) -> None:
    monkeypatch.delenv("SESSION_CSRF_SECRET")
    values = DEPLOYED_SETTINGS.copy()
    values.pop("SESSION_CSRF_SECRET")

    with pytest.raises(ValidationError) as error:
        Settings(_env_file=None, APP_ENV="production", **values)

    assert "SESSION_CSRF_SECRET" in str(error.value)
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


@pytest.mark.parametrize(
    ("field", "value", "environment"),
    [
        ("SESSION_IDLE_MINUTES", 0, "test"),
        ("SESSION_ABSOLUTE_HOURS", 0, "test"),
        ("SESSION_TOUCH_INTERVAL_SECONDS", -1, "test"),
        ("SESSION_IDLE_MINUTES", 169 * 60, "test"),
        ("SESSION_COOKIE_SECURE", False, "production"),
        ("SESSION_COOKIE_NAME", "lookeate_session", "production"),
    ],
)
def test_session_configuration_rejects_invalid_lifetimes_and_deployed_cookie_policy(
    field: str, value: object, environment: str
) -> None:
    overrides = {field: value}
    if environment == "production":
        overrides = DEPLOYED_SETTINGS | overrides
    with pytest.raises(ValidationError, match=field):
        build_settings(APP_ENV=environment, **overrides)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("RATE_LIMIT_REDIS_URL", None),
        ("RATE_LIMIT_REDIS_URL", "http://not-redis.example"),
        ("RATE_LIMIT_KEY_SECRET", "short"),
        ("RATE_LIMIT_KEY_SECRET", "replace-me-with-a-rate-limit-secret"),
    ],
)
def test_deployed_environments_reject_missing_shared_rate_limit_enforcement(
    field: str, value: object
) -> None:
    with pytest.raises(ValidationError, match=field):
        build_settings(APP_ENV="production", **(DEPLOYED_SETTINGS | {field: value}))


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("MAX_CHAT_IMAGE_TOTAL_UPLOAD_BYTES", 1),
        ("MAX_CHAT_IMAGE_TOTAL_PIXELS", 1),
        ("CHAT_IMAGE_ALLOWED_MIME_TYPES", "image/jpeg,image/svg+xml"),
        ("IMAGE_VISUAL_SEARCH_ALLOWED_SCHEMES", "file,http"),
        ("IMAGE_VISUAL_SEARCH_TOTAL_TIMEOUT_SECONDS", 0.5),
    ],
)
def test_security_budget_configuration_rejects_unsafe_values(field: str, value: object) -> None:
    with pytest.raises(ValidationError, match=field):
        build_settings(**{field: value})
