from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker, Session
from core.settings import settings
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
