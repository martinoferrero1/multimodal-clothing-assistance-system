from __future__ import annotations

from api.schemas import HealthResponse
from fastapi import APIRouter


router = APIRouter(tags=["health"])


@router.get("/", response_model=HealthResponse)
def root() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get("/health", response_model=HealthResponse)
def healthcheck() -> HealthResponse:
    return HealthResponse(status="ok")
