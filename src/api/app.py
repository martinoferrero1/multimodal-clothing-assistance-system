from __future__ import annotations

import asyncio
import inspect
import logging
from contextlib import asynccontextmanager

from api.checkpointer import LangGraphCheckpointer
from core.provider_readiness import validate_deployed_provider_readiness
from core.logging_config import setup_logging
from core.settings import settings
from api.routes.conversations import router as conversations_router
from api.routes.health import router as health_router
from api.routes.users import router as users_router
from api.routes.auth import router as auth_router
from fastapi import FastAPI
from infra.db.database import Database
from infra.db.migration_state import require_current_revision
from scripts.seed_db import seed_catalog
from services.conversation_runtime_service import ConversationRuntimeService


setup_logging()
logger = logging.getLogger(__name__)


async def run_provider_readiness_gate(app: FastAPI) -> None:
    gate = getattr(app.state, "provider_readiness_gate", None)
    if gate is None:
        await asyncio.to_thread(validate_deployed_provider_readiness, settings)
        return

    result = gate()
    if inspect.isawaitable(result):
        await result


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Lookeate API")
    database = None
    checkpoint_manager = None
    try:
        await run_provider_readiness_gate(app)
        database = Database()
        await asyncio.to_thread(require_current_revision, database.engine)
        await asyncio.to_thread(seed_catalog, database)
        checkpoint_manager = LangGraphCheckpointer()
        checkpoint_manager.start()
        app.state.checkpoint_manager = checkpoint_manager
        app.state.chat_runtime = ConversationRuntimeService(checkpoint_manager.checkpointer)
        yield
    finally:
        logger.info("Shutting down Lookeate API")
        if checkpoint_manager is not None:
            checkpoint_manager.close()
        if database is not None:
            await database.dispose()


app = FastAPI(
    title="Lookeate API",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(conversations_router)
