from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from api.schemas import StoreRegistration, UserLogin
from core.settings import settings
from infra.db.models.base import Base
from infra.db.models.chat_models import ChatUser, Store, StoreVerificationToken
from services.auth_service import AuthenticationService, CurrentSession
from services.store_service import StoreEmailSender, StoreService


class RecordingEmailSender(StoreEmailSender):
    def __init__(self) -> None:
        self.messages: list[tuple[str, str]] = []

    async def send_verification(self, recipient: str, verification_value: str) -> None:
        self.messages.append((recipient, verification_value))


def _payload(**overrides: str) -> StoreRegistration:
    values = {
        "owner_display_name": "Store Owner",
        "owner_email": "owner@example.com",
        "owner_password": "correct-horse-battery",
        "legal_name": "Store Owner LLC",
        "display_name": "Store Owner",
        "handle": "store-owner",
        "jurisdiction": "ES",
        "business_identifier": "ES-12345",
        "address": "Main Street 1",
        "contact_email": "contact@example.com",
        "contact_phone": "+34123456789",
    }
    values.update(overrides)
    return StoreRegistration(**values)


def test_store_registration_verification_mfa_and_activation_are_transactional(monkeypatch) -> None:
    async def exercise() -> None:
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        sender = RecordingEmailSender()
        service = StoreService(sender)
        monkeypatch.setattr(settings, "STORE_EMAIL_VERIFICATION_MOCKED", False)
        monkeypatch.setattr(settings, "STORE_APPROVER_EMAILS", ["owner@example.com"])

        async with session_factory() as session:
            assert await service.register(session, _payload())
            assert not await service.register(session, _payload())
            assert await session.scalar(select(func.count()).select_from(ChatUser)) == 1
            assert await session.scalar(select(func.count()).select_from(Store)) == 1
            assert len(sender.messages) == 1

            issued = await service.verify_email(session, sender.messages[0][1], None)
            current = CurrentSession(user=issued.user, session=issued.session)
            pending = await service.selected_status(session, current)
            assert pending.selected_store is not None
            assert pending.selected_store.status == "active"
            assert pending.selected_store.email_verified

            enrollment = await service.enroll_mfa(session, current)
            secret = parse_qs(urlsplit(enrollment.provisioning_uri).query)["secret"][0]
            code = service._totp(secret, int(__import__("time").time() // 30))
            confirmed = await service.confirm_mfa(session, current, code)
            assert confirmed.selected_store is not None
            assert confirmed.selected_store.mfa_confirmed

            activated = await service.decide(session, current, "store-owner", "approve")
            assert activated.selected_store is not None
            assert activated.selected_store.status == "active"

            recipient = ChatUser(
                display_name="Replacement Owner", email="replacement@example.com",
                password_hash="not-used", email_verified_at=datetime.now(UTC),
            )
            session.add(recipient)
            await session.commit()
            transfer_code = service._totp(secret, int(__import__("time").time() // 30))
            await service.transfer_ownership(
                session, current, "store-owner", "replacement@example.com", transfer_code
            )
            await session.refresh(issued.session)
            assert issued.session.revoke_reason == "ownership_transferred"

            recipient_issued = await AuthenticationService().create_session(session, recipient, None)
            await session.commit()
            recipient_current = CurrentSession(user=recipient, session=recipient_issued.session)
            selected_issued = await service.select_store(
                session, recipient_current, "store-owner", recipient_issued.token
            )
            recipient_current = CurrentSession(user=recipient, session=selected_issued.session)
            recipient_enrollment = await service.enroll_mfa(session, recipient_current)
            recipient_secret = parse_qs(urlsplit(recipient_enrollment.provisioning_uri).query)["secret"][0]
            await service.confirm_mfa(
                session,
                recipient_current,
                service._totp(recipient_secret, int(__import__("time").time() // 30)),
            )
            assert (await service.commercial_context(session, recipient_current)).store.public_handle == "store-owner"
            monkeypatch.setattr(settings, "STORE_APPROVER_EMAILS", ["replacement@example.com"])

            other_store = Store(
                legal_name="Other LLC", display_name="Other", public_handle="other-store",
                jurisdiction="ES", business_identifier="ES-OTHER", address="Other Street 1",
                contact_email="other@example.com", contact_phone="+34999999999",
            )
            session.add(other_store)
            await session.commit()
            with pytest.raises(HTTPException, match="Store access is not permitted"):
                await service.select_store(session, current, "other-store", None)

            await service.decide(session, recipient_current, "store-owner", "suspend")
            await session.refresh(selected_issued.session)
            assert selected_issued.session.revoked_at is not None
            assert selected_issued.session.revoke_reason == "store_suspended"

            with pytest.raises(HTTPException):
                await service.verify_email(session, sender.messages[0][1], None)

        await engine.dispose()

    asyncio.run(exercise())


def test_expired_verification_does_not_issue_a_session(monkeypatch) -> None:
    async def exercise() -> None:
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        sender = RecordingEmailSender()
        service = StoreService(sender)
        monkeypatch.setattr(settings, "STORE_EMAIL_VERIFICATION_MOCKED", False)
        async with session_factory() as session:
            assert await service.register(session, _payload())
            token = await session.scalar(select(StoreVerificationToken))
            assert token is not None
            token.expires_at = datetime.now(UTC) - timedelta(seconds=1)
            await session.commit()
            with pytest.raises(HTTPException):
                await service.verify_email(session, sender.messages[0][1], None)
        await engine.dispose()


def test_mocked_store_email_verification_allows_later_store_login_and_rejects_user_email_collision(monkeypatch) -> None:
    async def exercise() -> None:
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        sender = RecordingEmailSender()
        service = StoreService(sender)
        monkeypatch.setattr(settings, "STORE_EMAIL_VERIFICATION_MOCKED", True)

        async with session_factory() as session:
            assert await service.register(session, _payload())
            assert sender.messages == []
            assert await session.scalar(select(StoreVerificationToken)) is None

            legacy_store = await session.scalar(select(Store))
            assert legacy_store is not None
            legacy_store.status = "pending"
            await session.commit()

            user = await session.scalar(select(ChatUser).where(ChatUser.email == "owner@example.com"))
            assert user is not None
            assert user.email_verified_at is not None

            issued = await AuthenticationService().login_user(
                session, UserLogin(email="owner@example.com", password="correct-horse-battery")
            )
            assert issued.session.active_store_id is not None
            current = CurrentSession(user=issued.user, session=issued.session)
            selected = await service.selected_status(session, current)
            assert selected.selected_store is not None
            assert selected.selected_store.handle == "store-owner"
            assert selected.selected_store.status == "active"
            assert selected.selected_store.email_verified

            monkeypatch.setattr(settings, "STORE_APPROVER_EMAILS", ["owner@example.com"])
            activated = await service.decide(session, current, "store-owner", "approve")
            assert activated.selected_store is not None
            assert activated.selected_store.status == "active"
            assert (await service.commercial_context(session, current)).store.public_handle == "store-owner"

            collision = await service.register(
                session,
                _payload(handle="another-store", business_identifier="ES-999"),
            )
            assert collision is False
            assert await session.scalar(select(func.count()).select_from(Store)) == 1

        await engine.dispose()

    asyncio.run(exercise())


def test_store_registration_rolls_back_every_identity_record_on_write_failure() -> None:
    async def exercise() -> None:
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as session:
            service = StoreService(RecordingEmailSender())
            async def failing_commit(*args, **kwargs):
                raise IntegrityError("forced", {}, RuntimeError("forced"))

            session.commit = failing_commit  # type: ignore[method-assign]
            assert not await service.register(session, _payload())
            assert await session.scalar(select(func.count()).select_from(ChatUser)) == 0
            assert await session.scalar(select(func.count()).select_from(Store)) == 0
        await engine.dispose()

    asyncio.run(exercise())
