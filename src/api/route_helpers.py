from __future__ import annotations

import json
from typing import Iterator

def build_message_preview(content: str | None) -> str | None:
    if not content:
        return None
    compact = " ".join(content.split())
    if not compact:
        return None
    return compact if len(compact) <= 80 else f"{compact[:77].rstrip()}..."


def chunk_text(content: str, chunk_size: int = 120) -> Iterator[str]:
    if not content:
        return
    for index in range(0, len(content), chunk_size):
        yield content[index:index + chunk_size]


def sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
