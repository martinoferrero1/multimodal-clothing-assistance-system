from __future__ import annotations

import io

import pytest
from PIL import Image

from core.settings import Settings
from services.image_inspection_service import ImageInspectionError, inspect_image


def image_bytes(image_format: str, *, size: tuple[int, int] = (8, 8), frames: int = 1) -> bytes:
    images = [Image.new("RGB", size, color=(10 + index, 20, 30)) for index in range(frames)]
    buffer = io.BytesIO()
    images[0].save(
        buffer,
        format=image_format,
        save_all=frames > 1,
        append_images=images[1:],
    )
    return buffer.getvalue()


@pytest.mark.parametrize(
    ("image_format", "content_type"),
    [("JPEG", "image/jpeg"), ("PNG", "image/png"), ("WEBP", "image/webp"), ("GIF", "image/gif")],
)
def test_inspector_accepts_supported_static_images(image_format: str, content_type: str) -> None:
    metadata = inspect_image(image_bytes(image_format), content_type)

    assert metadata.content_type == content_type
    assert metadata.frame_count == 1


@pytest.mark.parametrize(
    ("data", "content_type", "status_code"),
    [
        (b"not-an-image", "image/png", 415),
        (b"", "image/png", 422),
        (image_bytes("PNG"), "image/jpeg", 415),
        (image_bytes("PNG")[:-4], "image/png", 422),
    ],
)
def test_inspector_rejects_spoofed_and_corrupt_images(data: bytes, content_type: str, status_code: int) -> None:
    with pytest.raises(ImageInspectionError) as error:
        inspect_image(data, content_type)

    assert error.value.status_code == status_code


def test_inspector_rejects_oversized_dimensions_and_animation() -> None:
    configured = Settings(
        _env_file=None,
        APP_ENV="test",
        MAX_CHAT_IMAGE_WIDTH=4,
        MAX_CHAT_IMAGE_HEIGHT=4,
        MAX_CHAT_IMAGE_PIXELS_PER_FRAME=16,
        MAX_CHAT_IMAGE_TOTAL_PIXELS=16,
    )
    with pytest.raises(ImageInspectionError, match="dimensions"):
        inspect_image(image_bytes("PNG", size=(5, 4)), "image/png", configured)
    with pytest.raises(ImageInspectionError, match="Animated"):
        inspect_image(image_bytes("GIF", frames=2), "image/gif")
