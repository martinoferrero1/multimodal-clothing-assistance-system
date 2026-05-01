from __future__ import annotations

from api.dependencies import (
    get_auth_service,
    get_db_session,
)
from api.schemas import AuthResponse, UserLogin, UserRegister
from fastapi import APIRouter, Depends, status
from services.auth_service import AuthenticationService
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    payload: UserRegister,
    session: AsyncSession = Depends(get_db_session),
    auth_service: AuthenticationService = Depends(get_auth_service),
) -> AuthResponse:
    return await auth_service.register_user(session, payload)


@router.post("/login", response_model=AuthResponse)
async def login_user(
    payload: UserLogin,
    session: AsyncSession = Depends(get_db_session),
    auth_service: AuthenticationService = Depends(get_auth_service),
) -> AuthResponse:
    return await auth_service.login_user(session, payload)