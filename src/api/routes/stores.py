from __future__ import annotations

from typing import Literal

from api.dependencies import enforce_rate_limit, get_auth_service, get_current_session, get_db_session
from api.schemas import (
    AuthResponse, StoreDecision, StoreEmailVerification, StoreMfaConfirmation,
    StoreMfaEnrollmentRead, StoreRegistration, StoreRegistrationAcknowledgement,
    StoreSelection, StoreStatusRead, UserLogin,
    StoreOwnershipTransfer,
)
from api.session_cookies import clear_session_cookie, issue_session_cookie
from core.settings import settings
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from services.auth_service import AuthenticationService, CurrentSession
from services.store_service import StoreService
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/auth/store", tags=["store-auth"])


def get_store_service() -> StoreService:
    return StoreService()


def _observe(request: Request, event: str, outcome: str) -> None:
    metrics = getattr(request.app.state, "metrics", None)
    if metrics is not None:
        metrics.observe_store_identity_event(event, outcome)


@router.post(
    "/register",
    response_model=AuthResponse | StoreRegistrationAcknowledgement,
    status_code=status.HTTP_201_CREATED,
)
async def register_store(
    payload: StoreRegistration,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
    auth_service: AuthenticationService = Depends(get_auth_service),
    store_service: StoreService = Depends(get_store_service),
) -> AuthResponse | StoreRegistrationAcknowledgement:
    await enforce_rate_limit(request, "store_registration", account=str(payload.owner_email), store=payload.handle)
    current = await auth_service.resolve_session(session, request.cookies.get(settings.SESSION_COOKIE_NAME))
    if current is not None and current.user.account_kind == "guest":
        clear_session_cookie(response)
        response.status_code = status.HTTP_202_ACCEPTED
        _observe(request, "registration", "acknowledged")
        return StoreRegistrationAcknowledgement()
    registered = await store_service.register(session, payload)
    if not registered:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to submit the store registration.",
        )
    issued = await auth_service.login_user(
        session,
        UserLogin(email=payload.owner_email, password=payload.owner_password),
        request.cookies.get(settings.SESSION_COOKIE_NAME),
    )
    issue_session_cookie(response, issued.token, issued.session.absolute_expires_at)
    selected = await store_service.selected_status(
        session, CurrentSession(user=issued.user, session=issued.session)
    )
    _observe(request, "registration", "acknowledged")
    return auth_service.build_auth_response(issued, selected.selected_store)


@router.post("/verify-email", response_model=AuthResponse)
async def verify_store_email(
    payload: StoreEmailVerification,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
    auth_service: AuthenticationService = Depends(get_auth_service),
    store_service: StoreService = Depends(get_store_service),
) -> AuthResponse:
    await enforce_rate_limit(request, "store_verification")
    issued = await store_service.verify_email(session, payload.verification_value, request.cookies.get(settings.SESSION_COOKIE_NAME))
    _observe(request, "verification", "success")
    issue_session_cookie(response, issued.token, issued.session.absolute_expires_at)
    selected = await store_service.selected_status(session, CurrentSession(user=issued.user, session=issued.session))
    return auth_service.build_auth_response(issued, selected.selected_store)


@router.get("/status", response_model=StoreStatusRead)
async def store_status(
    current: CurrentSession = Depends(get_current_session),
    session: AsyncSession = Depends(get_db_session),
    store_service: StoreService = Depends(get_store_service),
) -> StoreStatusRead:
    return await store_service.selected_status(session, current)


@router.post("/mfa/enroll", response_model=StoreMfaEnrollmentRead)
async def enroll_mfa(
    request: Request,
    current: CurrentSession = Depends(get_current_session),
    session: AsyncSession = Depends(get_db_session),
    store_service: StoreService = Depends(get_store_service),
) -> StoreMfaEnrollmentRead:
    await enforce_rate_limit(request, "store_mfa", user_id=current.user.id)
    return await store_service.enroll_mfa(session, current)


@router.post("/mfa/confirm", response_model=StoreStatusRead)
async def confirm_mfa(
    payload: StoreMfaConfirmation,
    request: Request,
    current: CurrentSession = Depends(get_current_session),
    session: AsyncSession = Depends(get_db_session),
    store_service: StoreService = Depends(get_store_service),
) -> StoreStatusRead:
    await enforce_rate_limit(request, "store_mfa", user_id=current.user.id)
    response = await store_service.confirm_mfa(session, current, payload.code)
    _observe(request, "mfa_confirmation", "success")
    return response


@router.post("/select", response_model=AuthResponse)
async def select_store(
    payload: StoreSelection,
    request: Request,
    response: Response,
    current: CurrentSession = Depends(get_current_session),
    session: AsyncSession = Depends(get_db_session),
    auth_service: AuthenticationService = Depends(get_auth_service),
    store_service: StoreService = Depends(get_store_service),
) -> AuthResponse:
    issued = await store_service.select_store(session, current, payload.handle, request.cookies.get(settings.SESSION_COOKIE_NAME))
    issue_session_cookie(response, issued.token, issued.session.absolute_expires_at)
    selected = await store_service.selected_status(session, CurrentSession(user=issued.user, session=issued.session))
    return auth_service.build_auth_response(issued, selected.selected_store)


@router.post("/operator/decision/{decision}", response_model=StoreStatusRead)
async def decide_store(
    decision: Literal["approve", "reject", "suspend", "restore"],
    payload: StoreDecision,
    request: Request,
    current: CurrentSession = Depends(get_current_session),
    session: AsyncSession = Depends(get_db_session),
    store_service: StoreService = Depends(get_store_service),
) -> StoreStatusRead:
    await enforce_rate_limit(request, "store_approval", user_id=current.user.id)
    response = await store_service.decide(session, current, payload.handle, decision)
    _observe(request, decision, "success")
    return response


@router.post("/operator/transfer", response_model=StoreStatusRead)
async def transfer_ownership(
    payload: StoreOwnershipTransfer,
    request: Request,
    current: CurrentSession = Depends(get_current_session),
    session: AsyncSession = Depends(get_db_session),
    store_service: StoreService = Depends(get_store_service),
) -> StoreStatusRead:
    await enforce_rate_limit(request, "store_approval", user_id=current.user.id)
    response = await store_service.transfer_ownership(
        session, current, payload.handle, str(payload.recipient_email), payload.totp_code
    )
    _observe(request, "ownership_transfer", "success")
    return response
