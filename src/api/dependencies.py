from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from api.session_cookies import session_cookie_deletion_header
from core.settings import settings
from fastapi import Depends, HTTPException, Request, status
from infra.db.database import Database
from infra.db.models.chat_models import ChatUser
from services.auth_service import AuthenticationService, CurrentSession
from services.store_service import CommercialContext, StoreService
from services.conversation_runtime_service import ConversationRuntimeService
from services.conversation_service import ConversationService
from services.rate_limit_service import (
    RateLimitUnavailable,
    RateLimiter,
    create_rate_limiter,
    policy_for,
    pseudonymous_key,
    record_rate_limit_outcome,
)
from sqlalchemy.ext.asyncio import AsyncSession


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    async with Database().get_async_session() as session:
        yield session


async def get_db_session() -> AsyncIterator[AsyncSession]:
    async with session_scope() as session:
        yield session


def get_chat_runtime(request: Request) -> ConversationRuntimeService:
    return request.app.state.chat_runtime


def get_auth_service() -> AuthenticationService:
    return AuthenticationService()


def get_conversation_service() -> ConversationService:
    return ConversationService()


def get_rate_limiter(request: Request) -> RateLimiter:
    limiter = getattr(request.app.state, "rate_limiter", None)
    if limiter is None:
        limiter = create_rate_limiter()
        request.app.state.rate_limiter = limiter
    return limiter


def request_source_key(request: Request) -> str:
    peer = request.client.host if request.client else "unknown"
    private_source = request.headers.get(settings.TRUSTED_BFF_SOURCE_HEADER)
    if private_source and peer in settings.TRUSTED_BFF_PROXY_HOSTS:
        peer = private_source.strip()[:128] or peer
    return pseudonymous_key(f"source:{peer}")


async def enforce_rate_limit(
    request: Request,
    policy_name: str,
    *,
    account: str | None = None,
    store: str | None = None,
    user_id: str | None = None,
    limiter: RateLimiter | None = None,
) -> None:
    policy = policy_for(policy_name)
    values: list[str] = []
    for dimension in policy.dimensions:
        if dimension.name == "source":
            values.append(request_source_key(request))
        elif dimension.name == "account":
            values.append(pseudonymous_key(f"account:{(account or '').strip().lower()}"))
        elif dimension.name == "user":
            values.append(pseudonymous_key(f"user:{user_id or ''}"))
        elif dimension.name == "store":
            values.append(pseudonymous_key(f"store:{(store or '').strip().lower()}"))
        else:  # pragma: no cover - guards future policy additions
            raise ValueError("Unsupported rate-limit dimension")
    try:
        result = await (limiter or get_rate_limiter(request)).evaluate(policy, values)
    except RateLimitUnavailable:
        record_rate_limit_outcome(policy_name, "unavailable")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Service temporarily unavailable.")
    if not result.allowed:
        record_rate_limit_outcome(policy_name, "rejected")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(result.retry_after_seconds)},
        )
    record_rate_limit_outcome(policy_name, "allowed")


def _unauthenticated(clear_cookie: bool = False) -> HTTPException:
    headers = {"set-cookie": session_cookie_deletion_header()} if clear_cookie else None
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.", headers=headers)


async def get_current_session(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    auth_service: AuthenticationService = Depends(get_auth_service),
) -> CurrentSession:
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    current = await auth_service.resolve_session(session, token)
    if current is None:
        raise _unauthenticated(clear_cookie=token is not None)
    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and not auth_service.csrf_token_is_valid(
        current, request.headers.get("X-CSRF-Token")
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Request validation failed.")
    return current


async def get_rate_limited_current_session(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    auth_service: AuthenticationService = Depends(get_auth_service),
) -> CurrentSession:
    await enforce_rate_limit(request, "session")
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    current = await auth_service.resolve_session(session, token)
    if current is None:
        raise _unauthenticated(clear_cookie=token is not None)
    return current


async def get_current_user(current: CurrentSession = Depends(get_current_session)) -> ChatUser:
    return current.user


async def get_commercial_context(
    current: CurrentSession = Depends(get_current_session),
    session: AsyncSession = Depends(get_db_session),
) -> CommercialContext:
    return await StoreService().commercial_context(session, current)
