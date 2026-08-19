from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from api.session_cookies import session_cookie_deletion_header
from core.settings import settings
from fastapi import Depends, HTTPException, Request, status
from infra.db.database import Database
from infra.db.models.chat_models import ChatUser
from services.auth_service import AuthenticationService, CurrentSession
from services.conversation_runtime_service import ConversationRuntimeService
from services.conversation_service import ConversationService
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


async def get_current_user(current: CurrentSession = Depends(get_current_session)) -> ChatUser:
    return current.user
