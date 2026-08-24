from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from starlette.requests import Request

from api.dependencies import enforce_rate_limit, request_source_key
from services.rate_limit_service import (
    InMemoryRateLimiter,
    RateLimitDimension,
    RateLimitPolicy,
    RateLimitUnavailable,
    RedisRateLimiter,
    pseudonymous_key,
)


def test_in_memory_limiter_atomically_consumes_multiple_dimensions() -> None:
    clock = [0.0]
    limiter = InMemoryRateLimiter(now=lambda: clock[0])
    policy = RateLimitPolicy(
        "message",
        60,
        (RateLimitDimension("source", 2), RateLimitDimension("account", 1)),
    )

    async def evaluate():
        assert (await limiter.evaluate(policy, ["source-a", "account-a"])).allowed
        rejected = await limiter.evaluate(policy, ["source-a", "account-a"])
        assert not rejected.allowed
        assert rejected.retry_after_seconds == 60
        # The rejected multi-key request must not consume the source dimension.
        assert (await limiter.evaluate(policy, ["source-a", "account-b"])).allowed
        assert not (await limiter.evaluate(policy, ["source-a", "account-c"])).allowed

    asyncio.run(evaluate())


def test_in_memory_limiter_recovers_with_an_injected_clock() -> None:
    clock = [0.0]
    limiter = InMemoryRateLimiter(now=lambda: clock[0])
    policy = RateLimitPolicy("login", 10, (RateLimitDimension("source", 1),))

    async def evaluate():
        assert (await limiter.evaluate(policy, ["source-a"])).allowed
        assert not (await limiter.evaluate(policy, ["source-a"])).allowed
        clock[0] = 10.0
        assert (await limiter.evaluate(policy, ["source-a"])).allowed

    asyncio.run(evaluate())


def test_simulated_workers_share_the_same_in_memory_state() -> None:
    limiter = InMemoryRateLimiter()
    policy = RateLimitPolicy("session", 60, (RateLimitDimension("source", 1),))

    async def evaluate():
        first, second = await asyncio.gather(
            limiter.evaluate(policy, ["source-a"]),
            limiter.evaluate(policy, ["source-a"]),
        )
        assert sorted([first.allowed, second.allowed]) == [False, True]

    asyncio.run(evaluate())


def test_independent_redis_limiters_share_fake_store_state(monkeypatch) -> None:
    shared_counts: dict[str, int] = {}
    clients: list[object] = []

    class FakeRedis:
        async def eval(self, script, key_count, *arguments):
            keys = arguments[:key_count]
            limits = [int(value) for value in arguments[key_count : key_count * 2]]
            ttl_milliseconds = int(arguments[-1])
            if any(shared_counts.get(key, 0) >= limit for key, limit in zip(keys, limits)):
                return [0, ttl_milliseconds]
            for key in keys:
                shared_counts[key] = shared_counts.get(key, 0) + 1
            return [1, 0]

    def fake_from_url(*args, **kwargs):
        client = FakeRedis()
        clients.append(client)
        return client

    monkeypatch.setattr("redis.asyncio.Redis.from_url", fake_from_url)
    worker_a = RedisRateLimiter("redis://shared.example/0", 0.1)
    worker_b = RedisRateLimiter("redis://shared.example/0", 0.1)
    policy = RateLimitPolicy("login", 60, (RateLimitDimension("source", 1),))

    async def evaluate():
        assert (await worker_a.evaluate(policy, ["source-a"])).allowed
        rejected = await worker_b.evaluate(policy, ["source-a"])
        assert not rejected.allowed
        assert rejected.retry_after_seconds == 60

    asyncio.run(evaluate())
    assert len(clients) == 2
    assert clients[0] is not clients[1]


@pytest.mark.parametrize("operation", ["evaluate", "ready"])
def test_redis_limiter_converts_store_failures_to_unavailable(operation: str) -> None:
    class FailingRedis:
        async def eval(self, *args, **kwargs):
            raise ConnectionError("store unavailable")

        async def ping(self):
            raise ConnectionError("store unavailable")

    limiter = RedisRateLimiter.__new__(RedisRateLimiter)
    limiter._client = FailingRedis()
    limiter._timeout_seconds = 0.1
    policy = RateLimitPolicy("login", 60, (RateLimitDimension("source", 1),))

    async def exercise():
        if operation == "evaluate":
            await limiter.evaluate(policy, ["source-a"])
        else:
            await limiter.ready()

    with pytest.raises(RateLimitUnavailable):
        asyncio.run(exercise())


def test_account_and_source_dimensions_resist_rotation_and_hide_identifiers() -> None:
    evaluations: list[tuple[str, ...]] = []

    class RecordingLimiter:
        async def evaluate(self, policy, key_values):
            evaluations.append(tuple(key_values))
            return SimpleNamespace(allowed=True, retry_after_seconds=0)

    def request(source: str) -> Request:
        return Request(
            {
                "type": "http",
                "method": "POST",
                "path": "/api/auth/login",
                "headers": [],
                "client": (source, 1234),
                "app": SimpleNamespace(state=SimpleNamespace()),
            }
        )

    async def evaluate():
        limiter = RecordingLimiter()
        await enforce_rate_limit(
            request("198.51.100.10"),
            "login",
            account=" User@Example.COM ",
            limiter=limiter,
        )
        await enforce_rate_limit(
            request("198.51.100.11"),
            "login",
            account="user@example.com",
            limiter=limiter,
        )
        await enforce_rate_limit(
            request("198.51.100.10"),
            "login",
            account="other@example.com",
            limiter=limiter,
        )

    asyncio.run(evaluate())
    first, rotated_source, rotated_account = evaluations
    assert first[0] != rotated_source[0]
    assert first[1] == rotated_source[1]
    assert first[0] == rotated_account[0]
    assert first[1] != rotated_account[1]
    assert all(len(value) == 64 for evaluation in evaluations for value in evaluation)
    assert all("example.com" not in value for evaluation in evaluations for value in evaluation)


def test_source_key_ignores_spoofed_forwarding_headers_from_untrusted_peers() -> None:
    def request(source: str, headers: list[tuple[bytes, bytes]]) -> Request:
        return Request(
            {
                "type": "http",
                "method": "POST",
                "path": "/",
                "headers": headers,
                "client": (source, 1234),
            }
        )

    untrusted = request(
        "203.0.113.8",
        [
            (b"x-lookeate-client-source", b"198.51.100.20"),
            (b"x-forwarded-for", b"198.51.100.21"),
            (b"forwarded", b"for=198.51.100.22"),
        ],
    )
    trusted_without_private_header = request(
        "127.0.0.1",
        [(b"x-forwarded-for", b"198.51.100.23")],
    )
    trusted_private_header = request(
        "127.0.0.1",
        [(b"x-lookeate-client-source", b"198.51.100.24")],
    )

    assert request_source_key(untrusted) == pseudonymous_key("source:203.0.113.8")
    assert request_source_key(trusted_without_private_header) == pseudonymous_key("source:127.0.0.1")
    assert request_source_key(trusted_private_header) == pseudonymous_key("source:198.51.100.24")


@pytest.mark.parametrize("key_values", [[], ["source", "extra"]])
def test_limiter_rejects_policy_dimension_mismatches(key_values: list[str]) -> None:
    policy = RateLimitPolicy("login", 60, (RateLimitDimension("source", 1),))

    with pytest.raises(ValueError, match="dimensions"):
        asyncio.run(InMemoryRateLimiter().evaluate(policy, key_values))
