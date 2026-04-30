from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from core.settings import settings
from services.business_qa.document_loader import (
    BusinessKnowledgeDocumentLoader,
    KnowledgeChunk,
    KnowledgeDocument,
    get_business_knowledge_document_loader,
)
from utils.models import get_embedding_model


class BusinessKnowledgeIngestionService:
    def __init__(
        self,
        document_loader: BusinessKnowledgeDocumentLoader | None = None,
    ) -> None:
        self._document_loader = document_loader or get_business_knowledge_document_loader()

    @property
    def document_loader(self) -> BusinessKnowledgeDocumentLoader:
        return self._document_loader

    def ensure_index_is_current(self) -> dict[str, Any] | None:
        documents = self._document_loader.load_documents()
        if not documents:
            return None

        current_signature = self._document_signature_payload(documents)
        manifest = self._load_manifest()
        if (
            manifest is not None
            and manifest.get("signature") == current_signature
            and self._index_path().exists()
        ):
            return manifest

        return self.rebuild_index(documents)

    def rebuild_index(self, documents: list[KnowledgeDocument] | None = None) -> dict[str, Any]:
        documents = documents or self._document_loader.load_documents()
        chunks = self._document_loader.build_chunks(documents)
        manifest = {
            "signature": self._document_signature_payload(documents),
            "chunk_count": len(chunks),
            "chunks": [
                {
                    "chunk_id": chunk.chunk_id,
                    "document_id": chunk.document_id,
                    "document_name": chunk.document_name,
                    "content": chunk.content,
                }
                for chunk in chunks
            ],
        }

        index_dir = self._index_dir()
        index_dir.mkdir(parents=True, exist_ok=True)

        if chunks:
            faiss_module = self._require_faiss()
            vectors = self._embed_chunks(chunks)
            vector_matrix = self._to_normalized_matrix(vectors)
            index = faiss_module.IndexFlatIP(vector_matrix.shape[1])
            index.add(vector_matrix)
            faiss_module.write_index(index, str(self._index_path()))

        self._manifest_path().write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return manifest

    def _embed_chunks(self, chunks: list[KnowledgeChunk]) -> list[list[float]]:
        embedding_model = get_embedding_model()
        texts = [chunk.content for chunk in chunks]
        if hasattr(embedding_model, "embed_documents"):
            return embedding_model.embed_documents(texts)
        return [embedding_model.embed_query(text) for text in texts]

    def _to_normalized_matrix(self, vectors: list[list[float]]):
        numpy_module = self._require_numpy()
        matrix = numpy_module.array(vectors, dtype="float32")
        norms = numpy_module.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return matrix / norms

    def _document_signature_payload(self, documents: list[KnowledgeDocument]) -> list[list[Any]]:
        return [
            [document.document_id, document.modified_at]
            for document in documents
        ]

    def _load_manifest(self) -> dict[str, Any] | None:
        manifest_path = self._manifest_path()
        if not manifest_path.exists():
            return None
        return json.loads(manifest_path.read_text(encoding="utf-8"))

    def _index_dir(self) -> Path:
        return Path(settings.BUSINESS_FAISS_INDEX_DIR)

    def _index_path(self) -> Path:
        return self._index_dir() / "business_knowledge.faiss"

    def _manifest_path(self) -> Path:
        return self._index_dir() / "business_knowledge_manifest.json"

    def _require_faiss(self):
        try:
            import faiss
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "FAISS is not installed. Install `faiss-cpu` in the project environment to use business_qa retrieval."
            ) from exc
        return faiss

    def _require_numpy(self):
        try:
            import numpy
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "NumPy is not installed. Install `numpy` in the project environment to use business_qa retrieval."
            ) from exc
        return numpy


_ingestion_service = BusinessKnowledgeIngestionService()


def get_business_knowledge_ingestion_service() -> BusinessKnowledgeIngestionService:
    return _ingestion_service
