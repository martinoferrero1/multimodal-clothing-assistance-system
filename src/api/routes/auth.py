from __future__ import annotations

from api.dependencies import (
    get_auth_service,
    get_current_session,
    get_db_session,
    get_rate_limited_current_session,
    enforce_rate_limit,
)
from api.session_cookies import clear_session_cookie, issue_session_cookie
from api.schemas import AuthResponse, UserLogin, UserRegister
from core.settings import settings
from fastapi import APIRouter, Depends, Request, Response, status
from services.auth_service import AuthenticationService, CurrentSession
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    payload: UserRegister,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
    auth_service: AuthenticationService = Depends(get_auth_service),
) -> AuthResponse:
    await enforce_rate_limit(request, "registration", account=str(payload.email))
    issued = await auth_service.register_user(
        session, payload, request.cookies.get(settings.SESSION_COOKIE_NAME)
    )
    issue_session_cookie(response, issued.token, issued.session.absolute_expires_at)
    return auth_service.build_auth_response(issued)


@router.post("/login", response_model=AuthResponse)
async def login_user(
    payload: UserLogin,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
    auth_service: AuthenticationService = Depends(get_auth_service),
) -> AuthResponse:
    await enforce_rate_limit(request, "login", account=str(payload.email))
    issued = await auth_service.login_user(
        session, payload, request.cookies.get(settings.SESSION_COOKIE_NAME)
    )
    issue_session_cookie(response, issued.token, issued.session.absolute_expires_at)
    return auth_service.build_auth_response(issued)


@router.get("/session", response_model=AuthResponse)
async def restore_session(
    current: CurrentSession = Depends(get_rate_limited_current_session),
    auth_service: AuthenticationService = Depends(get_auth_service),
) -> AuthResponse:
    return AuthResponse(user=auth_service.build_user_read(current.user), csrf_token=auth_service.csrf_token(current.session))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    current: CurrentSession = Depends(get_current_session),
    session: AsyncSession = Depends(get_db_session),
    auth_service: AuthenticationService = Depends(get_auth_service),
) -> Response:
    await auth_service.revoke_current_session(session, current)
    clear_session_cookie(response)
    return response


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all(
    response: Response,
    current: CurrentSession = Depends(get_current_session),
    session: AsyncSession = Depends(get_db_session),
    auth_service: AuthenticationService = Depends(get_auth_service),
) -> Response:
    await auth_service.revoke_all_sessions(session, current.user.id)
    clear_session_cookie(response)
    return response
