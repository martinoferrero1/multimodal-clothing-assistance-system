from __future__ import annotations

from api.dependencies import get_db_session
from api.route_helpers import serialize_conversation
from api.schemas import ConversationCreate, ConversationRead, UserCreate, UserRead
from fastapi import APIRouter, Depends, HTTPException, status
from infra.db.chat_models import ChatUser, Conversation
from sqlalchemy import select
from sqlalchemy.orm import Session


router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, session: Session = Depends(get_db_session)) -> ChatUser:
    user = ChatUser(
        display_name=payload.display_name.strip(),
        email=str(payload.email).lower() if payload.email else None,
    )
    session.add(user)
    try:
        session.commit()
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=400, detail="Could not create user.") from exc
    session.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: str, session: Session = Depends(get_db_session)) -> ChatUser:
    user = session.get(ChatUser, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


@router.post(
    "/{user_id}/conversations",
    response_model=ConversationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_conversation(
    user_id: str,
    payload: ConversationCreate,
    session: Session = Depends(get_db_session),
) -> ConversationRead:
    user = session.get(ChatUser, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    conversation = Conversation(
        user_id=user_id,
        title=(payload.title or "New conversation").strip() or "New conversation",
    )
    session.add(conversation)
    session.commit()
    session.refresh(conversation)
    return serialize_conversation(session, conversation)


@router.get("/{user_id}/conversations", response_model=list[ConversationRead])
def list_user_conversations(user_id: str, session: Session = Depends(get_db_session)) -> list[ConversationRead]:
    user = session.get(ChatUser, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    query = (
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc(), Conversation.created_at.desc())
    )
    conversations = list(session.scalars(query).all())
    return [serialize_conversation(session, conversation) for conversation in conversations]
