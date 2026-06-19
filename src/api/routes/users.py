from __future__ import annotations

from api.dependencies import (
    get_auth_service,
    get_conversation_service,
    get_current_user,
    get_db_session,
)
from api.schemas import (
    ConversationCreate,
    ConversationRead,
    SearchPreferencesRead,
    SearchPreferencesUpdate,
    UserRead,
)
from fastapi import APIRouter, Depends, status
from infra.db.models.chat_models import ChatUser
from services.auth_service import AuthenticationService
from services.conversation_service import ConversationService
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/me", response_model=UserRead)
async def get_me(
    current_user: ChatUser = Depends(get_current_user),
    auth_service: AuthenticationService = Depends(get_auth_service),
) -> UserRead:
    return auth_service.build_user_read(current_user)


@router.put("/me/search-preferences", response_model=SearchPreferencesRead)
async def update_me_search_preferences(
    payload: SearchPreferencesUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user: ChatUser = Depends(get_current_user),
    auth_service: AuthenticationService = Depends(get_auth_service),
) -> SearchPreferencesRead:
    return await auth_service.update_user_search_preferences(session, current_user, payload)


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: str,
    current_user: ChatUser = Depends(get_current_user),
    auth_service: AuthenticationService = Depends(get_auth_service),
) -> UserRead:
    auth_service.ensure_same_user(current_user.id, user_id)
    return auth_service.build_user_read(current_user)


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

@router.delete("/me/conversations")
async def delete_all_user_conversations(
    session: AsyncSession = Depends(get_db_session),
    current_user: ChatUser = Depends(get_current_user),
    conversation_service: ConversationService = Depends(get_conversation_service),
):
    await conversation_service.delete_all_user_conversations(session, current_user.id)
    return {"detail": "All conversations deleted successfully"}
