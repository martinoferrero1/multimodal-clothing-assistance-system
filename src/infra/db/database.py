from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker, Session
from core.settings import settings
from infra.db.models.base import Base
import infra.db.models.catalog_models as _catalog_models  # noqa: F401
import infra.db.models.chat_models as _chat_models  # noqa: F401
from core.metaclasses.singleton_meta import SingletonMeta


class Database(metaclass=SingletonMeta):

    def __init__(self, db_url: str | None = None):
        resolved_db_url = db_url or settings.DATABASE_URL
        resolved_async_db_url = self._build_async_db_url(resolved_db_url)
        engine_kwargs = {
            "echo": settings.DATABASE_ECHO,
            "future": True,
        }
        if resolved_db_url.startswith("sqlite"):
            engine_kwargs["connect_args"] = {"check_same_thread": False}

        self.engine = create_engine(resolved_db_url, **engine_kwargs)
        self.async_engine = create_async_engine(resolved_async_db_url, **engine_kwargs)

        self.SessionLocal = sessionmaker(
            bind=self.engine,
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
            class_=Session,
        )
        self.AsyncSessionLocal = async_sessionmaker(
            bind=self.async_engine,
            autoflush=False,
            expire_on_commit=False,
            class_=AsyncSession,
        )

        Base.metadata.create_all(self.engine)
        self._ensure_chat_schema()

    def get_session(self) -> Session:
        return self.SessionLocal()

    def get_async_session(self) -> AsyncSession:
        return self.AsyncSessionLocal()

    async def dispose(self) -> None:
        await self.async_engine.dispose()
        self.engine.dispose()

    def _build_async_db_url(self, db_url: str) -> str:
        if db_url.startswith("sqlite:///") and not db_url.startswith("sqlite+aiosqlite:///"):
            return db_url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
        if db_url.startswith("postgresql://"):
            return db_url.replace("postgresql://", "postgresql+psycopg://", 1)
        if db_url.startswith("postgres://"):
            return db_url.replace("postgres://", "postgresql+psycopg://", 1)
        return db_url

    def _ensure_chat_schema(self) -> None:
        inspector = inspect(self.engine)
        with self.engine.begin() as connection:
            if inspector.has_table("chat_users"):
                user_column_names = {column["name"] for column in inspector.get_columns("chat_users")}
                if "password_hash" not in user_column_names:
                    connection.execute(text("ALTER TABLE chat_users ADD COLUMN password_hash VARCHAR(255)"))
                if "search_preferences" not in user_column_names:
                    connection.execute(text("ALTER TABLE chat_users ADD COLUMN search_preferences JSON"))
                if "style_preferences" not in user_column_names:
                    connection.execute(text("ALTER TABLE chat_users ADD COLUMN style_preferences JSON"))

            if inspector.has_table("conversations"):
                conversation_column_names = {
                    column["name"] for column in inspector.get_columns("conversations")
                }
                if "search_preferences" not in conversation_column_names:
                    connection.execute(text("ALTER TABLE conversations ADD COLUMN search_preferences JSON"))
                if "style_preferences" not in conversation_column_names:
                    connection.execute(text("ALTER TABLE conversations ADD COLUMN style_preferences JSON"))
                if "is_pinned" not in conversation_column_names:
                    connection.execute(
                        text(
                            "ALTER TABLE conversations "
                            "ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT FALSE"
                        )
                    )
                if "sidebar_position" not in conversation_column_names:
                    connection.execute(
                        text(
                            "ALTER TABLE conversations "
                            "ADD COLUMN sidebar_position INTEGER"
                        )
                    )

            if inspector.has_table("chat_messages"):
                message_column_names = {
                    column["name"] for column in inspector.get_columns("chat_messages")
                }
                if "attachments" not in message_column_names:
                    connection.execute(text("ALTER TABLE chat_messages ADD COLUMN attachments JSON"))
