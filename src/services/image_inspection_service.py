from __future__ import annotations

import io
import warnings
from dataclasses import dataclass

from PIL import Image, UnidentifiedImageError

from core.settings import Settings, settings


_FORMAT_MIME_TYPES = {
    "GIF": "image/gif",
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}


@dataclass(frozen=True)
class ImageMetadata:
    content_type: str
    width: int
    height: int
    frame_count: int
    total_pixels: int


class ImageInspectionError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def inspect_image(
    data: bytes,
    declared_content_type: str | None,
    configured: Settings = settings,
    *,
    allowed_content_types: list[str] | None = None,
) -> ImageMetadata:
    """Validate bytes before they are encoded, stored, or sent to a provider."""
    declared = (declared_content_type or "").split(";", maxsplit=1)[0].strip().lower()
    allowed = set(allowed_content_types or configured.CHAT_IMAGE_ALLOWED_MIME_TYPES)
    if declared not in allowed:
        raise ImageInspectionError(415, "Only supported image formats are accepted.")
    if not data:
        raise ImageInspectionError(422, "The image could not be validated.")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as image:
                detected = _FORMAT_MIME_TYPES.get(image.format or "")
                if detected is None or detected not in allowed or declared != detected:
                    raise ImageInspectionError(415, "The declared image type does not match its content.")
                image.verify()
                if not _has_complete_container(data, image.format or ""):
                    raise ImageInspectionError(422, "The image could not be validated.")
            with Image.open(io.BytesIO(data)) as image:
                width, height = image.size
                frame_count = getattr(image, "n_frames", 1)
                if width > configured.MAX_CHAT_IMAGE_WIDTH or height > configured.MAX_CHAT_IMAGE_HEIGHT:
                    raise ImageInspectionError(413, "Image dimensions exceed the allowed limit.")
                if frame_count > configured.MAX_CHAT_IMAGE_FRAMES:
                    raise ImageInspectionError(415, "Animated images are not supported.")
                total_pixels = 0
                for frame_index in range(frame_count):
                    image.seek(frame_index)
                    frame_width, frame_height = image.size
                    frame_pixels = frame_width * frame_height
                    if frame_pixels > configured.MAX_CHAT_IMAGE_PIXELS_PER_FRAME:
                        raise ImageInspectionError(413, "Image pixels exceed the allowed limit.")
                    total_pixels += frame_pixels
                    if total_pixels > configured.MAX_CHAT_IMAGE_TOTAL_PIXELS:
                        raise ImageInspectionError(413, "Image pixels exceed the allowed limit.")
                    image.load()
                return ImageMetadata(detected, width, height, frame_count, total_pixels)
    except ImageInspectionError:
        raise
    except (Image.DecompressionBombWarning, Image.DecompressionBombError):
        raise ImageInspectionError(413, "Image pixels exceed the allowed limit.") from None
    except UnidentifiedImageError:
        raise ImageInspectionError(415, "Only supported image formats are accepted.") from None
    except (OSError, ValueError, SyntaxError):
        raise ImageInspectionError(422, "The image could not be validated.") from None


def _has_complete_container(data: bytes, image_format: str) -> bool:
    if image_format == "PNG":
        return data.endswith(b"IEND\xaeB`\x82")
    if image_format == "JPEG":
        return data.endswith(b"\xff\xd9")
    if image_format == "GIF":
        return data.endswith(b";")
    if image_format == "WEBP":
        return len(data) >= 12 and data[:4] == b"RIFF" and 8 + int.from_bytes(data[4:8], "little") == len(data)
    return False
