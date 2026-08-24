from __future__ import annotations

import asyncio
import hashlib
import hmac
import logging
import math
import time
from collections import Counter
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from threading import Lock
from typing import Protocol

from core.settings import Settings, settings


logger = logging.getLogger(__name__)
_OUTCOME_COUNTS: Counter[tuple[str, str]] = Counter()
_OUTCOME_COUNTS_LOCK = Lock()


class RateLimitUnavailable(Exception):
    """The required shared limiter could not evaluate a protected request."""


@dataclass(frozen=True)
class RateLimitDimension:
    name: str
    limit: int


@dataclass(frozen=True)
class RateLimitPolicy:
    name: str
    window_seconds: int
    dimensions: tuple[RateLimitDimension, ...]


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    retry_after_seconds: int = 0


class RateLimiter(Protocol):
    async def evaluate(self, policy: RateLimitPolicy, key_values: Sequence[str]) -> RateLimitResult: ...

    async def ready(self) -> None: ...


def record_rate_limit_outcome(policy_name: str, outcome: str) -> None:
    with _OUTCOME_COUNTS_LOCK:
        _OUTCOME_COUNTS[(policy_name, outcome)] += 1
        count = _OUTCOME_COUNTS[(policy_name, outcome)]
    if outcome != "allowed":
        logger.warning(
            "Rate-limit evaluation policy=%s outcome=%s count=%s",
            policy_name,
            outcome,
            count,
        )


def rate_limit_outcome_counts() -> dict[tuple[str, str], int]:
    with _OUTCOME_COUNTS_LOCK:
        return dict(_OUTCOME_COUNTS)


def policy_for(name: str, configured: Settings = settings) -> RateLimitPolicy:
    policies = {
        "login": RateLimitPolicy(
            "login", configured.RATE_LIMIT_LOGIN_WINDOW_SECONDS,
            (RateLimitDimension("source", configured.RATE_LIMIT_LOGIN_SOURCE_LIMIT), RateLimitDimension("account", configured.RATE_LIMIT_LOGIN_ACCOUNT_LIMIT)),
        ),
        "registration": RateLimitPolicy(
            "registration", configured.RATE_LIMIT_REGISTRATION_WINDOW_SECONDS,
            (RateLimitDimension("source", configured.RATE_LIMIT_REGISTRATION_SOURCE_LIMIT), RateLimitDimension("account", configured.RATE_LIMIT_REGISTRATION_ACCOUNT_LIMIT)),
        ),
        "session": RateLimitPolicy(
            "session", configured.RATE_LIMIT_SESSION_WINDOW_SECONDS,
            (RateLimitDimension("source", configured.RATE_LIMIT_SESSION_SOURCE_LIMIT),),
        ),
        "message": RateLimitPolicy(
            "message", configured.RATE_LIMIT_MESSAGE_WINDOW_SECONDS,
            (RateLimitDimension("source", configured.RATE_LIMIT_MESSAGE_SOURCE_LIMIT), RateLimitDimension("user", configured.RATE_LIMIT_MESSAGE_USER_LIMIT)),
        ),
        "image": RateLimitPolicy(
            "image", configured.RATE_LIMIT_IMAGE_WINDOW_SECONDS,
            (RateLimitDimension("source", configured.RATE_LIMIT_IMAGE_SOURCE_LIMIT), RateLimitDimension("user", configured.RATE_LIMIT_IMAGE_USER_LIMIT)),
        ),
    }
    return policies[name]


class InMemoryRateLimiter:
    """Deterministic local/test implementation shared by injected workers."""

    def __init__(self, now: Callable[[], float] = time.monotonic):
        self._now = now
        self._buckets: dict[str, tuple[int, float]] = {}
        self._lock = asyncio.Lock()

    async def evaluate(self, policy: RateLimitPolicy, key_values: Sequence[str]) -> RateLimitResult:
        if len(key_values) != len(policy.dimensions):
            raise ValueError("Rate-limit key dimensions do not match the policy")
        now = self._now()
        keys = [_storage_key(policy, dimension, key) for dimension, key in zip(policy.dimensions, key_values)]
        async with self._lock:
            buckets = [self._bucket(key, now, policy.window_seconds) for key in keys]
            denied = [bucket for bucket, dimension in zip(buckets, policy.dimensions) if bucket[0] >= dimension.limit]
            if denied:
                retry_after = min(policy.window_seconds, max(1, math.ceil(max(reset - now for _, reset in denied))))
                return RateLimitResult(False, retry_after)
            for key, (count, reset) in zip(keys, buckets):
                self._buckets[key] = (count + 1, reset)
        return RateLimitResult(True)

    async def ready(self) -> None:
        return None

    def _bucket(self, key: str, now: float, window_seconds: int) -> tuple[int, float]:
        count, reset = self._buckets.get(key, (0, now + window_seconds))
        if now >= reset:
            return 0, now + window_seconds
        return count, reset


class RedisRateLimiter:
    _SCRIPT = """
local retry = 0
for index, key in ipairs(KEYS) do
  local current = tonumber(redis.call('GET', key) or '0')
  local limit = tonumber(ARGV[index])
  if current >= limit then
    retry = math.max(retry, redis.call('PTTL', key))
  end
end
if retry > 0 then
  return {0, retry}
end
for index, key in ipairs(KEYS) do
  local value = redis.call('INCR', key)
  if value == 1 then
    redis.call('PEXPIRE', key, ARGV[#KEYS + 1])
  end
end
return {1, 0}
"""

    def __init__(self, redis_url: str, timeout_seconds: float):
        try:
            from redis.asyncio import Redis
        except ImportError as exc:  # pragma: no cover - dependency contract guard
            raise RuntimeError("The Redis rate-limit dependency is not installed") from exc
        self._client = Redis.from_url(
            redis_url,
            socket_connect_timeout=timeout_seconds,
            socket_timeout=timeout_seconds,
            decode_responses=False,
        )
        self._timeout_seconds = timeout_seconds

    async def evaluate(self, policy: RateLimitPolicy, key_values: Sequence[str]) -> RateLimitResult:
        if len(key_values) != len(policy.dimensions):
            raise ValueError("Rate-limit key dimensions do not match the policy")
        keys = [_storage_key(policy, dimension, key) for dimension, key in zip(policy.dimensions, key_values)]
        try:
            raw_result = await asyncio.wait_for(
                self._client.eval(
                    self._SCRIPT,
                    len(keys),
                    *keys,
                    *(dimension.limit for dimension in policy.dimensions),
                    policy.window_seconds * 1000,
                ),
                timeout=self._timeout_seconds,
            )
        except Exception as exc:
            raise RateLimitUnavailable from exc
        allowed, retry_milliseconds = (int(value) for value in raw_result)
        return RateLimitResult(
            bool(allowed),
            min(policy.window_seconds, max(1, math.ceil(retry_milliseconds / 1000))) if not allowed else 0,
        )

    async def ready(self) -> None:
        try:
            await asyncio.wait_for(self._client.ping(), timeout=self._timeout_seconds)
        except Exception as exc:
            raise RateLimitUnavailable from exc


def create_rate_limiter(configured: Settings = settings) -> RateLimiter:
    if configured.APP_ENV in {"staging", "production"}:
        if not configured.RATE_LIMIT_REDIS_URL:
            raise RuntimeError("A shared rate limiter is required in staging and production")
        return RedisRateLimiter(configured.RATE_LIMIT_REDIS_URL, configured.RATE_LIMIT_OPERATION_TIMEOUT_SECONDS)
    return InMemoryRateLimiter()


def pseudonymous_key(value: str, configured: Settings = settings) -> str:
    return hmac.new(
        configured.RATE_LIMIT_KEY_SECRET.get_secret_value().encode("utf-8"),
        value.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _storage_key(policy: RateLimitPolicy, dimension: RateLimitDimension, value: str) -> str:
    return f"lookeate:rate:{policy.name}:{dimension.name}:{value}"
