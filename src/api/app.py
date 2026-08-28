from __future__ import annotations

import asyncio
import inspect
import logging
import time
import uuid
from contextlib import asynccontextmanager
from urllib.parse import urlsplit

from api.checkpointer import LangGraphCheckpointer
from core.provider_readiness import validate_deployed_provider_readiness
from core.logging_config import setup_logging
from core.settings import settings
from api.routes.conversations import router as conversations_router
from api.routes.health import router as health_router
from api.routes.users import router as users_router
from api.routes.auth import router as auth_router
from api.routes.stores import router as stores_router
from api.routes.store_inventory import router as store_inventory_router
from api.metrics import RuntimeMetrics
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from infra.db.database import Database
from infra.db.migration_state import require_current_revision
from scripts.seed_db import seed_catalog
from services.conversation_runtime_service import ConversationRuntimeService
from services.rate_limit_service import RateLimitUnavailable, create_rate_limiter


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
    app.state.draining = False
    app.state.metrics = RuntimeMetrics()
    database = None
    checkpoint_manager = None
    try:
        await run_provider_readiness_gate(app)
        app.state.rate_limiter = create_rate_limiter()
        if settings.APP_ENV in {"staging", "production"}:
            try:
                await app.state.rate_limiter.ready()
            except RateLimitUnavailable:
                logger.error("Shared rate limiter readiness failed")
                raise
        database = Database()
        app.state.database = database
        await asyncio.to_thread(require_current_revision, database.engine)
        await asyncio.to_thread(seed_catalog, database)
        checkpoint_manager = LangGraphCheckpointer()
        checkpoint_manager.start()
        app.state.checkpoint_manager = checkpoint_manager
        app.state.chat_runtime = ConversationRuntimeService(checkpoint_manager.checkpointer)
        yield
    finally:
        app.state.draining = True
        logger.info("Shutting down Lookeate API")
        if checkpoint_manager is not None:
            checkpoint_manager.close()
        if database is not None:
            await database.dispose()
        app.state.database = None


app = FastAPI(
    title="Lookeate API",
    version="1.0.0",
    lifespan=lifespan,
)
app.state.draining = True
app.state.metrics = RuntimeMetrics()
app.state.database = None


@app.middleware("http")
async def request_telemetry(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    if len(request_id) > 128 or any(character.isspace() for character in request_id):
        request_id = str(uuid.uuid4())
    started = time.monotonic()
    try:
        response = await call_next(request)
    except Exception:
        app.state.metrics.observe_request(request.url.path, time.monotonic() - started, 500)
        logger.exception("request_failed", extra={"request_id": request_id, "path": request.url.path})
        raise
    duration = time.monotonic() - started
    app.state.metrics.observe_request(request.url.path, duration, response.status_code)
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "request_complete",
        extra={"request_id": request_id, "path": request.url.path, "status_code": response.status_code},
    )
    return response


@app.middleware("http")
async def protect_unsafe_browser_requests(request: Request, call_next):
    if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return await call_next(request)
    origin = request.headers.get("origin")
    if origin is None:
        referer = request.headers.get("referer")
        try:
            parsed = urlsplit(referer or "")
            origin = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else None
        except ValueError:
            origin = None
    if origin not in settings.ALLOWED_ORIGINS or request.headers.get("sec-fetch-site", "").lower() == "cross-site":
        return JSONResponse(status_code=403, content={"detail": "Request origin is not allowed."})
    return await call_next(request)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(stores_router)
app.include_router(store_inventory_router)
app.include_router(users_router)
app.include_router(conversations_router)
