from __future__ import annotations

from api.checkpointer import LangGraphCheckpointer
from core.logging_config import setup_logging


def main() -> None:
    setup_logging()
    manager = LangGraphCheckpointer()
    try:
        manager.start()
        manager.setup_schema()
    finally:
        manager.close()


if __name__ == "__main__":
    main()
