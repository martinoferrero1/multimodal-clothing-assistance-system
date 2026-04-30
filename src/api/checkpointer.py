from __future__ import annotations

from pathlib import Path

from core.settings import settings


class LangGraphCheckpointer:
    def __init__(self) -> None:
        self._context_manager = None
        self.checkpointer = None

    def start(self) -> None:
        backend, connection_string = self._resolve_backend_and_connection_string()
        if backend == "postgres":
            from langgraph.checkpoint.postgres import PostgresSaver

            self._context_manager = PostgresSaver.from_conn_string(connection_string)
        elif backend == "sqlite":
            from langgraph.checkpoint.sqlite import SqliteSaver

            self._ensure_sqlite_parent_dir(connection_string)
            self._context_manager = SqliteSaver.from_conn_string(connection_string)
        else:
            raise ValueError(f"Unsupported LangGraph checkpoint backend: {backend}")

        self.checkpointer = self._context_manager.__enter__()
        self.checkpointer.setup()

    def close(self) -> None:
        if self._context_manager is None:
            return
        self._context_manager.__exit__(None, None, None)
        self._context_manager = None
        self.checkpointer = None

    def _resolve_backend_and_connection_string(self) -> tuple[str, str]:
        raw_value = settings.LANGGRAPH_CHECKPOINT_DATABASE_URL or self._default_checkpoint_url()

        if raw_value.startswith("postgresql+psycopg://"):
            return "postgres", raw_value.replace("postgresql+psycopg://", "postgresql://", 1)
        if raw_value.startswith("postgresql://") or raw_value.startswith("postgres://"):
            return "postgres", raw_value
        if raw_value.startswith("sqlite:///"):
            return "sqlite", raw_value.removeprefix("sqlite:///")
        if raw_value.startswith("sqlite://"):
            return "sqlite", raw_value.removeprefix("sqlite://")

        raise ValueError(
            "Unsupported checkpoint database URL. Use PostgreSQL or SQLite for LangGraph checkpoints."
        )

    def _default_checkpoint_url(self) -> str:
        database_url = settings.DATABASE_URL
        if database_url.startswith("postgresql+psycopg://") or database_url.startswith("postgresql://"):
            return database_url
        if database_url.startswith("sqlite:///") or database_url.startswith("sqlite://"):
            return "sqlite:///data/langgraph_checkpoints.sqlite"
        raise ValueError(
            "Could not infer a default LangGraph checkpoint database URL from DATABASE_URL."
        )

    def _ensure_sqlite_parent_dir(self, sqlite_path: str) -> None:
        path = Path(sqlite_path)
        parent = path.parent
        if str(parent) and str(parent) != ".":
            parent.mkdir(parents=True, exist_ok=True)
