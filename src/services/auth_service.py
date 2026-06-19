from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from datetime import UTC, datetime, timedelta

from api.schemas import (
    AuthResponse,
    AuthToken,
    SearchPreferencesRead,
    SearchPreferencesUpdate,
    UserLogin,
    UserRead,
    UserRegister,
)
from core.metaclasses.singleton_meta import SingletonMeta
from core.settings import settings
from fastapi import HTTPException, status
from infra.db.models.chat_models import ChatUser
from services.search_preferences_service import get_search_preferences_service
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


class AuthenticationService(metaclass=SingletonMeta):
    _SCRYPT_N = 2**14
    _SCRYPT_R = 8
    _SCRYPT_P = 1
    _SALT_SIZE = 16

    async def register_user(self, session: AsyncSession, payload: UserRegister) -> AuthResponse:
        normalized_email = self._normalize_email(payload.email)
        existing_user = await session.scalar(select(ChatUser).where(ChatUser.email == normalized_email))
        if existing_user is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with that email already exists.",
            )

        user = ChatUser(
            display_name=payload.display_name.strip(),
            email=normalized_email,
            password_hash=self._hash_password(payload.password),
        )
        session.add(user)
        try:
            await session.commit()
        except IntegrityError as exc:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with that email already exists.",
            ) from exc
        await session.refresh(user)
        return self._build_auth_response(user)

    async def login_user(self, session: AsyncSession, payload: UserLogin) -> AuthResponse:
        normalized_email = self._normalize_email(payload.email)
        user = await session.scalar(select(ChatUser).where(ChatUser.email == normalized_email))
        if user is None or not user.password_hash or not self._verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return self._build_auth_response(user)

    async def authenticate_user(self, session: AsyncSession, token: str) -> ChatUser | None:
        user_id = self._verify_access_token(token)
        if user_id is None:
            return None
        return await session.get(ChatUser, user_id)

    def ensure_same_user(self, authenticated_user_id: str, requested_user_id: str) -> None:
        if authenticated_user_id != requested_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not allowed to access this user.",
            )

    async def update_user_search_preferences(
        self,
        session: AsyncSession,
        user: ChatUser,
        payload: SearchPreferencesUpdate,
    ) -> SearchPreferencesRead:
        user.search_preferences = get_search_preferences_service().storage_from_fields(
            payload.priority_fields
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return self.build_user_read(user).search_preferences

    def build_user_read(self, user: ChatUser) -> UserRead:
        priority_fields = get_search_preferences_service().user_priority_fields(
            user.search_preferences
        )
        return UserRead(
            id=user.id,
            display_name=user.display_name,
            email=user.email,
            search_preferences=SearchPreferencesRead(priority_fields=priority_fields),
            created_at=user.created_at,
        )

    def _build_auth_response(self, user: ChatUser) -> AuthResponse:
        token = self._create_access_token(user.id)
        return AuthResponse(token=token, user=self.build_user_read(user))

    def _create_access_token(self, user_id: str) -> AuthToken:
        expires_at = datetime.now(UTC) + timedelta(minutes=settings.AUTH_TOKEN_EXPIRE_MINUTES)
        payload = {
            "sub": user_id,
            "exp": int(expires_at.timestamp()),
        }
        payload_segment = self._urlsafe_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        signature = hmac.new(
            settings.AUTH_TOKEN_SECRET.encode("utf-8"),
            payload_segment.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        token = f"{payload_segment}.{self._urlsafe_encode(signature)}"
        return AuthToken(
            access_token=token,
            token_type="bearer",
            expires_at=expires_at,
        )

    def _verify_access_token(self, token: str) -> str | None:
        try:
            payload_segment, signature_segment = token.split(".", maxsplit=1)
        except ValueError:
            return None

        expected_signature = hmac.new(
            settings.AUTH_TOKEN_SECRET.encode("utf-8"),
            payload_segment.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(self._urlsafe_encode(expected_signature), signature_segment):
            return None

        try:
            payload = json.loads(self._urlsafe_decode(payload_segment).decode("utf-8"))
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            return None

        expires_at = payload.get("exp")
        user_id = payload.get("sub")
        if not isinstance(expires_at, int) or not isinstance(user_id, str):
            return None
        if expires_at <= int(datetime.now(UTC).timestamp()):
            return None
        return user_id

    def _hash_password(self, password: str) -> str:
        salt = secrets.token_bytes(self._SALT_SIZE)
        derived_key = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=self._SCRYPT_N,
            r=self._SCRYPT_R,
            p=self._SCRYPT_P,
        )
        return (
            f"scrypt${self._SCRYPT_N}${self._SCRYPT_R}${self._SCRYPT_P}$"
            f"{self._urlsafe_encode(salt)}${self._urlsafe_encode(derived_key)}"
        )

    def _verify_password(self, password: str, password_hash: str) -> bool:
        try:
            algorithm, n_value, r_value, p_value, salt_segment, key_segment = password_hash.split("$", maxsplit=5)
        except ValueError:
            return False
        if algorithm != "scrypt":
            return False

        try:
            derived_key = hashlib.scrypt(
                password.encode("utf-8"),
                salt=self._urlsafe_decode(salt_segment),
                n=int(n_value),
                r=int(r_value),
                p=int(p_value),
            )
        except ValueError:
            return False

        return hmac.compare_digest(self._urlsafe_encode(derived_key), key_segment)

    def _normalize_email(self, email: str) -> str:
        return email.strip().lower()

    def _urlsafe_encode(self, value: bytes) -> str:
        return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")

    def _urlsafe_decode(self, value: str) -> bytes:
        padding = "=" * (-len(value) % 4)
        return base64.urlsafe_b64decode(f"{value}{padding}")
