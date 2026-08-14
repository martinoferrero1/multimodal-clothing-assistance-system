from typing import ClassVar
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from infra.providers.factories.base_factory import ProviderFactory
from langchain_core.language_models.chat_models import BaseChatModel
from schemas.provider import Provider


class _GoogleRetrievalEmbeddings:
    def __init__(self, model: str, api_key: str) -> None:
        self.model = model
        self._client = GoogleGenerativeAIEmbeddings(model=model, google_api_key=api_key)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._client.embed_documents(texts, task_type="retrieval_document")

    def embed_query(self, text: str) -> list[float]:
        return self._client.embed_query(text, task_type="retrieval_query")


class GoogleFactory(ProviderFactory):

    _provider: ClassVar[Provider] = Provider.google

    @classmethod
    def _build_llm(
        cls, llm_model: str, temperature: float = None, api_key: str = ""
    ) -> BaseChatModel:
        if temperature is not None:
            return ChatGoogleGenerativeAI(
                model=llm_model, temperature=temperature, google_api_key=api_key
            )
        return ChatGoogleGenerativeAI(model=llm_model, google_api_key=api_key)

    @classmethod
    def _build_embedding(cls, embedding_model: str, api_key: str):
        normalized_model = cls.normalize_embedding_model_name(embedding_model)
        return _GoogleRetrievalEmbeddings(model=normalized_model, api_key=api_key)

    @staticmethod
    def normalize_embedding_model_name(embedding_model: str) -> str:
        raw_model = (embedding_model or "").strip()
        if not raw_model:
            return "models/gemini-embedding-001"

        aliases = {
            "text-embedding-004": "models/gemini-embedding-001",
            "models/text-embedding-004": "models/gemini-embedding-001",
            "embedding-001": "models/embedding-001",
            "models/embedding-001": "models/embedding-001",
            "gemini-embedding-001": "models/gemini-embedding-001",
            "models/gemini-embedding-001": "models/gemini-embedding-001",
        }
        normalized = aliases.get(raw_model)
        if normalized is not None:
            return normalized

        if "/" not in raw_model:
            return f"models/{raw_model}"
        return raw_model
