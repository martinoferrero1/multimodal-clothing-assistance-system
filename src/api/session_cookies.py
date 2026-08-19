from datetime import datetime

from core.settings import settings
from fastapi import Response


def issue_session_cookie(response: Response, token: str, absolute_expires_at: datetime) -> None:
    max_age = max(0, int((absolute_expires_at - datetime.now(absolute_expires_at.tzinfo)).total_seconds()))
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME, value=token, max_age=max_age, path="/",
        httponly=True, secure=settings.SESSION_COOKIE_SECURE, samesite=settings.SESSION_COOKIE_SAMESITE,
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME, path="/", httponly=True,
        secure=settings.SESSION_COOKIE_SECURE, samesite=settings.SESSION_COOKIE_SAMESITE,
    )


def session_cookie_deletion_header() -> str:
    response = Response()
    clear_session_cookie(response)
    return response.headers["set-cookie"]
