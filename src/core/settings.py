import json
from typing import Literal, Optional
from urllib.parse import urlsplit

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from schemas.provider import Provider


AppEnvironment = Literal["local", "test", "staging", "production"]

_DEPLOYED_ENVIRONMENTS = {"staging", "production"}
_KNOWN_AUTH_SECRETS = {
    "changeme",
    "development-auth-secret-change-me",
    "development-secret",
    "secret",
    "development-session-csrf-secret-change-me",
}
_PLACEHOLDER_SECRET_PARTS = (
    "example",
    "placeholder",
    "replace-me",
    "your-secret",
)


def _parse_list(value: str | list[str] | tuple[str, ...] | None) -> list[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return [str(item).strip() for item in value if str(item).strip()]

    raw_value = value.strip()
    if not raw_value:
        return []
    if raw_value.startswith("["):
        try:
            parsed = json.loads(raw_value)
        except json.JSONDecodeError as exc:
            raise ValueError("must be a JSON array or comma-delimited list") from exc
        if not isinstance(parsed, list):
            raise ValueError("must be a JSON array or comma-delimited list")
        return [str(item).strip() for item in parsed if str(item).strip()]
    return [item.strip() for item in raw_value.split(",") if item.strip()]


def _is_https_origin(value: str) -> bool:
    parsed = urlsplit(value)
    return (
        parsed.scheme == "https"
        and bool(parsed.hostname)
        and not parsed.username
        and not parsed.password
        and parsed.path in ("", "/")
        and not parsed.query
        and not parsed.fragment
    )


def _is_explicit_host(value: str) -> bool:
    if not value or "*" in value or "://" in value or any(character.isspace() for character in value):
        return False
    try:
        parsed = urlsplit(f"//{value}")
        parsed.port
    except ValueError:
        return False
    return bool(parsed.hostname) and parsed.path == "" and not parsed.query and not parsed.fragment


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        hide_input_in_errors=True,
        enable_decoding=False,
    )

    APP_ENV: AppEnvironment
    DATABASE_URL: str = "sqlite:///catalog.db"
    DATABASE_ECHO: bool = False
    LANGGRAPH_CHECKPOINT_DATABASE_URL: Optional[str] = None
    SESSION_CSRF_SECRET: SecretStr = SecretStr("development-session-csrf-secret-change-me")
    SESSION_IDLE_MINUTES: int = 60
    SESSION_ABSOLUTE_HOURS: int = 168
    SESSION_TOUCH_INTERVAL_SECONDS: int = 300
    SESSION_COOKIE_NAME: str = "lookeate_session"
    SESSION_COOKIE_SECURE: bool = False
    SESSION_COOKIE_SAMESITE: Literal["lax", "strict"] = "lax"
    PUBLIC_APP_URL: Optional[str] = None
    ALLOWED_HOSTS: str | list[str] = ""
    ALLOWED_ORIGINS: str | list[str] = ""
    PROVIDER_READINESS_TIMEOUT_SECONDS: float = 5.0
    MAX_CHAT_IMAGE_ATTACHMENTS: int = 3
    MAX_CHAT_IMAGE_UPLOAD_BYTES: int = 4 * 1024 * 1024

    GOOGLE_LLM_MODEL: Optional[str] = None
    GROQ_LLM_MODEL: Optional[str] = None

    GOOGLE_EMBEDDING_MODEL: Optional[str] = None
    GROQ_EMBEDDING_MODEL: Optional[str] = None

    GOOGLE_IMAGE_ANALYSIS_MODEL: Optional[str] = None

    GOOGLE_API_KEY: Optional[SecretStr] = None
    GROQ_API_KEY: Optional[SecretStr] = None

    LLM_SUB_AGENTS_PROVIDER: Provider = Provider.google
    LLM_SUPERVISOR_PROVIDER: Provider = Provider.google
    EMBEDDINGS_PROVIDER: Provider = Provider.google
    IMAGE_ANALYSIS_PROVIDER: Provider = Provider.google

    GOOGLE_LLM_TEMPERATURE: Optional[float] = None
    GROQ_LLM_TEMPERATURE: Optional[float] = None

    INCLUDE_PROMPT_EXAMPLES: Optional[bool] = None
    PRODUCT_SEARCH_PRIORITY_FIELDS: str = ""
    IMAGE_SEARCH_MODE: Literal["characteristics", "visual_similarity"] = "characteristics"
    IMAGE_VISUAL_SEARCH_CANDIDATE_LIMIT: int = 80
    IMAGE_VISUAL_SEARCH_WEIGHT: float = 10.0
    IMAGE_VISUAL_SEARCH_FETCH_TIMEOUT_SECONDS: float = 3.0
    IMAGE_VISUAL_SEARCH_MAX_IMAGE_BYTES: int = 5 * 1024 * 1024

    BUSINESS_KNOWLEDGE_DIR: str = "data/business_knowledge"
    BUSINESS_KNOWLEDGE_GLOB: str = "*.knowledge.md"
    BUSINESS_FAISS_INDEX_DIR: str = "data/business_knowledge_index"
    BUSINESS_RAG_CHUNK_SIZE: int = 700
    BUSINESS_RAG_CHUNK_OVERLAP: int = 120
    BUSINESS_RAG_TOP_K: int = 4
    BUSINESS_RAG_MIN_SCORE: float = 0.2

    @model_validator(mode="after")
    def validate_environment_policy(self):
        self.ALLOWED_HOSTS = _parse_list(self.ALLOWED_HOSTS)
        self.ALLOWED_ORIGINS = _parse_list(self.ALLOWED_ORIGINS)

        if self.PROVIDER_READINESS_TIMEOUT_SECONDS <= 0:
            raise ValueError("PROVIDER_READINESS_TIMEOUT_SECONDS must be greater than zero")

        if self.SESSION_IDLE_MINUTES <= 0:
            raise ValueError("SESSION_IDLE_MINUTES must be greater than zero")
        if self.SESSION_ABSOLUTE_HOURS <= 0:
            raise ValueError("SESSION_ABSOLUTE_HOURS must be greater than zero")
        if self.SESSION_TOUCH_INTERVAL_SECONDS < 0:
            raise ValueError("SESSION_TOUCH_INTERVAL_SECONDS must not be negative")
        if self.SESSION_IDLE_MINUTES * 60 > self.SESSION_ABSOLUTE_HOURS * 3600:
            raise ValueError("SESSION_IDLE_MINUTES must not exceed SESSION_ABSOLUTE_HOURS")

        if self.APP_ENV not in _DEPLOYED_ENVIRONMENTS:
            self.PUBLIC_APP_URL = self.PUBLIC_APP_URL or "http://localhost:3000"
            self.ALLOWED_HOSTS = self.ALLOWED_HOSTS or ["localhost", "127.0.0.1"]
            self.ALLOWED_ORIGINS = self.ALLOWED_ORIGINS or ["http://localhost:3000"]
            return self

        if not self.DATABASE_URL.lower().startswith("postgresql"):
            raise ValueError("DATABASE_URL must use PostgreSQL in staging and production")

        csrf_secret = self.SESSION_CSRF_SECRET.get_secret_value()
        normalized_secret = csrf_secret.strip().lower()
        if len(csrf_secret) < 32:
            raise ValueError("SESSION_CSRF_SECRET must be at least 32 characters in staging and production")
        if normalized_secret in _KNOWN_AUTH_SECRETS or any(
            marker in normalized_secret for marker in _PLACEHOLDER_SECRET_PARTS
        ):
            raise ValueError("SESSION_CSRF_SECRET must not be a known or placeholder value")
        if not self.SESSION_COOKIE_SECURE:
            raise ValueError("SESSION_COOKIE_SECURE must be true in staging and production")
        if not self.SESSION_COOKIE_NAME.startswith("__Host-"):
            raise ValueError("SESSION_COOKIE_NAME must use a __Host- prefix in staging and production")

        if (
            not self.PUBLIC_APP_URL
            or "*" in self.PUBLIC_APP_URL
            or not _is_https_origin(self.PUBLIC_APP_URL)
        ):
            raise ValueError("PUBLIC_APP_URL must be an HTTPS origin in staging and production")
        if not self.ALLOWED_HOSTS or any(
            not _is_explicit_host(host) for host in self.ALLOWED_HOSTS
        ):
            raise ValueError("ALLOWED_HOSTS must contain explicit non-wildcard hosts")
        if not self.ALLOWED_ORIGINS or any(
            "*" in origin or not _is_https_origin(origin) for origin in self.ALLOWED_ORIGINS
        ):
            raise ValueError("ALLOWED_ORIGINS must contain explicit HTTPS origins")
        return self

    def provider_api_key(self, provider: Provider) -> Optional[SecretStr]:
        if provider == Provider.google:
            return self.GOOGLE_API_KEY
        if provider == Provider.groq:
            return self.GROQ_API_KEY
        return None


settings = Settings()
