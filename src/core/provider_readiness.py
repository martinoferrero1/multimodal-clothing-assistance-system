from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from dataclasses import dataclass
from typing import Callable
from urllib.parse import quote
from urllib.request import Request, urlopen

from pydantic import SecretStr

from core.settings import Settings
from schemas.provider import Provider


class ProviderReadinessError(RuntimeError):
    pass


@dataclass(frozen=True)
class ProviderRequirement:
    provider: Provider
    capability: str
    model: str | None
    temperature: float | None = None


ProviderInitializer = Callable[[ProviderRequirement, SecretStr], object]
ProviderProbe = Callable[[ProviderRequirement, SecretStr, float], bool]


def required_provider_configuration(settings: Settings) -> list[ProviderRequirement]:
    requirements = [
        _llm_requirement(settings, settings.LLM_SUB_AGENTS_PROVIDER),
        _llm_requirement(settings, settings.LLM_SUPERVISOR_PROVIDER),
        ProviderRequirement(
            settings.EMBEDDINGS_PROVIDER,
            "embedding",
            _provider_model(settings, settings.EMBEDDINGS_PROVIDER, "embedding"),
        ),
        ProviderRequirement(
            settings.IMAGE_ANALYSIS_PROVIDER,
            "image_analysis",
            settings.GOOGLE_IMAGE_ANALYSIS_MODEL
            if settings.IMAGE_ANALYSIS_PROVIDER == Provider.google
            else None,
            settings.GOOGLE_LLM_TEMPERATURE,
        ),
    ]
    return list(dict.fromkeys(requirements))


def validate_deployed_provider_readiness(
    settings: Settings,
    *,
    initializer: ProviderInitializer | None = None,
    probe: ProviderProbe | None = None,
) -> None:
    if settings.APP_ENV not in {"staging", "production"}:
        return

    initialize = initializer or _initialize_requirement
    availability_probe = probe or _probe_provider
    requirements = required_provider_configuration(settings)
    for requirement in requirements:
        provider = requirement.provider
        credential = settings.provider_api_key(provider)
        if not requirement.model or credential is None or not credential.get_secret_value().strip():
            raise ProviderReadinessError(f"Required provider '{provider.value}' is not configured")
        try:
            initialize(requirement, credential)
        except Exception as exc:
            raise ProviderReadinessError(
                f"Required provider '{provider.value}' could not initialize"
            ) from exc
        _run_bounded_probe(
            requirement,
            credential,
            settings.PROVIDER_READINESS_TIMEOUT_SECONDS,
            availability_probe,
        )


def _llm_requirement(settings: Settings, provider: Provider) -> ProviderRequirement:
    temperature = (
        settings.GOOGLE_LLM_TEMPERATURE
        if provider == Provider.google
        else settings.GROQ_LLM_TEMPERATURE
    )
    return ProviderRequirement(provider, "llm", _provider_model(settings, provider, "llm"), temperature)


def _provider_model(settings: Settings, provider: Provider, capability: str) -> str | None:
    if provider == Provider.google:
        return settings.GOOGLE_LLM_MODEL if capability == "llm" else settings.GOOGLE_EMBEDDING_MODEL
    if provider == Provider.groq:
        return settings.GROQ_LLM_MODEL if capability == "llm" else settings.GROQ_EMBEDDING_MODEL
    return None


def _initialize_requirement(requirement: ProviderRequirement, credential: SecretStr) -> object:
    if requirement.provider == Provider.google:
        from infra.providers.factories.google_factory import GoogleFactory

        if requirement.capability == "embedding":
            return GoogleFactory.get_embedding_model_instance(requirement.model, credential)
        return GoogleFactory.get_llm_model_instance(
            requirement.model, requirement.temperature, credential
        )
    if requirement.provider == Provider.groq:
        from infra.providers.factories.groq_factory import GroqFactory

        if requirement.capability == "embedding":
            return GroqFactory.get_embedding_model_instance(requirement.model, credential)
        if requirement.capability == "image_analysis":
            raise ValueError("unsupported image analysis provider")
        return GroqFactory.get_llm_model_instance(requirement.model, requirement.temperature, credential)
    raise ValueError("unsupported provider")


def _run_bounded_probe(
    requirement: ProviderRequirement,
    credential: SecretStr,
    timeout: float,
    probe: ProviderProbe,
) -> None:
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(probe, requirement, credential, timeout)
    try:
        if not future.result(timeout=timeout):
            raise ProviderReadinessError(
                f"Required provider '{requirement.provider.value}' is unavailable"
            )
    except FutureTimeoutError as exc:
        future.cancel()
        raise ProviderReadinessError(
            f"Required provider '{requirement.provider.value}' readiness check timed out"
        ) from exc
    except ProviderReadinessError:
        raise
    except Exception as exc:
        raise ProviderReadinessError(
            f"Required provider '{requirement.provider.value}' is unavailable"
        ) from exc
    finally:
        executor.shutdown(wait=False, cancel_futures=True)


def _probe_provider(
    requirement: ProviderRequirement, credential: SecretStr, timeout: float
) -> bool:
    model = requirement.model or ""
    if requirement.provider == Provider.google:
        if requirement.capability == "embedding":
            from infra.providers.factories.google_factory import GoogleFactory

            model = GoogleFactory.normalize_embedding_model_name(model)
        elif not model.startswith("models/"):
            model = f"models/{model}"
        request = Request(
            f"https://generativelanguage.googleapis.com/v1beta/{quote(model, safe='/')}",
            headers={"x-goog-api-key": credential.get_secret_value()},
        )
    elif requirement.provider == Provider.groq:
        request = Request(
            f"https://api.groq.com/openai/v1/models/{quote(model, safe='')}",
            headers={"Authorization": f"Bearer {credential.get_secret_value()}"},
        )
    else:
        return False
    with urlopen(request, timeout=timeout) as response:
        return 200 <= response.status < 300
