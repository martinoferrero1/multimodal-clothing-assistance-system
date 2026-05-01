from __future__ import annotations

from api.dependencies import (
    get_auth_service,
    get_conversation_service,
    get_current_user,
    get_db_session,
)
from api.schemas import ConversationCreate, ConversationRead, UserRead
from fastapi import APIRouter, Depends, status
from infra.db.chat_models import ChatUser
from services.auth_service import AuthenticationService
from services.conversation_service import ConversationService
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/me", response_model=UserRead)
async def get_me(current_user: ChatUser = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: str,
    current_user: ChatUser = Depends(get_current_user),
    auth_service: AuthenticationService = Depends(get_auth_service),
) -> UserRead:
    auth_service.ensure_same_user(current_user.id, user_id)
    return UserRead.model_validate(current_user)


@router.post(
    "/me/conversations",
    response_model=ConversationRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    payload: ConversationCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user: ChatUser = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> ConversationRead:
    return await conversation_service.create_conversation(session, current_user.id, payload)


@router.get("/me/conversations", response_model=list[ConversationRead])
async def list_user_conversations(
    session: AsyncSession = Depends(get_db_session),
    current_user: ChatUser = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> list[ConversationRead]:
    return await conversation_service.list_user_conversations(session, current_user.id)
