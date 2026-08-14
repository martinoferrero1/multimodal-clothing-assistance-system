from typing import ClassVar
from langchain_groq import ChatGroq
from infra.providers.factories.base_factory import ProviderFactory
from langchain_core.language_models.chat_models import BaseChatModel
from schemas.provider import Provider

class GroqFactory(ProviderFactory):
    
    _provider: ClassVar[Provider] = Provider.groq

    @classmethod
    def _build_llm(
        cls, llm_model: str, temperature: float = None, api_key: str = ""
    ) -> BaseChatModel:
        if temperature is not None:
            return ChatGroq(model=llm_model, temperature=temperature, groq_api_key=api_key)
        return ChatGroq(model=llm_model, groq_api_key=api_key)

    @classmethod
    def _build_embedding(cls, embedding_model: str, api_key: str):
        raise ValueError("Groq does not provide an embeddings model in this project. Use EMBEDDINGS_PROVIDER=google.")
