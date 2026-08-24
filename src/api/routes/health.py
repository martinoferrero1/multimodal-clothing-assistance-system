from __future__ import annotations

import asyncio

from api.metrics import RuntimeMetrics
from api.schemas import HealthResponse
from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import text


router = APIRouter(tags=["health"])


@router.get("/", response_model=HealthResponse)
def root(request: Request) -> HealthResponse:
    return HealthResponse(status="ok" if not getattr(request.app.state, "draining", False) else "draining")


@router.get("/health", response_model=HealthResponse)
def healthcheck(request: Request) -> HealthResponse:
    return root(request)


@router.get("/live", response_model=HealthResponse)
def liveness(request: Request) -> HealthResponse:
    return HealthResponse(status="ok" if not getattr(request.app.state, "draining", False) else "draining")


@router.get("/ready", response_model=HealthResponse)
async def readiness(request: Request) -> HealthResponse:
    if getattr(request.app.state, "draining", False):
        return HealthResponse(status="not_ready", checks={"lifecycle": "draining"})
    database = getattr(request.app.state, "database", None)
    if database is None:
        return HealthResponse(status="not_ready", checks={"database": "unavailable"})
    try:
        await asyncio.wait_for(_check_database(database), timeout=2.0)
    except Exception:
        metrics: RuntimeMetrics = request.app.state.metrics
        metrics.observe_dependency_failure()
        metrics.observe_readiness_failure()
        return HealthResponse(status="not_ready", checks={"database": "unavailable"})
    return HealthResponse(status="ok", checks={"database": "ok", "migrations": "current"})


async def _check_database(database) -> None:
    def check() -> None:
        with database.engine.connect() as connection:
            connection.execute(text("SELECT 1"))

    await asyncio.to_thread(check)


@router.get("/metrics", response_class=PlainTextResponse)
def metrics(request: Request) -> PlainTextResponse:
    return PlainTextResponse(request.app.state.metrics.prometheus(), media_type="text/plain; version=0.0.4")
