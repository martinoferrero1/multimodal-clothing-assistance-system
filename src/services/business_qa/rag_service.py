from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
import faiss
import numpy

from core.metaclasses.singleton_meta import SingletonMeta
from core.settings import settings
from schemas.business_qa import BusinessAnswer, BusinessAnswerDraft, BusinessQASource
from services.business_qa.ingestion_service import (
    BusinessKnowledgeIngestionService,
    get_business_knowledge_ingestion_service,
)
from utils.models import get_embedding_model, get_llm_model
from utils.prompts import build_prompt


@dataclass(frozen=True)
class RetrievedChunk:
    chunk: dict[str, Any]
    score: float


class BusinessQARagService(metaclass=SingletonMeta):
    def __init__(
        self,
        ingestion_service: BusinessKnowledgeIngestionService | None = None,
    ) -> None:
        self._ingestion_service = ingestion_service or get_business_knowledge_ingestion_service()
        self._cached_index = None
        self._cached_index_path: str | None = None
        self._cached_index_mtime: float | None = None

    def answer_queries(
        self,
        queries: list[str] | None,
        conversation_summary: str | None = None,
    ) -> list[BusinessAnswer]:
        clean_queries = [query.strip() for query in (queries or []) if query and query.strip()]
        if not clean_queries:
            return []

        documents = self._ingestion_service.document_loader.load_documents()
        if not documents:
            return [self._build_no_knowledge_answer(query) for query in clean_queries]

        try:
            manifest = self._ingestion_service.ensure_index_is_current()
        except RuntimeError as exc:
            return [self._build_backend_unavailable_answer(query, str(exc)) for query in clean_queries]

        if not manifest or not manifest.get("chunks"):
            return [self._build_no_knowledge_answer(query) for query in clean_queries]

        return [
            self._answer_single_query(
                query=query,
                manifest=manifest,
                conversation_summary=conversation_summary,
            )
            for query in clean_queries
        ]

    def _answer_single_query(
        self,
        query: str,
        manifest: dict[str, Any],
        conversation_summary: str | None,
    ) -> BusinessAnswer:
        retrieved_chunks = self._retrieve(query, manifest)
        if not retrieved_chunks:
            return self._build_insufficient_context_answer(query)

        draft = self._generate_answer(
            query=query,
            retrieved_chunks=retrieved_chunks,
            conversation_summary=conversation_summary,
        )
        return BusinessAnswer(
            question=query,
            answer=draft.answer.strip(),
            supporting_sources=[
                BusinessQASource(
                    document_id=item.chunk["document_id"],
                    document_name=item.chunk["document_name"],
                    chunk_id=item.chunk["chunk_id"],
                    score=round(item.score, 4),
                    excerpt=self._short_excerpt(item.chunk["content"]),
                )
                for item in retrieved_chunks
            ],
            used_fallback=False,
        )

    def _generate_answer(
        self,
        query: str,
        retrieved_chunks: list[RetrievedChunk],
        conversation_summary: str | None,
    ) -> BusinessAnswerDraft:
        sys_prompt = build_prompt(
            base_prompt_path="src/prompts/business_qa/system_prompt.txt",
            examples_prompt_path=None,
            include_examples=False,
        )
        llm = get_llm_model(is_supervisor=False).with_structured_output(BusinessAnswerDraft)
        context_blocks = [
            (
                f"[{item.chunk['chunk_id']}] source={item.chunk['document_name']} "
                f"score={item.score:.3f}\n{item.chunk['content']}"
            )
            for item in retrieved_chunks
        ]
        messages = [
            SystemMessage(content=sys_prompt),
            SystemMessage(
                content=(
                    f"Conversation summary: {conversation_summary or 'None'}\n\n"
                    "Retrieved business knowledge:\n\n"
                    + "\n\n".join(context_blocks)
                )
            ),
            HumanMessage(content=query),
        ]
        return llm.invoke(messages)

    def _retrieve(
        self,
        query: str,
        manifest: dict[str, Any],
    ) -> list[RetrievedChunk]:
        index = self._load_index()
        if index is None or index.ntotal == 0:
            return []

        query_vector = self._embed_query(query)
        if query_vector is None:
            return []

        query_matrix = numpy.array([query_vector], dtype="float32")
        query_matrix = self._normalize_matrix(query_matrix)

        search_k = min(max(settings.BUSINESS_RAG_TOP_K * 3, settings.BUSINESS_RAG_TOP_K), index.ntotal)
        scores, indices = index.search(query_matrix, search_k)

        ranked_chunks: list[RetrievedChunk] = []
        chunks = manifest.get("chunks", [])
        for raw_score, raw_index in zip(scores[0], indices[0]):
            chunk_index = int(raw_index)
            if chunk_index < 0 or chunk_index >= len(chunks):
                continue

            semantic_score = float(raw_score)
            lexical_score = self._token_overlap(query, chunks[chunk_index]["content"])
            combined_score = semantic_score * 0.85 + lexical_score * 0.15

            if combined_score >= settings.BUSINESS_RAG_MIN_SCORE:
                ranked_chunks.append(
                    RetrievedChunk(
                        chunk=chunks[chunk_index],
                        score=combined_score,
                    )
                )

        if not ranked_chunks:
            fallbacks = [
                RetrievedChunk(
                    chunk=chunks[int(raw_index)],
                    score=self._token_overlap(query, chunks[int(raw_index)]["content"]),
                )
                for raw_index in indices[0]
                if int(raw_index) >= 0 and int(raw_index) < len(chunks)
            ]
            ranked_chunks = [item for item in fallbacks if item.score > 0.0]

        ranked_chunks.sort(key=lambda item: item.score, reverse=True)
        return ranked_chunks[: settings.BUSINESS_RAG_TOP_K]

    def _load_index(self):
        index_path = self._index_path()
        if not index_path.exists():
            return None

        current_mtime = index_path.stat().st_mtime
        if (
            self._cached_index is not None
            and self._cached_index_path == str(index_path)
            and self._cached_index_mtime == current_mtime
        ):
            return self._cached_index

        self._cached_index = faiss.read_index(str(index_path))
        self._cached_index_path = str(index_path)
        self._cached_index_mtime = current_mtime
        return self._cached_index

    def _embed_query(self, text: str) -> list[float] | None:
        try:
            embedding_model = get_embedding_model()
            if hasattr(embedding_model, "embed_query"):
                return embedding_model.embed_query(text)
            return embedding_model.embed_documents([text])[0]
        except Exception:
            return None

    def _normalize_matrix(self, matrix):
        norms = numpy.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return matrix / norms

    def _build_no_knowledge_answer(self, query: str) -> BusinessAnswer:
        return BusinessAnswer(
            question=query,
            answer="I do not have any business knowledge document loaded yet, so I cannot answer that reliably.",
            supporting_sources=[],
            used_fallback=True,
        )

    def _build_backend_unavailable_answer(self, query: str, details: str) -> BusinessAnswer:
        return BusinessAnswer(
            question=query,
            answer=f"The business knowledge index is not available right now. {details}",
            supporting_sources=[],
            used_fallback=True,
        )

    def _build_insufficient_context_answer(self, query: str) -> BusinessAnswer:
        return BusinessAnswer(
            question=query,
            answer="I could not find enough information in the business knowledge document to answer that reliably.",
            supporting_sources=[],
            used_fallback=True,
        )

    def _short_excerpt(self, text: str, max_length: int = 180) -> str:
        excerpt = text.strip()
        if len(excerpt) <= max_length:
            return excerpt
        return f"{excerpt[: max_length - 3].rstrip()}..."

    def _token_overlap(self, left: str, right: str) -> float:
        left_tokens = set(self._normalize(left).split())
        right_tokens = set(self._normalize(right).split())
        if not left_tokens or not right_tokens:
            return 0.0
        return len(left_tokens & right_tokens) / len(left_tokens | right_tokens)

    def _normalize(self, value: str | None) -> str:
        if value is None:
            return ""
        normalized = unicodedata.normalize("NFKD", value)
        normalized = "".join(char for char in normalized if not unicodedata.combining(char))
        return " ".join(normalized.lower().replace("_", " ").replace("-", " ").split())

    def _index_path(self) -> Path:
        return Path(settings.BUSINESS_FAISS_INDEX_DIR) / "business_knowledge.faiss"

_business_qa_service = BusinessQARagService()


def get_business_qa_service() -> BusinessQARagService:
    return _business_qa_service
