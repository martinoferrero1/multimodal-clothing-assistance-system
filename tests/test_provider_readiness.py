from __future__ import annotations

import time

import pytest
from pydantic import SecretStr

from core.provider_readiness import (
    ProviderReadinessError,
    validate_deployed_provider_readiness,
)
from core.settings import Settings
from infra.providers.factories.google_factory import GoogleFactory


def deployed_settings(**overrides) -> Settings:
    values = {
        "APP_ENV": "production",
        "DATABASE_URL": "postgresql+psycopg://user:password@db/lookeate",
        "SESSION_CSRF_SECRET": "a-valid-random-session-csrf-secret-value-1234567890",
        "SESSION_COOKIE_NAME": "__Host-lookeate_session",
        "SESSION_COOKIE_SECURE": True,
        "PUBLIC_APP_URL": "https://app.lookeate.example",
        "ALLOWED_HOSTS": "app.lookeate.example",
        "ALLOWED_ORIGINS": "https://app.lookeate.example",
        "RATE_LIMIT_REDIS_URL": "rediss://rate-limiter.lookeate.example:6380/0",
        "RATE_LIMIT_KEY_SECRET": "a-valid-random-rate-limit-key-secret-value-1234567890",
        "GOOGLE_LLM_MODEL": "llm-model",
        "GOOGLE_EMBEDDING_MODEL": "embedding-model",
        "GOOGLE_IMAGE_ANALYSIS_MODEL": "image-model",
        "GOOGLE_API_KEY": "provider-secret-value",
        "PROVIDER_READINESS_TIMEOUT_SECONDS": 0.05,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_local_provider_use_rejects_incomplete_configuration_without_network() -> None:
    with pytest.raises(ValueError, match="google LLM model"):
        GoogleFactory.get_llm_model_instance(None, None, SecretStr("not-used"))

    with pytest.raises(ValueError, match="google API key"):
        GoogleFactory.get_llm_model_instance("model", None, None)


def test_deployed_readiness_initializes_and_probes_all_requirements() -> None:
    initialized = []
    probed = []

    validate_deployed_provider_readiness(
        deployed_settings(),
        initializer=lambda requirement, credential: initialized.append(requirement.capability),
        probe=lambda requirement, credential, timeout: probed.append(requirement.capability) or True,
    )

    assert set(initialized) == {"llm", "embedding", "image_analysis"}
    assert set(probed) == {"llm", "embedding", "image_analysis"}


def test_deployed_readiness_rejects_missing_provider_configuration_safely() -> None:
    settings = deployed_settings(GOOGLE_API_KEY=None)

    with pytest.raises(ProviderReadinessError) as error:
        validate_deployed_provider_readiness(settings, initializer=lambda *_: object(), probe=lambda *_: True)

    assert "google" in str(error.value)
    assert "provider-secret-value" not in str(error.value)


def test_deployed_readiness_sanitizes_initialization_failure() -> None:
    def fail_initialization(*_):
        raise RuntimeError("provider-secret-value")

    with pytest.raises(ProviderReadinessError) as error:
        validate_deployed_provider_readiness(
            deployed_settings(), initializer=fail_initialization, probe=lambda *_: True
        )

    assert "could not initialize" in str(error.value)
    assert "provider-secret-value" not in str(error.value)


def test_deployed_readiness_rejects_unavailable_provider() -> None:
    with pytest.raises(ProviderReadinessError, match="google.*unavailable"):
        validate_deployed_provider_readiness(
            deployed_settings(), initializer=lambda *_: object(), probe=lambda *_: False
        )


def test_deployed_readiness_times_out_without_exposing_credentials() -> None:
    def slow_probe(*_):
        time.sleep(0.1)
        return True

    with pytest.raises(ProviderReadinessError) as error:
        validate_deployed_provider_readiness(
            deployed_settings(PROVIDER_READINESS_TIMEOUT_SECONDS=0.01),
            initializer=lambda *_: object(),
            probe=slow_probe,
        )

    assert "timed out" in str(error.value)
    assert "provider-secret-value" not in str(error.value)


def test_local_and_test_do_not_run_deployed_readiness() -> None:
    for app_env in ("local", "test"):
        settings = Settings(
            _env_file=None,
            APP_ENV=app_env,
            SESSION_CSRF_SECRET="test-session-csrf-secret",
            GOOGLE_API_KEY=None,
        )
        validate_deployed_provider_readiness(
            settings,
            initializer=lambda *_: pytest.fail("initializer must remain lazy"),
            probe=lambda *_: pytest.fail("probe must remain lazy"),
        )
