from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from db.models import Base
from core.metaclasses.singleton_meta import SingletonMeta

class Database(metaclass=SingletonMeta):

    def __init__(self, db_url: str = "sqlite:///catalog.db"):
        self.engine = create_engine(db_url, echo=False, future=True)

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
