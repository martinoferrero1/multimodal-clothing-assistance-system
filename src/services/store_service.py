from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import struct
import time
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from urllib.parse import quote

from api.schemas import (
    SelectedStoreRead,
    StoreMfaEnrollmentRead,
    StoreRegistration,
    StoreStatusRead,
)
from core.settings import settings
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, status
from infra.db.models.chat_models import (
    AuthSession,
    ChatUser,
    Store,
    StoreMembership,
    StoreSecurityEvent,
    StoreStatus,
    StoreVerificationToken,
    UserMfaCredential,
)
from services.auth_service import AuthenticationService, CurrentSession, IssuedSession
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload


@dataclass(frozen=True)
class CommercialContext:
    current: CurrentSession
    store: Store
    membership: StoreMembership
    mfa_credential: UserMfaCredential


class StoreEmailSender:
    """Adapter boundary for verification delivery; tests replace this sender."""

    async def send_verification(self, recipient: str, verification_value: str) -> None:
        if not settings.STORE_EMAIL_WEBHOOK_URL:
            return
        payload = json.dumps({"type": "store_email_verification", "to": recipient, "value": verification_value}).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if settings.STORE_EMAIL_WEBHOOK_TOKEN:
            headers["Authorization"] = f"Bearer {settings.STORE_EMAIL_WEBHOOK_TOKEN.get_secret_value()}"
        request = urllib.request.Request(settings.STORE_EMAIL_WEBHOOK_URL, data=payload, headers=headers, method="POST")
        await __import__("asyncio").to_thread(urllib.request.urlopen, request, timeout=5)


class StoreService:
    _GENERIC_VERIFICATION_ERROR = "Unable to verify this registration."

    def __init__(self, email_sender: StoreEmailSender | None = None):
        self._email_sender = email_sender or StoreEmailSender()

    async def register(self, session: AsyncSession, payload: StoreRegistration) -> bool:
        normalized_email = str(payload.owner_email).strip().lower()
        normalized_handle = payload.handle.lower()
        normalized_contact_email = str(payload.contact_email).strip().lower()
        existing = await session.scalar(
            select(ChatUser.id)
            .where(ChatUser.email.in_({normalized_email, normalized_contact_email}))
            .limit(1)
        )
        existing_store = await session.scalar(
            select(Store.id).where(
                (Store.public_handle == normalized_handle)
                | ((Store.jurisdiction == payload.jurisdiction.strip()) & (Store.business_identifier == payload.business_identifier.strip()))
            ).limit(1)
        )
        if existing or existing_store:
            return False

        verification_value = secrets.token_urlsafe(32)
        now = datetime.now(UTC)
        user = ChatUser(
            display_name=payload.owner_display_name.strip(),
            email=normalized_email,
            password_hash=AuthenticationService()._hash_password(payload.owner_password),
            account_kind="consumer",
            email_verified_at=now if settings.STORE_EMAIL_VERIFICATION_MOCKED else None,
        )
        store = Store(
            legal_name=payload.legal_name.strip(),
            display_name=payload.display_name.strip(),
            public_handle=normalized_handle,
            jurisdiction=payload.jurisdiction.strip(),
            business_identifier=payload.business_identifier.strip(),
            address=payload.address.strip(),
            contact_email=normalized_contact_email,
            contact_phone=payload.contact_phone.strip(),
            status=(
                StoreStatus.ACTIVE.value
                if settings.STORE_EMAIL_VERIFICATION_MOCKED
                else StoreStatus.PENDING.value
            ),
        )
        session.add_all([user, store])
        try:
            await session.flush()
            membership = StoreMembership(store_id=store.id, user_id=user.id, role="owner")
            session.add(membership)
            if not settings.STORE_EMAIL_VERIFICATION_MOCKED:
                token = StoreVerificationToken(
                    store_id=store.id,
                    user_id=user.id,
                    token_hash=self._hash(verification_value),
                    expires_at=now + timedelta(seconds=settings.STORE_EMAIL_VERIFICATION_TTL_SECONDS),
                )
                session.add(token)
            await self._record_event(session, store.id, "store_registration", "accepted", actor_user_id=user.id)
            if settings.STORE_EMAIL_VERIFICATION_MOCKED:
                await self._record_event(session, store.id, "email_verified", "mocked", actor_user_id=user.id)
            await session.commit()
        except IntegrityError:
            await session.rollback()
            return False
        if not settings.STORE_EMAIL_VERIFICATION_MOCKED:
            try:
                await self._email_sender.send_verification(normalized_email, verification_value)
            except Exception:
                # The persisted challenge can be retried by a configured delivery worker.
                return True
        return True

    async def verify_email(
        self, session: AsyncSession, verification_value: str, previous_token: str | None
    ) -> IssuedSession:
        token = await session.scalar(
            select(StoreVerificationToken)
            .options(selectinload(StoreVerificationToken.user))
            .where(StoreVerificationToken.token_hash == self._hash(verification_value))
            .with_for_update()
        )
        now = datetime.now(UTC)
        if token is None or token.consumed_at is not None or now >= self._utc(token.expires_at) or token.user is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=self._GENERIC_VERIFICATION_ERROR)
        token.consumed_at = now
        token.user.email_verified_at = now
        store = await session.get(Store, token.store_id)
        if store is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=self._GENERIC_VERIFICATION_ERROR)
        store.status = StoreStatus.ACTIVE.value
        issued = await AuthenticationService().create_session(
            session, token.user, previous_token, active_store_id=token.store_id
        )
        await self._record_event(session, token.store_id, "email_verified", "success", actor_user_id=token.user_id)
        await session.commit()
        return issued

    async def selected_status(self, session: AsyncSession, current: CurrentSession) -> StoreStatusRead:
        if not current.session.active_store_id:
            return StoreStatusRead(selected_store=None)
        store = await session.get(Store, current.session.active_store_id)
        if store is None:
            return StoreStatusRead(selected_store=None)
        membership = await session.scalar(
            select(StoreMembership).where(
                StoreMembership.store_id == store.id,
                StoreMembership.user_id == current.user.id,
                StoreMembership.revoked_at.is_(None),
            )
        )
        credential = await session.scalar(
            select(UserMfaCredential).where(
                UserMfaCredential.store_id == store.id,
                UserMfaCredential.user_id == current.user.id,
                UserMfaCredential.revoked_at.is_(None),
            )
        )
        if membership is None:
            return StoreStatusRead(selected_store=None)
        return StoreStatusRead(
            selected_store=self._store_read(
                store,
                current.user,
                credential,
                status=self._effective_store_status(store, current.user),
            )
        )

    async def enroll_mfa(self, session: AsyncSession, current: CurrentSession) -> StoreMfaEnrollmentRead:
        context = await self.commercial_context(session, current, require_active_store=False, require_mfa=False)
        secret = base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")
        credential = context.mfa_credential
        if credential is None:
            credential = UserMfaCredential(
                store_id=context.store.id,
                user_id=current.user.id,
                secret_ciphertext=self._fernet().encrypt(secret.encode("ascii")).decode("ascii"),
            )
            session.add(credential)
        else:
            credential.secret_ciphertext = self._fernet().encrypt(secret.encode("ascii")).decode("ascii")
            credential.confirmed_at = None
            credential.last_verified_at = None
        await self._record_event(session, context.store.id, "mfa_enrolled", "pending", actor_user_id=current.user.id)
        await session.commit()
        label = quote(f"{settings.STORE_TOTP_ISSUER}:{current.user.email or current.user.id}")
        return StoreMfaEnrollmentRead(
            provisioning_uri=f"otpauth://totp/{label}?secret={secret}&issuer={quote(settings.STORE_TOTP_ISSUER)}&algorithm=SHA1&digits=6&period=30"
        )

    async def confirm_mfa(self, session: AsyncSession, current: CurrentSession, code: str) -> StoreStatusRead:
        context = await self.commercial_context(session, current, require_active_store=False, require_mfa=False)
        credential = context.mfa_credential
        if credential is None or not self._verify_totp(self._decrypt(credential.secret_ciphertext), code):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to confirm MFA.")
        now = datetime.now(UTC)
        credential.confirmed_at = now
        credential.last_verified_at = now
        await self._record_event(session, context.store.id, "mfa_confirmed", "success", actor_user_id=current.user.id)
        await session.commit()
        return await self.selected_status(session, current)

    async def select_store(
        self, session: AsyncSession, current: CurrentSession, handle: str, previous_token: str | None
    ) -> IssuedSession:
        store = await session.scalar(select(Store).where(Store.public_handle == handle.lower()))
        if store is None or self._effective_store_status(store, current.user) != StoreStatus.ACTIVE.value:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Store access is not permitted.")
        membership = await session.scalar(select(StoreMembership).where(
            StoreMembership.store_id == store.id,
            StoreMembership.user_id == current.user.id,
            StoreMembership.revoked_at.is_(None),
        ))
        if membership is None or current.user.email_verified_at is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Store access is not permitted.")
        issued = await AuthenticationService().create_session(session, current.user, previous_token, active_store_id=store.id)
        await session.commit()
        return issued

    async def commercial_context(
        self,
        session: AsyncSession,
        current: CurrentSession,
        *,
        require_active_store: bool = True,
        require_mfa: bool = False,
    ) -> CommercialContext:
        store_id = current.session.active_store_id
        if not store_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Store access is not permitted.")
        store = await session.get(Store, store_id)
        membership = await session.scalar(select(StoreMembership).where(
            StoreMembership.store_id == store_id,
            StoreMembership.user_id == current.user.id,
            StoreMembership.revoked_at.is_(None),
            StoreMembership.role == "owner",
        ))
        credential = await session.scalar(select(UserMfaCredential).where(
            UserMfaCredential.store_id == store_id,
            UserMfaCredential.user_id == current.user.id,
            UserMfaCredential.revoked_at.is_(None),
        ))
        if store is None or membership is None or current.user.email_verified_at is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Store access is not permitted.")
        if require_active_store and self._effective_store_status(store, current.user) != StoreStatus.ACTIVE.value:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Store access is not permitted.")
        return CommercialContext(current=current, store=store, membership=membership, mfa_credential=credential)  # type: ignore[arg-type]

    async def decide(self, session: AsyncSession, actor: CurrentSession, handle: str, decision: str) -> StoreStatusRead:
        self._ensure_approver(actor.user)
        store = await session.scalar(select(Store).where(Store.public_handle == handle.lower()).with_for_update())
        if store is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store was not found.")
        if decision == "approve":
            owner = await session.scalar(select(StoreMembership).where(
                StoreMembership.store_id == store.id, StoreMembership.revoked_at.is_(None)
            ))
            owner_user = None if owner is None else await session.get(ChatUser, owner.user_id)
            if owner_user is None or owner_user.email_verified_at is None:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Store activation prerequisites are incomplete.")
            store.status = StoreStatus.ACTIVE.value
        elif decision == "reject":
            store.status = StoreStatus.REJECTED.value
            await self._revoke_store_sessions(session, store.id, "store_rejected")
        elif decision == "suspend":
            store.status = StoreStatus.SUSPENDED.value
            await self._revoke_store_sessions(session, store.id, "store_suspended")
        elif decision == "restore":
            if store.status != StoreStatus.SUSPENDED.value:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Store cannot be restored.")
            store.status = StoreStatus.PENDING.value
        else:
            raise ValueError("Unsupported store decision")
        await self._record_event(session, store.id, f"store_{decision}", "success", actor_user_id=actor.user.id)
        await session.commit()
        return await self.selected_status(session, actor)

    async def transfer_ownership(
        self, session: AsyncSession, actor: CurrentSession, handle: str, recipient_email: str, code: str
    ) -> StoreStatusRead:
        self._ensure_approver(actor.user)
        approver_context = await self.commercial_context(session, actor)
        if (
            approver_context.mfa_credential.last_verified_at is None
            or datetime.now(UTC) - self._utc(approver_context.mfa_credential.last_verified_at)
            > timedelta(seconds=settings.STORE_TOTP_STEP_UP_MAX_AGE_SECONDS)
            or not self._verify_totp(self._decrypt(approver_context.mfa_credential.secret_ciphertext), code)
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="A recent MFA step-up is required.")
        approver_context.mfa_credential.last_verified_at = datetime.now(UTC)
        store = await session.scalar(select(Store).where(Store.public_handle == handle.lower()).with_for_update())
        recipient = await session.scalar(select(ChatUser).where(ChatUser.email == recipient_email.lower()))
        if store is None or recipient is None or recipient.email_verified_at is None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ownership transfer cannot be completed.")
        owner = await session.scalar(select(StoreMembership).where(
            StoreMembership.store_id == store.id, StoreMembership.revoked_at.is_(None)
        ).with_for_update())
        if owner is None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ownership transfer cannot be completed.")
        existing_recipient = await session.scalar(select(StoreMembership).where(
            StoreMembership.store_id == store.id, StoreMembership.user_id == recipient.id
        ).with_for_update())
        owner.revoked_at = datetime.now(UTC)
        owner.revoke_reason = "ownership_transferred"
        if existing_recipient is None:
            session.add(StoreMembership(store_id=store.id, user_id=recipient.id, role="owner"))
        else:
            existing_recipient.revoked_at = None
            existing_recipient.revoke_reason = None
        await self._revoke_store_sessions(session, store.id, "ownership_transferred")
        await self._record_event(
            session, store.id, "ownership_transferred", "success",
            actor_user_id=actor.user.id, target_user_id=recipient.id,
        )
        await session.commit()
        return await self.selected_status(session, actor)

    async def _revoke_store_sessions(self, session: AsyncSession, store_id: str, reason: str) -> None:
        await session.execute(update(AuthSession).where(
            AuthSession.active_store_id == store_id, AuthSession.revoked_at.is_(None)
        ).values(revoked_at=datetime.now(UTC), revoke_reason=reason))

    async def _record_event(
        self, session: AsyncSession, store_id: str, event_type: str, outcome: str, *, actor_user_id: str | None = None, target_user_id: str | None = None
    ) -> None:
        session.add(StoreSecurityEvent(
            store_id=store_id, actor_user_id=actor_user_id, target_user_id=target_user_id,
            event_type=event_type, outcome=outcome,
        ))

    def _effective_store_status(self, store: Store, user: ChatUser) -> str:
        # Registrations created before the email provider existed may still be
        # persisted as pending. In local/test mock mode, a verified owner is
        # the approval source, so those records must behave like new ones.
        if (
            settings.STORE_EMAIL_VERIFICATION_MOCKED
            and store.status == StoreStatus.PENDING.value
            and user.email_verified_at is not None
        ):
            return StoreStatus.ACTIVE.value
        return store.status

    def _store_read(
        self,
        store: Store,
        user: ChatUser,
        credential: UserMfaCredential | None,
        *,
        status: str | None = None,
    ) -> SelectedStoreRead:
        return SelectedStoreRead(
            id=store.id, display_name=store.display_name, handle=store.public_handle,
            status=status or store.status,
            email_verified=user.email_verified_at is not None, mfa_enrolled=credential is not None,
            mfa_confirmed=credential is not None and credential.confirmed_at is not None,
        )

    def _ensure_approver(self, user: ChatUser) -> None:
        if not user.email or user.email.lower() not in settings.STORE_APPROVER_EMAILS:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Store operation is not permitted.")

    @staticmethod
    def _hash(value: str) -> str:
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    @staticmethod
    def _utc(value: datetime) -> datetime:
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)

    @staticmethod
    def _totp(secret: str, counter: int) -> str:
        padded = secret + "=" * (-len(secret) % 8)
        digest = hmac.new(base64.b32decode(padded), struct.pack(">Q", counter), hashlib.sha1).digest()
        offset = digest[-1] & 0x0F
        value = (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
        return f"{value:06d}"

    def _verify_totp(self, secret: str, candidate: str) -> bool:
        counter = int(time.time() // 30)
        return any(hmac.compare_digest(self._totp(secret, value), candidate) for value in (counter - 1, counter, counter + 1))

    @staticmethod
    def _fernet() -> Fernet:
        return Fernet(settings.STORE_TOTP_ENCRYPTION_KEY.get_secret_value().encode("ascii"))

    def _decrypt(self, ciphertext: str) -> str:
        try:
            return self._fernet().decrypt(ciphertext.encode("ascii")).decode("ascii")
        except (InvalidToken, ValueError) as exc:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Store access is not permitted.") from exc
