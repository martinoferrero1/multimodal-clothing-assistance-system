from __future__ import annotations

import logging
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request

from api.app import protect_unsafe_browser_requests
from api.dependencies import (
    get_auth_service,
    get_conversation_service,
    get_current_user,
    get_db_session,
)
from api.routes.auth import router as auth_router
from api.routes.conversations import router as conversations_router
from services.rate_limit_service import RateLimitResult, RateLimitUnavailable, rate_limit_outcome_counts


SAME_ORIGIN_HEADERS = {
    "origin": "http://localhost:3000",
    "sec-fetch-site": "same-origin",
}
LOGIN_BODY = {"email": "person@example.com", "password": "password123"}


class RecordingLimiter:
    def __init__(self, results: list[RateLimitResult] | None = None):
        self.results = list(results or [RateLimitResult(False, 17)])
        self.calls: list[str] = []

    async def evaluate(self, policy, key_values):
        self.calls.append(policy.name)
        return self.results.pop(0) if len(self.results) > 1 else self.results[0]


class FailingLimiter:
    def __init__(self):
        self.calls = 0

    async def evaluate(self, policy, key_values):
        self.calls += 1
        raise RateLimitUnavailable


class ForbiddenOperations:
    def __init__(self):
        self.calls: list[str] = []

    async def register_user(self, *args, **kwargs):
        self.calls.append("register")
        pytest.fail("registration must not run after rate-limit rejection")

    async def login_user(self, *args, **kwargs):
        self.calls.append("login")
        pytest.fail("authentication must not run after rate-limit rejection")

    async def resolve_session(self, *args, **kwargs):
        self.calls.append("session")
        pytest.fail("session lookup must not run after rate-limit rejection")

    async def create_message_turn(self, *args, **kwargs):
        self.calls.append("message")
        pytest.fail("conversation work must not run after rate-limit rejection")


@pytest.fixture
def app() -> FastAPI:
    test_app = FastAPI()
    test_app.middleware("http")(protect_unsafe_browser_requests)
    test_app.include_router(auth_router)
    test_app.include_router(conversations_router)

    async def fake_session():
        yield object()

    test_app.dependency_overrides[get_db_session] = fake_session
    test_app.state.chat_runtime = object()
    return test_app


def test_known_and_unknown_accounts_receive_stable_429_contract(app: FastAPI) -> None:
    limiter = RecordingLimiter()
    auth = ForbiddenOperations()
    app.state.rate_limiter = limiter
    app.dependency_overrides[get_auth_service] = lambda: auth

    with TestClient(app) as client:
        known = client.post(
            "/api/auth/login",
            headers=SAME_ORIGIN_HEADERS,
            json={**LOGIN_BODY, "email": "known@example.com"},
        )
        unknown = client.post(
            "/api/auth/login",
            headers=SAME_ORIGIN_HEADERS,
            json={**LOGIN_BODY, "email": "unknown@example.com"},
        )

    assert known.status_code == unknown.status_code == 429
    assert known.json() == unknown.json() == {
        "detail": "Too many requests. Please try again later."
    }
    assert known.headers["retry-after"] == unknown.headers["retry-after"] == "17"
    assert auth.calls == []


@pytest.mark.parametrize(
    ("path", "body", "policy"),
    [
        ("/api/auth/login", LOGIN_BODY, "login"),
        (
            "/api/auth/register",
            {**LOGIN_BODY, "display_name": "Person"},
            "registration",
        ),
    ],
)
def test_auth_rejection_precedes_password_work_and_writes(
    app: FastAPI,
    path: str,
    body: dict[str, str],
    policy: str,
) -> None:
    limiter = RecordingLimiter()
    operations = ForbiddenOperations()
    app.state.rate_limiter = limiter
    app.dependency_overrides[get_auth_service] = lambda: operations

    response = TestClient(app).post(path, headers=SAME_ORIGIN_HEADERS, json=body)

    assert response.status_code == 429
    assert limiter.calls == [policy]
    assert operations.calls == []


def test_session_rejection_precedes_database_lookup(app: FastAPI) -> None:
    limiter = RecordingLimiter()
    operations = ForbiddenOperations()
    app.state.rate_limiter = limiter
    app.dependency_overrides[get_auth_service] = lambda: operations

    response = TestClient(app).get(
        "/api/auth/session",
        headers={"cookie": "lookeate_session=opaque-token"},
    )

    assert response.status_code == 429
    assert limiter.calls == ["session"]
    assert operations.calls == []


@pytest.mark.parametrize(
    ("path", "body"),
    [
        ("/api/conversations/conversation-a/messages", {"content": "hello"}),
        ("/api/conversations/conversation-a/messages/stream", {"content": "hello"}),
    ],
)
def test_message_rejection_precedes_provider_and_conversation_work(
    app: FastAPI,
    path: str,
    body: dict[str, str],
) -> None:
    limiter = RecordingLimiter()
    operations = ForbiddenOperations()
    app.state.rate_limiter = limiter
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="server-user")
    app.dependency_overrides[get_conversation_service] = lambda: operations

    response = TestClient(app).post(path, headers=SAME_ORIGIN_HEADERS, json=body)

    assert response.status_code == 429
    assert limiter.calls == ["message"]
    assert operations.calls == []


def test_image_rejection_precedes_multipart_read_and_conversation_work(
    app: FastAPI,
    monkeypatch,
) -> None:
    limiter = RecordingLimiter([RateLimitResult(True), RateLimitResult(False, 23)])
    operations = ForbiddenOperations()
    form_calls = 0

    async def forbidden_form(self):
        nonlocal form_calls
        form_calls += 1
        pytest.fail("multipart body must not be parsed after image-budget rejection")

    monkeypatch.setattr(Request, "form", forbidden_form)
    app.state.rate_limiter = limiter
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="server-user")
    app.dependency_overrides[get_conversation_service] = lambda: operations

    response = TestClient(app).post(
        "/api/conversations/conversation-a/messages/with-images",
        headers={**SAME_ORIGIN_HEADERS, "content-type": "multipart/form-data; boundary=broken"},
        content=b"this body must not be parsed",
    )

    assert response.status_code == 429
    assert response.headers["retry-after"] == "23"
    assert limiter.calls == ["message", "image"]
    assert form_calls == 0
    assert operations.calls == []


def test_limiter_failure_returns_503_without_protected_work(app: FastAPI) -> None:
    limiter = FailingLimiter()
    operations = ForbiddenOperations()
    app.state.rate_limiter = limiter
    app.dependency_overrides[get_auth_service] = lambda: operations

    response = TestClient(app).post(
        "/api/auth/login",
        headers=SAME_ORIGIN_HEADERS,
        json=LOGIN_BODY,
    )

    assert response.status_code == 503
    assert response.json() == {"detail": "Service temporarily unavailable."}
    assert "retry-after" not in response.headers
    assert limiter.calls == 1
    assert operations.calls == []


def test_limiter_diagnostics_count_categories_without_sensitive_values(
    app: FastAPI,
    caplog,
) -> None:
    limiter = RecordingLimiter()
    operations = ForbiddenOperations()
    app.state.rate_limiter = limiter
    app.dependency_overrides[get_auth_service] = lambda: operations
    before = rate_limit_outcome_counts().get(("login", "rejected"), 0)

    with caplog.at_level(logging.WARNING, logger="services.rate_limit_service"):
        response = TestClient(app).post(
            "/api/auth/login",
            headers={**SAME_ORIGIN_HEADERS, "cookie": "lookeate_session=secret-cookie"},
            json={**LOGIN_BODY, "email": "sensitive-account@example.com"},
        )

    assert response.status_code == 429
    assert rate_limit_outcome_counts()[("login", "rejected")] == before + 1
    assert "policy=login outcome=rejected" in caplog.text
    assert "sensitive-account" not in caplog.text
    assert "secret-cookie" not in caplog.text


@pytest.mark.parametrize(
    "headers",
    [
        {"origin": "https://attacker.example", "sec-fetch-site": "same-origin"},
        {"origin": "http://localhost:3000", "sec-fetch-site": "cross-site"},
    ],
)
def test_origin_and_fetch_metadata_reject_before_rate_limit(
    app: FastAPI,
    headers: dict[str, str],
) -> None:
    limiter = RecordingLimiter()
    app.state.rate_limiter = limiter

    response = TestClient(app).post(
        "/api/auth/login",
        headers=headers,
        json=LOGIN_BODY,
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Request origin is not allowed."}
    assert limiter.calls == []


def test_csrf_rejection_remains_authoritative_before_assistant_limit(app: FastAPI) -> None:
    limiter = RecordingLimiter([RateLimitResult(True)])

    class InvalidCsrfAuth:
        async def resolve_session(self, session, token):
            return SimpleNamespace(
                user=SimpleNamespace(id="server-user"),
                session=object(),
            )

        def csrf_token_is_valid(self, current, token):
            return False

    app.state.rate_limiter = limiter
    app.dependency_overrides[get_auth_service] = InvalidCsrfAuth

    response = TestClient(app).post(
        "/api/conversations/conversation-a/messages",
        headers={**SAME_ORIGIN_HEADERS, "cookie": "lookeate_session=opaque-token"},
        json={"content": "hello"},
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Request validation failed."}
    assert limiter.calls == []


def test_allowed_request_preserves_server_derived_ownership_check(app: FastAPI) -> None:
    limiter = RecordingLimiter([RateLimitResult(True)])
    calls: list[tuple[str, str]] = []

    class OwnershipCheckingService:
        async def create_message_turn(self, *, user_id, conversation_id, **kwargs):
            calls.append((user_id, conversation_id))
            raise HTTPException(status_code=403, detail="Conversation access denied.")

    app.state.rate_limiter = limiter
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="server-user")
    app.dependency_overrides[get_conversation_service] = OwnershipCheckingService

    response = TestClient(app).post(
        "/api/conversations/someone-elses-conversation/messages",
        headers=SAME_ORIGIN_HEADERS,
        json={"content": "hello", "user_id": "attacker-selected-user"},
    )

    assert response.status_code == 403
    assert limiter.calls == ["message"]
    assert calls == [("server-user", "someone-elses-conversation")]
