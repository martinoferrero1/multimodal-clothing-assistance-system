from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from api.schemas import (
    AuthResponse,
    SearchPreferencesRead,
    SearchPreferencesUpdate,
    UserLogin,
    UserRead,
    UserRegister,
    UserStylePreferencesRead,
    UserStylePreferencesUpdate,
)
from core.metaclasses.singleton_meta import SingletonMeta
from core.settings import settings
from fastapi import HTTPException, status
from infra.db.models.chat_models import AuthSession, ChatUser, StoreMembership
from services.preference_learning_service import get_preference_learning_service
from services.search_preferences_service import get_search_preferences_service
from services.style_preferences_service import get_style_preferences_service
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload


@dataclass(frozen=True)
class CurrentSession:
    user: ChatUser
    session: AuthSession


@dataclass(frozen=True)
class IssuedSession:
    user: ChatUser
    session: AuthSession
    token: str


class AuthenticationService(metaclass=SingletonMeta):
    _SCRYPT_N = 2**14
    _SCRYPT_R = 8
    _SCRYPT_P = 1
    _SALT_SIZE = 16
    _REVOKE_REASONS = {
        "logout", "logout_all", "rotated", "expired", "store_rejected",
        "store_suspended", "membership_revoked", "ownership_transferred",
    }

    async def register_user(
        self, session: AsyncSession, payload: UserRegister, previous_token: str | None = None
    ) -> IssuedSession:
        normalized_email = self._normalize_email(payload.email)
        user = ChatUser(
            display_name=payload.display_name.strip(),
            email=normalized_email,
            password_hash=self._hash_password(payload.password),
        )
        session.add(user)
        try:
            await session.flush()
            issued = await self._create_session(session, user, previous_token)
            await session.commit()
        except IntegrityError as exc:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to create account.",
            ) from exc
        await session.refresh(user)
        return issued

    async def login_user(
        self, session: AsyncSession, payload: UserLogin, previous_token: str | None = None
    ) -> IssuedSession:
        normalized_email = self._normalize_email(payload.email)
        user = await session.scalar(select(ChatUser).where(ChatUser.email == normalized_email))
        if user is None or not user.password_hash or not self._verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
        try:
            # A store owner normally has exactly one store. Bind that store to
            # the new session so a later regular login can resume store
            # onboarding/access without requiring an email-verification token.
            store_ids = (
                await session.scalars(
                    select(StoreMembership.store_id).where(
                        StoreMembership.user_id == user.id,
                        StoreMembership.role == "owner",
                        StoreMembership.revoked_at.is_(None),
                    )
                )
            ).all()
            active_store_id = store_ids[0] if len(store_ids) == 1 else None
            issued = await self.create_session(
                session, user, previous_token, active_store_id=active_store_id
            )
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        return issued

    async def resolve_session(self, session: AsyncSession, token: str | None) -> CurrentSession | None:
        if not token or len(token) > 512:
            return None
        session_row = await session.scalar(
            select(AuthSession)
            .options(selectinload(AuthSession.user))
            .where(AuthSession.token_hash == self._hash_session_token(token))
        )
        if session_row is None or session_row.user is None or session_row.revoked_at is not None:
            return None
        now = datetime.now(UTC)
        if now >= self._utc(session_row.idle_expires_at) or now >= self._utc(session_row.absolute_expires_at):
            session_row.revoked_at = now
            session_row.revoke_reason = "expired"
            await session.commit()
            return None
        if (now - self._utc(session_row.last_seen_at)).total_seconds() >= settings.SESSION_TOUCH_INTERVAL_SECONDS:
            session_row.last_seen_at = now
            session_row.idle_expires_at = min(
                now + timedelta(minutes=settings.SESSION_IDLE_MINUTES),
                self._utc(session_row.absolute_expires_at),
            )
            await session.commit()
        return CurrentSession(user=session_row.user, session=session_row)

    async def revoke_current_session(self, session: AsyncSession, current: CurrentSession) -> None:
        session_row = await session.get(AuthSession, current.session.id)
        if session_row is not None:
            await self._revoke(session_row, "logout")
        await session.commit()

    async def revoke_all_sessions(self, session: AsyncSession, user_id: str) -> None:
        now = datetime.now(UTC)
        await session.execute(
            update(AuthSession)
            .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
            .values(revoked_at=now, revoke_reason="logout_all")
        )
        await session.commit()

    def build_auth_response(self, issued: IssuedSession, selected_store=None) -> AuthResponse:
        return AuthResponse(
            user=self.build_user_read(issued.user),
            csrf_token=self.csrf_token(issued.session),
            selected_store=selected_store,
        )

    def csrf_token(self, session: AuthSession) -> str:
        payload = f"v1:{session.id}:{session.token_hash}".encode("utf-8")
        digest = hmac.new(
            settings.SESSION_CSRF_SECRET.get_secret_value().encode("utf-8"), payload, hashlib.sha256
        ).digest()
        return self._urlsafe_encode(digest)

    def csrf_token_is_valid(self, current: CurrentSession, token: str | None) -> bool:
        return bool(token) and hmac.compare_digest(self.csrf_token(current.session), token)

    def ensure_same_user(self, authenticated_user_id: str, requested_user_id: str) -> None:
        if authenticated_user_id != requested_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not allowed to access this user.")

    async def update_user_search_preferences(self, session: AsyncSession, user: ChatUser, payload: SearchPreferencesUpdate) -> SearchPreferencesRead:
        user.search_preferences = get_search_preferences_service().storage_from_fields(payload.priority_fields)
        await session.commit()
        await session.refresh(user)
        return self.build_user_read(user).search_preferences

    async def update_user_style_preferences(self, session: AsyncSession, user: ChatUser, payload: UserStylePreferencesUpdate) -> UserStylePreferencesRead:
        user.style_preferences = get_style_preferences_service().storage_from_user_update(user.style_preferences, payload)
        await session.commit()
        await session.refresh(user)
        return self.build_user_read(user).style_preferences

    async def clear_user_explicit_style_preferences(self, session: AsyncSession, user: ChatUser) -> UserStylePreferencesRead:
        user.style_preferences = get_style_preferences_service().storage_with_cleared_explicit(user.style_preferences)
        await session.commit()
        await session.refresh(user)
        return self.build_user_read(user).style_preferences

    async def remove_user_inferred_style_preference(self, session: AsyncSession, user: ChatUser, inferred_id: str) -> UserStylePreferencesRead:
        await get_preference_learning_service().suppress_inferred_preference(session, user_id=user.id, raw_preferences=user.style_preferences, inferred_id=inferred_id)
        next_storage, removed = get_style_preferences_service().storage_without_inferred(user.style_preferences, inferred_id)
        if not removed:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inferred preference not found.")
        user.style_preferences = next_storage
        await session.commit()
        await session.refresh(user)
        return self.build_user_read(user).style_preferences

    def build_user_read(self, user: ChatUser) -> UserRead:
        return UserRead(
            id=user.id, display_name=user.display_name, email=user.email,
            search_preferences=SearchPreferencesRead(priority_fields=get_search_preferences_service().user_priority_fields(user.search_preferences)),
            style_preferences=get_style_preferences_service().user_preferences(user.style_preferences),
            created_at=user.created_at,
        )

    async def create_session(
        self,
        session: AsyncSession,
        user: ChatUser,
        previous_token: str | None,
        active_store_id: str | None = None,
    ) -> IssuedSession:
        if previous_token:
            previous = await session.scalar(select(AuthSession).where(AuthSession.token_hash == self._hash_session_token(previous_token)))
            if previous is not None and previous.revoked_at is None and self._session_is_active(previous):
                await self._revoke(previous, "rotated")
        now = datetime.now(UTC)
        token = secrets.token_urlsafe(32)
        absolute_expires_at = now + timedelta(hours=settings.SESSION_ABSOLUTE_HOURS)
        row = AuthSession(
            user_id=user.id, active_store_id=active_store_id,
            token_hash=self._hash_session_token(token), created_at=now, last_seen_at=now,
            idle_expires_at=min(now + timedelta(minutes=settings.SESSION_IDLE_MINUTES), absolute_expires_at),
            absolute_expires_at=absolute_expires_at,
        )
        session.add(row)
        await session.flush()
        return IssuedSession(user=user, session=row, token=token)

    async def _create_session(self, session: AsyncSession, user: ChatUser, previous_token: str | None) -> IssuedSession:
        return await self.create_session(session, user, previous_token)

    async def _revoke(self, session_row: AuthSession, reason: str) -> None:
        if reason not in self._REVOKE_REASONS:
            raise ValueError("Unsupported session revoke reason")
        if session_row.revoked_at is None:
            session_row.revoked_at = datetime.now(UTC)
            session_row.revoke_reason = reason

    def _session_is_active(self, session_row: AuthSession) -> bool:
        now = datetime.now(UTC)
        return now < self._utc(session_row.idle_expires_at) and now < self._utc(session_row.absolute_expires_at)

    def _hash_session_token(self, token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def _hash_password(self, password: str) -> str:
        salt = secrets.token_bytes(self._SALT_SIZE)
        derived_key = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=self._SCRYPT_N, r=self._SCRYPT_R, p=self._SCRYPT_P)
        return f"scrypt${self._SCRYPT_N}${self._SCRYPT_R}${self._SCRYPT_P}${self._urlsafe_encode(salt)}${self._urlsafe_encode(derived_key)}"

    def _verify_password(self, password: str, password_hash: str) -> bool:
        try:
            algorithm, n_value, r_value, p_value, salt_segment, key_segment = password_hash.split("$", maxsplit=5)
            if algorithm != "scrypt":
                return False
            derived_key = hashlib.scrypt(password.encode("utf-8"), salt=self._urlsafe_decode(salt_segment), n=int(n_value), r=int(r_value), p=int(p_value))
        except (ValueError, TypeError):
            return False
        return hmac.compare_digest(self._urlsafe_encode(derived_key), key_segment)

    @staticmethod
    def _utc(value: datetime) -> datetime:
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)

    @staticmethod
    def _normalize_email(email: str) -> str:
        return email.strip().lower()

    @staticmethod
    def _urlsafe_encode(value: bytes) -> str:
        return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")

    @staticmethod
    def _urlsafe_decode(value: str) -> bytes:
        return base64.urlsafe_b64decode(f"{value}{'=' * (-len(value) % 4)}")
