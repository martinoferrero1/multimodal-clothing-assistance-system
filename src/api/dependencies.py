from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from api.chat_service import ConversationRuntimeService
from fastapi import Request
from infra.db.database import Database
from sqlalchemy.orm import Session


@contextmanager
def session_scope() -> Iterator[Session]:
    session = Database().get_session()
    try:
        yield session
    finally:
        session.close()


def get_db_session() -> Iterator[Session]:
    with session_scope() as session:
        yield session


def get_chat_runtime(request: Request) -> ConversationRuntimeService:
    return request.app.state.chat_runtime
