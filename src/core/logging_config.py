from __future__ import annotations

import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path


DEFAULT_LOG_FILE = "logs/app.log"
DEFAULT_LOG_LEVEL = "INFO"
DEFAULT_MAX_BYTES = 5 * 1024 * 1024
DEFAULT_BACKUP_COUNT = 3


class MultilineFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        message = super().format(record)
        if "\n" not in message:
            return message

        first_line, *remaining_lines = message.splitlines()
        return "\n".join([first_line, *(f"    {line}" for line in remaining_lines)])


def setup_logging(
    *,
    log_file: str | os.PathLike[str] | None = None,
    log_level: str | None = None,
    force: bool = False,
) -> Path:
    level_name = (log_level or os.getenv("LOG_LEVEL") or DEFAULT_LOG_LEVEL).upper()
    level = getattr(logging, level_name, logging.INFO)
    log_path = _resolve_log_path(log_file or os.getenv("LOG_FILE") or DEFAULT_LOG_FILE)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    root_logger = logging.getLogger()
    if force:
        _remove_configured_handlers(root_logger)
    elif any(getattr(handler, "_mcas_handler", False) for handler in root_logger.handlers):
        root_logger.setLevel(level)
        return log_path

    console_formatter = MultilineFormatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%H:%M:%S",
    )
    file_formatter = MultilineFormatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s:%(lineno)d | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(console_formatter)
    console_handler.setLevel(level)
    console_handler._mcas_handler = True  # type: ignore[attr-defined]

    file_handler = RotatingFileHandler(
        log_path,
        maxBytes=_env_int("LOG_MAX_BYTES", DEFAULT_MAX_BYTES),
        backupCount=_env_int("LOG_BACKUP_COUNT", DEFAULT_BACKUP_COUNT),
        encoding="utf-8",
    )
    file_handler.setFormatter(file_formatter)
    file_handler.setLevel(level)
    file_handler._mcas_handler = True  # type: ignore[attr-defined]

    root_logger.setLevel(level)
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)
    logging.captureWarnings(True)

    logging.getLogger(__name__).info("Logging configured. Writing to %s", log_path)
    return log_path


def _resolve_log_path(log_file: str | os.PathLike[str]) -> Path:
    path = Path(log_file)
    if path.is_absolute():
        return path
    return Path(__file__).resolve().parents[2] / path


def _remove_configured_handlers(logger: logging.Logger) -> None:
    for handler in list(logger.handlers):
        if getattr(handler, "_mcas_handler", False):
            logger.removeHandler(handler)
            handler.close()


def _env_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    try:
        return int(raw_value)
    except ValueError:
        return default
