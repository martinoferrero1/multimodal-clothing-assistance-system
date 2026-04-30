import infra.db.chat_models  # noqa: F401
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from core.settings import settings
from infra.db.models import Base
from core.metaclasses.singleton_meta import SingletonMeta

class Database(metaclass=SingletonMeta):

    def __init__(self, db_url: str | None = None):
        resolved_db_url = db_url or settings.DATABASE_URL
        engine_kwargs = {
            "echo": settings.DATABASE_ECHO,
            "future": True,
        }
        if resolved_db_url.startswith("sqlite"):
            engine_kwargs["connect_args"] = {"check_same_thread": False}

        self.engine = create_engine(resolved_db_url, **engine_kwargs)

        self.SessionLocal = sessionmaker(
            bind=self.engine,
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
            class_=Session,
        )

        Base.metadata.create_all(self.engine)

    def get_session(self) -> Session:
        return self.SessionLocal()
