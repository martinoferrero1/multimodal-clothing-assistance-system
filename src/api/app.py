from __future__ import annotations

from contextlib import asynccontextmanager

from api.checkpointer import LangGraphCheckpointer
from api.chat_service import ConversationRuntimeService
from api.routes.conversations import router as conversations_router
from api.routes.health import router as health_router
from api.routes.users import router as users_router
from fastapi import FastAPI
from infra.db.database import Database
from scripts.seed_db import seed_catalog


@asynccontextmanager
async def lifespan(app: FastAPI):
    Database()
    seed_catalog()
    checkpoint_manager = LangGraphCheckpointer()
    checkpoint_manager.start()
    app.state.checkpoint_manager = checkpoint_manager
    app.state.chat_runtime = ConversationRuntimeService(checkpoint_manager.checkpointer)
    try:
        yield
    finally:
        checkpoint_manager.close()


app = FastAPI(
    title="Multimodal Clothing Assistant API",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(health_router)
app.include_router(users_router)
app.include_router(conversations_router)
