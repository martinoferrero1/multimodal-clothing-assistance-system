from __future__ import annotations

import base64
from pathlib import Path

from api.schemas import MessageImageAttachment
from core.settings import Settings, settings
from fastapi import HTTPException, UploadFile, status
from services.image_inspection_service import ImageInspectionError, inspect_image


async def read_image_attachments(
    images: list[UploadFile], configured: Settings = settings
) -> list[MessageImageAttachment]:
    if len(images) > configured.MAX_CHAT_IMAGE_ATTACHMENTS:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"You can upload up to {configured.MAX_CHAT_IMAGE_ATTACHMENTS} images per message.",
        )

    attachments: list[MessageImageAttachment] = []
    total_bytes = 0
    for image in images:
        content_type = (image.content_type or "").split(";", maxsplit=1)[0].lower()
        data = await image.read(configured.MAX_CHAT_IMAGE_UPLOAD_BYTES + 1)
        if len(data) > configured.MAX_CHAT_IMAGE_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail="Each image exceeds the allowed size.",
            )
        total_bytes += len(data)
        if total_bytes > configured.MAX_CHAT_IMAGE_TOTAL_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail="Image attachments exceed the allowed total size.",
            )
        try:
            metadata = inspect_image(data, content_type, configured)
        except ImageInspectionError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None
        attachments.append(
            MessageImageAttachment(
                filename=clean_image_filename(image.filename),
                content_type=metadata.content_type,
                data_url=f"data:{metadata.content_type};base64,{base64.b64encode(data).decode('ascii')}",
            )
        )
    return attachments


def clean_image_filename(filename: str | None) -> str:
    clean_name = Path(filename or "uploaded-image").name.strip()
    return clean_name[:160] or "uploaded-image"
