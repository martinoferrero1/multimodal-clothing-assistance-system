from __future__ import annotations

import json
from typing import Iterator

from api.schemas import ConversationRead
from infra.db.chat_models import ChatMessage, Conversation
from sqlalchemy import select
from sqlalchemy.orm import Session


def serialize_conversation(session: Session, conversation: Conversation) -> ConversationRead:
    query = (
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conversation.id)
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
    )
    messages = list(session.scalars(query).all())
    last_message = messages[0] if messages else None
    last_preview = None
    if last_message is not None:
        compact = " ".join(last_message.content.split())
        last_preview = compact if len(compact) <= 80 else f"{compact[:77].rstrip()}..."

    return ConversationRead(
        id=conversation.id,
        user_id=conversation.user_id,
        title=conversation.title,
        summary=conversation.summary,
        message_count=len(messages),
        last_message_preview=last_preview,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
    )


def chunk_text(content: str, chunk_size: int = 120) -> Iterator[str]:
    if not content:
        return
    for index in range(0, len(content), chunk_size):
        yield content[index:index + chunk_size]


def sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
