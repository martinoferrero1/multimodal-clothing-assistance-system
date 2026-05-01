from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from infra.db.chat_models import ChatUser
from infra.db.database import Database
from services.auth_service import AuthenticationService
from services.conversation_service import ConversationService
from services.conversation_runtime_service import ConversationRuntimeService
from sqlalchemy.ext.asyncio import AsyncSession


bearer_scheme = HTTPBearer(auto_error=False)


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


async def get_current_user(
    session: AsyncSession = Depends(get_db_session),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    auth_service: AuthenticationService = Depends(get_auth_service),
) -> ChatUser:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await auth_service.authenticate_user(session, credentials.credentials)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
