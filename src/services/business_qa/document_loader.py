from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from core.settings import settings


@dataclass(frozen=True)
class KnowledgeDocument:
    document_id: str
    document_name: str
    path: Path
    content: str
    modified_at: float


@dataclass(frozen=True)
class KnowledgeChunk:
    chunk_id: str
    document_id: str
    document_name: str
    content: str


class BusinessKnowledgeDocumentLoader:
    def load_documents(self) -> list[KnowledgeDocument]:
        knowledge_dir = Path(settings.BUSINESS_KNOWLEDGE_DIR)
        if not knowledge_dir.exists():
            return []

        documents: list[KnowledgeDocument] = []
        for path in sorted(knowledge_dir.glob(settings.BUSINESS_KNOWLEDGE_GLOB)):
            if not path.is_file():
                continue

            content = path.read_text(encoding="utf-8").strip()
            if not content:
                continue

            documents.append(
                KnowledgeDocument(
                    document_id=self._document_id_from_path(path),
                    document_name=path.name,
                    path=path,
                    content=content,
                    modified_at=path.stat().st_mtime,
                )
            )

        return documents

    def build_signature(self, documents: list[KnowledgeDocument]) -> tuple[tuple[str, float], ...]:
        return tuple((document.document_id, document.modified_at) for document in documents)

    def build_chunks(self, documents: list[KnowledgeDocument]) -> list[KnowledgeChunk]:
        chunks: list[KnowledgeChunk] = []

        for document in documents:
            for index, content in enumerate(self._split_text(document.content), start=1):
                chunks.append(
                    KnowledgeChunk(
                        chunk_id=f"{document.document_id}#chunk-{index}",
                        document_id=document.document_id,
                        document_name=document.document_name,
                        content=content,
                    )
                )

        return chunks

    def _document_id_from_path(self, path: Path) -> str:
        suffix = ".knowledge.md"
        if path.name.endswith(suffix):
            return path.name[: -len(suffix)]
        return path.stem

    def _split_text(self, text: str) -> list[str]:
        cleaned = " ".join(text.split())
        if not cleaned:
            return []

        if len(cleaned) <= settings.BUSINESS_RAG_CHUNK_SIZE:
            return [cleaned]

        chunks: list[str] = []
        start = 0
        chunk_size = settings.BUSINESS_RAG_CHUNK_SIZE
        overlap = min(settings.BUSINESS_RAG_CHUNK_OVERLAP, max(0, chunk_size - 1))

        while start < len(cleaned):
            end = min(len(cleaned), start + chunk_size)
            if end < len(cleaned):
                split_at = cleaned.rfind(" ", start, end)
                if split_at > start + int(chunk_size * 0.6):
                    end = split_at

            chunk = cleaned[start:end].strip()
            if chunk:
                chunks.append(chunk)

            if end >= len(cleaned):
                break

            start = max(end - overlap, start + 1)

        return chunks


_document_loader = BusinessKnowledgeDocumentLoader()


def get_business_knowledge_document_loader() -> BusinessKnowledgeDocumentLoader:
    return _document_loader
