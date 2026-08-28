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
_SUPPORTED_IMAGE_MIME_TYPES = {
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/webp",
}


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
    STORE_TOTP_ENCRYPTION_KEY: SecretStr = SecretStr("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    STORE_TOTP_ISSUER: str = "Lookeate"
    STORE_TOTP_STEP_UP_MAX_AGE_SECONDS: int = 900
    # Temporary product switch: local/test may accept store email ownership
    # without sending a real verification message. It is rejected in deployed
    # environments so this cannot silently become a production bypass.
    STORE_EMAIL_VERIFICATION_MOCKED: bool = True
    STORE_EMAIL_VERIFICATION_TTL_SECONDS: int = 900
    STORE_REGISTRATION_RETENTION_DAYS: int = 30
    STORE_APPROVER_EMAILS: str | list[str] = ""
    STORE_EMAIL_WEBHOOK_URL: Optional[str] = None
    STORE_EMAIL_WEBHOOK_TOKEN: Optional[SecretStr] = None
    PUBLIC_APP_URL: Optional[str] = None
    ALLOWED_HOSTS: str | list[str] = ""
    ALLOWED_ORIGINS: str | list[str] = ""
    PROVIDER_READINESS_TIMEOUT_SECONDS: float = 5.0
    MAX_CHAT_IMAGE_ATTACHMENTS: int = 3
    MAX_CHAT_IMAGE_UPLOAD_BYTES: int = 4 * 1024 * 1024
    MAX_CHAT_IMAGE_TOTAL_UPLOAD_BYTES: int = 8 * 1024 * 1024
    MAX_CHAT_IMAGE_WIDTH: int = 4096
    MAX_CHAT_IMAGE_HEIGHT: int = 4096
    MAX_CHAT_IMAGE_PIXELS_PER_FRAME: int = 16_000_000
    MAX_CHAT_IMAGE_TOTAL_PIXELS: int = 16_000_000
    MAX_CHAT_IMAGE_FRAMES: int = 1
    CHAT_IMAGE_ALLOWED_MIME_TYPES: str | list[str] = "image/jpeg,image/png,image/webp,image/gif"

    RATE_LIMIT_REDIS_URL: Optional[str] = None
    RATE_LIMIT_KEY_SECRET: SecretStr = SecretStr("development-rate-limit-key-secret-change-me")
    RATE_LIMIT_OPERATION_TIMEOUT_SECONDS: float = 0.25
    RATE_LIMIT_LOGIN_WINDOW_SECONDS: int = 60
    RATE_LIMIT_LOGIN_SOURCE_LIMIT: int = 10
    RATE_LIMIT_LOGIN_ACCOUNT_LIMIT: int = 5
    RATE_LIMIT_REGISTRATION_WINDOW_SECONDS: int = 3600
    RATE_LIMIT_REGISTRATION_SOURCE_LIMIT: int = 5
    RATE_LIMIT_REGISTRATION_ACCOUNT_LIMIT: int = 3
    RATE_LIMIT_SESSION_WINDOW_SECONDS: int = 60
    RATE_LIMIT_SESSION_SOURCE_LIMIT: int = 60
    RATE_LIMIT_MESSAGE_WINDOW_SECONDS: int = 60
    RATE_LIMIT_MESSAGE_SOURCE_LIMIT: int = 30
    RATE_LIMIT_MESSAGE_USER_LIMIT: int = 30
    RATE_LIMIT_IMAGE_WINDOW_SECONDS: int = 60
    RATE_LIMIT_IMAGE_SOURCE_LIMIT: int = 10
    RATE_LIMIT_IMAGE_USER_LIMIT: int = 10
    RATE_LIMIT_STORE_REGISTRATION_WINDOW_SECONDS: int = 3600
    RATE_LIMIT_STORE_REGISTRATION_SOURCE_LIMIT: int = 5
    RATE_LIMIT_STORE_REGISTRATION_ACCOUNT_LIMIT: int = 3
    RATE_LIMIT_STORE_REGISTRATION_STORE_LIMIT: int = 3
    RATE_LIMIT_STORE_VERIFICATION_WINDOW_SECONDS: int = 900
    RATE_LIMIT_STORE_VERIFICATION_SOURCE_LIMIT: int = 10
    RATE_LIMIT_STORE_MFA_WINDOW_SECONDS: int = 300
    RATE_LIMIT_STORE_MFA_SOURCE_LIMIT: int = 10
    RATE_LIMIT_STORE_MFA_USER_LIMIT: int = 5
    RATE_LIMIT_STORE_APPROVAL_WINDOW_SECONDS: int = 300
    RATE_LIMIT_STORE_APPROVAL_SOURCE_LIMIT: int = 30
    RATE_LIMIT_STORE_APPROVAL_USER_LIMIT: int = 20
    RATE_LIMIT_STORE_INVENTORY_WINDOW_SECONDS: int = 60
    RATE_LIMIT_STORE_INVENTORY_SOURCE_LIMIT: int = 30
    RATE_LIMIT_STORE_INVENTORY_USER_LIMIT: int = 20
    RATE_LIMIT_STORE_INVENTORY_STORE_LIMIT: int = 20
    TRUSTED_BFF_PROXY_HOSTS: str | list[str] = "localhost,127.0.0.1"
    TRUSTED_BFF_SOURCE_HEADER: str = "x-lookeate-client-source"

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
    IMAGE_VISUAL_SEARCH_ALLOWED_SCHEMES: str | list[str] = "http,https"
    IMAGE_VISUAL_SEARCH_ALLOWED_MIME_TYPES: str | list[str] = "image/jpeg,image/png,image/webp,image/gif"
    IMAGE_VISUAL_SEARCH_MAX_REDIRECTS: int = 3
    IMAGE_VISUAL_SEARCH_CONNECT_TIMEOUT_SECONDS: float = 1.0
    IMAGE_VISUAL_SEARCH_READ_TIMEOUT_SECONDS: float = 2.0
    IMAGE_VISUAL_SEARCH_TOTAL_TIMEOUT_SECONDS: float = 5.0

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
        self.CHAT_IMAGE_ALLOWED_MIME_TYPES = _parse_list(self.CHAT_IMAGE_ALLOWED_MIME_TYPES)
        self.TRUSTED_BFF_PROXY_HOSTS = _parse_list(self.TRUSTED_BFF_PROXY_HOSTS)
        self.STORE_APPROVER_EMAILS = [email.lower() for email in _parse_list(self.STORE_APPROVER_EMAILS)]
        self.IMAGE_VISUAL_SEARCH_ALLOWED_SCHEMES = [
            scheme.lower() for scheme in _parse_list(self.IMAGE_VISUAL_SEARCH_ALLOWED_SCHEMES)
        ]
        self.IMAGE_VISUAL_SEARCH_ALLOWED_MIME_TYPES = _parse_list(
            self.IMAGE_VISUAL_SEARCH_ALLOWED_MIME_TYPES
        )

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

        positive_values = {
            "MAX_CHAT_IMAGE_ATTACHMENTS": self.MAX_CHAT_IMAGE_ATTACHMENTS,
            "MAX_CHAT_IMAGE_UPLOAD_BYTES": self.MAX_CHAT_IMAGE_UPLOAD_BYTES,
            "MAX_CHAT_IMAGE_TOTAL_UPLOAD_BYTES": self.MAX_CHAT_IMAGE_TOTAL_UPLOAD_BYTES,
            "MAX_CHAT_IMAGE_WIDTH": self.MAX_CHAT_IMAGE_WIDTH,
            "MAX_CHAT_IMAGE_HEIGHT": self.MAX_CHAT_IMAGE_HEIGHT,
            "MAX_CHAT_IMAGE_PIXELS_PER_FRAME": self.MAX_CHAT_IMAGE_PIXELS_PER_FRAME,
            "MAX_CHAT_IMAGE_TOTAL_PIXELS": self.MAX_CHAT_IMAGE_TOTAL_PIXELS,
            "MAX_CHAT_IMAGE_FRAMES": self.MAX_CHAT_IMAGE_FRAMES,
            "RATE_LIMIT_LOGIN_WINDOW_SECONDS": self.RATE_LIMIT_LOGIN_WINDOW_SECONDS,
            "RATE_LIMIT_LOGIN_SOURCE_LIMIT": self.RATE_LIMIT_LOGIN_SOURCE_LIMIT,
            "RATE_LIMIT_LOGIN_ACCOUNT_LIMIT": self.RATE_LIMIT_LOGIN_ACCOUNT_LIMIT,
            "RATE_LIMIT_REGISTRATION_WINDOW_SECONDS": self.RATE_LIMIT_REGISTRATION_WINDOW_SECONDS,
            "RATE_LIMIT_REGISTRATION_SOURCE_LIMIT": self.RATE_LIMIT_REGISTRATION_SOURCE_LIMIT,
            "RATE_LIMIT_REGISTRATION_ACCOUNT_LIMIT": self.RATE_LIMIT_REGISTRATION_ACCOUNT_LIMIT,
            "RATE_LIMIT_SESSION_WINDOW_SECONDS": self.RATE_LIMIT_SESSION_WINDOW_SECONDS,
            "RATE_LIMIT_SESSION_SOURCE_LIMIT": self.RATE_LIMIT_SESSION_SOURCE_LIMIT,
            "RATE_LIMIT_MESSAGE_WINDOW_SECONDS": self.RATE_LIMIT_MESSAGE_WINDOW_SECONDS,
            "RATE_LIMIT_MESSAGE_SOURCE_LIMIT": self.RATE_LIMIT_MESSAGE_SOURCE_LIMIT,
            "RATE_LIMIT_MESSAGE_USER_LIMIT": self.RATE_LIMIT_MESSAGE_USER_LIMIT,
            "RATE_LIMIT_IMAGE_WINDOW_SECONDS": self.RATE_LIMIT_IMAGE_WINDOW_SECONDS,
            "RATE_LIMIT_IMAGE_SOURCE_LIMIT": self.RATE_LIMIT_IMAGE_SOURCE_LIMIT,
            "RATE_LIMIT_IMAGE_USER_LIMIT": self.RATE_LIMIT_IMAGE_USER_LIMIT,
            "STORE_TOTP_STEP_UP_MAX_AGE_SECONDS": self.STORE_TOTP_STEP_UP_MAX_AGE_SECONDS,
            "STORE_EMAIL_VERIFICATION_TTL_SECONDS": self.STORE_EMAIL_VERIFICATION_TTL_SECONDS,
            "STORE_REGISTRATION_RETENTION_DAYS": self.STORE_REGISTRATION_RETENTION_DAYS,
            "RATE_LIMIT_STORE_REGISTRATION_WINDOW_SECONDS": self.RATE_LIMIT_STORE_REGISTRATION_WINDOW_SECONDS,
            "RATE_LIMIT_STORE_REGISTRATION_SOURCE_LIMIT": self.RATE_LIMIT_STORE_REGISTRATION_SOURCE_LIMIT,
            "RATE_LIMIT_STORE_REGISTRATION_ACCOUNT_LIMIT": self.RATE_LIMIT_STORE_REGISTRATION_ACCOUNT_LIMIT,
            "RATE_LIMIT_STORE_REGISTRATION_STORE_LIMIT": self.RATE_LIMIT_STORE_REGISTRATION_STORE_LIMIT,
            "RATE_LIMIT_STORE_VERIFICATION_WINDOW_SECONDS": self.RATE_LIMIT_STORE_VERIFICATION_WINDOW_SECONDS,
            "RATE_LIMIT_STORE_VERIFICATION_SOURCE_LIMIT": self.RATE_LIMIT_STORE_VERIFICATION_SOURCE_LIMIT,
            "RATE_LIMIT_STORE_MFA_WINDOW_SECONDS": self.RATE_LIMIT_STORE_MFA_WINDOW_SECONDS,
            "RATE_LIMIT_STORE_MFA_SOURCE_LIMIT": self.RATE_LIMIT_STORE_MFA_SOURCE_LIMIT,
            "RATE_LIMIT_STORE_MFA_USER_LIMIT": self.RATE_LIMIT_STORE_MFA_USER_LIMIT,
            "RATE_LIMIT_STORE_APPROVAL_WINDOW_SECONDS": self.RATE_LIMIT_STORE_APPROVAL_WINDOW_SECONDS,
            "RATE_LIMIT_STORE_APPROVAL_SOURCE_LIMIT": self.RATE_LIMIT_STORE_APPROVAL_SOURCE_LIMIT,
            "RATE_LIMIT_STORE_APPROVAL_USER_LIMIT": self.RATE_LIMIT_STORE_APPROVAL_USER_LIMIT,
            "RATE_LIMIT_STORE_INVENTORY_WINDOW_SECONDS": self.RATE_LIMIT_STORE_INVENTORY_WINDOW_SECONDS,
            "RATE_LIMIT_STORE_INVENTORY_SOURCE_LIMIT": self.RATE_LIMIT_STORE_INVENTORY_SOURCE_LIMIT,
            "RATE_LIMIT_STORE_INVENTORY_USER_LIMIT": self.RATE_LIMIT_STORE_INVENTORY_USER_LIMIT,
            "RATE_LIMIT_STORE_INVENTORY_STORE_LIMIT": self.RATE_LIMIT_STORE_INVENTORY_STORE_LIMIT,
            "IMAGE_VISUAL_SEARCH_MAX_IMAGE_BYTES": self.IMAGE_VISUAL_SEARCH_MAX_IMAGE_BYTES,
            "IMAGE_VISUAL_SEARCH_MAX_REDIRECTS": self.IMAGE_VISUAL_SEARCH_MAX_REDIRECTS,
        }
        if any(value <= 0 for value in positive_values.values()):
            invalid_name = next(name for name, value in positive_values.items() if value <= 0)
            raise ValueError(f"{invalid_name} must be greater than zero")
        if self.MAX_CHAT_IMAGE_TOTAL_UPLOAD_BYTES < self.MAX_CHAT_IMAGE_UPLOAD_BYTES:
            raise ValueError("MAX_CHAT_IMAGE_TOTAL_UPLOAD_BYTES must not be smaller than MAX_CHAT_IMAGE_UPLOAD_BYTES")
        if self.MAX_CHAT_IMAGE_TOTAL_PIXELS < self.MAX_CHAT_IMAGE_PIXELS_PER_FRAME:
            raise ValueError("MAX_CHAT_IMAGE_TOTAL_PIXELS must not be smaller than MAX_CHAT_IMAGE_PIXELS_PER_FRAME")
        if self.RATE_LIMIT_OPERATION_TIMEOUT_SECONDS <= 0:
            raise ValueError("RATE_LIMIT_OPERATION_TIMEOUT_SECONDS must be greater than zero")
        if min(
            self.IMAGE_VISUAL_SEARCH_CONNECT_TIMEOUT_SECONDS,
            self.IMAGE_VISUAL_SEARCH_READ_TIMEOUT_SECONDS,
            self.IMAGE_VISUAL_SEARCH_TOTAL_TIMEOUT_SECONDS,
        ) <= 0:
            raise ValueError("IMAGE_VISUAL_SEARCH timeouts must be greater than zero")
        if self.IMAGE_VISUAL_SEARCH_TOTAL_TIMEOUT_SECONDS < max(
            self.IMAGE_VISUAL_SEARCH_CONNECT_TIMEOUT_SECONDS,
            self.IMAGE_VISUAL_SEARCH_READ_TIMEOUT_SECONDS,
        ):
            raise ValueError("IMAGE_VISUAL_SEARCH_TOTAL_TIMEOUT_SECONDS must cover connect and read timeouts")
        if not self.CHAT_IMAGE_ALLOWED_MIME_TYPES or not set(self.CHAT_IMAGE_ALLOWED_MIME_TYPES).issubset(_SUPPORTED_IMAGE_MIME_TYPES):
            raise ValueError("CHAT_IMAGE_ALLOWED_MIME_TYPES must contain supported image MIME types")
        if not self.IMAGE_VISUAL_SEARCH_ALLOWED_MIME_TYPES or not set(
            self.IMAGE_VISUAL_SEARCH_ALLOWED_MIME_TYPES
        ).issubset(_SUPPORTED_IMAGE_MIME_TYPES):
            raise ValueError("IMAGE_VISUAL_SEARCH_ALLOWED_MIME_TYPES must contain supported image MIME types")
        if not self.IMAGE_VISUAL_SEARCH_ALLOWED_SCHEMES or any(
            scheme not in {"http", "https"} for scheme in self.IMAGE_VISUAL_SEARCH_ALLOWED_SCHEMES
        ):
            raise ValueError("IMAGE_VISUAL_SEARCH_ALLOWED_SCHEMES must contain only http and https")
        if not self.TRUSTED_BFF_PROXY_HOSTS or any(
            not _is_explicit_host(host) for host in self.TRUSTED_BFF_PROXY_HOSTS
        ):
            raise ValueError("TRUSTED_BFF_PROXY_HOSTS must contain explicit hosts")
        if not self.TRUSTED_BFF_SOURCE_HEADER.startswith("x-"):
            raise ValueError("TRUSTED_BFF_SOURCE_HEADER must be a private x- header")
        if len(self.STORE_TOTP_ENCRYPTION_KEY.get_secret_value()) != 44:
            raise ValueError("STORE_TOTP_ENCRYPTION_KEY must be a URL-safe 32-byte key")

        if self.APP_ENV not in _DEPLOYED_ENVIRONMENTS:
            self.PUBLIC_APP_URL = self.PUBLIC_APP_URL or "http://localhost:3000"
            self.ALLOWED_HOSTS = self.ALLOWED_HOSTS or ["localhost", "127.0.0.1"]
            self.ALLOWED_ORIGINS = self.ALLOWED_ORIGINS or ["http://localhost:3000"]
            return self

        if not self.DATABASE_URL.lower().startswith("postgresql"):
            raise ValueError("DATABASE_URL must use PostgreSQL in staging and production")

        if not self.RATE_LIMIT_REDIS_URL or not self.RATE_LIMIT_REDIS_URL.lower().startswith(("redis://", "rediss://")):
            raise ValueError("RATE_LIMIT_REDIS_URL must use Redis in staging and production")
        if not self.STORE_APPROVER_EMAILS:
            raise ValueError("STORE_APPROVER_EMAILS is required in staging and production")
        if not self.STORE_EMAIL_WEBHOOK_URL or not _is_https_origin(self.STORE_EMAIL_WEBHOOK_URL):
            raise ValueError("STORE_EMAIL_WEBHOOK_URL must be an HTTPS origin in staging and production")
        if not self.STORE_EMAIL_WEBHOOK_TOKEN:
            raise ValueError("STORE_EMAIL_WEBHOOK_TOKEN is required in staging and production")
        if self.STORE_TOTP_ENCRYPTION_KEY.get_secret_value() == "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=":
            raise ValueError("STORE_TOTP_ENCRYPTION_KEY must not use the local/test value in staging and production")
        if self.STORE_EMAIL_VERIFICATION_MOCKED:
            raise ValueError("STORE_EMAIL_VERIFICATION_MOCKED must be false in staging and production")
        rate_key_secret = self.RATE_LIMIT_KEY_SECRET.get_secret_value()
        normalized_rate_key_secret = rate_key_secret.strip().lower()
        if len(rate_key_secret) < 32:
            raise ValueError("RATE_LIMIT_KEY_SECRET must be at least 32 characters in staging and production")
        if normalized_rate_key_secret in _KNOWN_AUTH_SECRETS or any(
            marker in normalized_rate_key_secret for marker in _PLACEHOLDER_SECRET_PARTS
        ):
            raise ValueError("RATE_LIMIT_KEY_SECRET must not be a known or placeholder value")

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
