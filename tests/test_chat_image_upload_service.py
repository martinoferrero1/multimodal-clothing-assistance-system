from __future__ import annotations

import asyncio
import io

import pytest
from fastapi import HTTPException, UploadFile
from PIL import Image
from starlette.datastructures import Headers

from core.settings import Settings
from services.chat_image_upload_service import read_image_attachments


def png_bytes(size: tuple[int, int] = (8, 8)) -> bytes:
    output = io.BytesIO()
    Image.new("RGB", size).save(output, format="PNG")
    return output.getvalue()


def upload(data: bytes, content_type: str = "image/png") -> UploadFile:
    return UploadFile(file=io.BytesIO(data), filename="image.png", headers=Headers({"content-type": content_type}))


def configured(**overrides: object) -> Settings:
    values = {
        "APP_ENV": "test",
        "MAX_CHAT_IMAGE_ATTACHMENTS": 2,
        "MAX_CHAT_IMAGE_UPLOAD_BYTES": 200,
        "MAX_CHAT_IMAGE_TOTAL_UPLOAD_BYTES": 250,
        "MAX_CHAT_IMAGE_WIDTH": 32,
        "MAX_CHAT_IMAGE_HEIGHT": 32,
        "MAX_CHAT_IMAGE_PIXELS_PER_FRAME": 1024,
        "MAX_CHAT_IMAGE_TOTAL_PIXELS": 1024,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_upload_reader_accepts_all_valid_attachments_atomically() -> None:
    attachments = asyncio.run(read_image_attachments([upload(png_bytes())], configured()))

    assert len(attachments) == 1
    assert attachments[0].content_type == "image/png"
    assert attachments[0].data_url.startswith("data:image/png;base64,")


@pytest.mark.parametrize(
    ("uploads", "config", "status_code"),
    [
        ([upload(png_bytes()), upload(png_bytes()), upload(png_bytes())], {"MAX_CHAT_IMAGE_ATTACHMENTS": 2}, 413),
        ([upload(b"x" * 201)], {}, 413),
        ([upload(png_bytes(), "image/jpeg")], {}, 415),
        ([upload(b"not-image")], {}, 415),
    ],
)
def test_upload_reader_rejects_invalid_batches(
    uploads: list[UploadFile], config: dict[str, object], status_code: int
) -> None:
    with pytest.raises(HTTPException) as error:
        asyncio.run(read_image_attachments(uploads, configured(**config)))

    assert error.value.status_code == status_code


def test_upload_reader_rejects_aggregate_bytes_before_inspection() -> None:
    data = png_bytes()
    with pytest.raises(HTTPException) as error:
        asyncio.run(read_image_attachments([
            upload(data), upload(data),
        ], configured(
            MAX_CHAT_IMAGE_UPLOAD_BYTES=len(data),
            MAX_CHAT_IMAGE_TOTAL_UPLOAD_BYTES=(len(data) * 2) - 1,
        )))

    assert error.value.status_code == 413


def test_upload_reader_rejects_decompression_bomb_warnings(monkeypatch) -> None:
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 1)
    with pytest.raises(HTTPException) as error:
        asyncio.run(read_image_attachments([upload(png_bytes())], configured()))

    assert error.value.status_code == 413
