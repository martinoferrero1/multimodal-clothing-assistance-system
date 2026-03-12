from typing import ClassVar
from langchain_groq import ChatGroq
from infra.providers.factories.base_factory import ProviderFactory
from langchain_core.language_models.chat_models import BaseChatModel
from schemas.provider import Provider

class GroqFactory(ProviderFactory):
    
    _provider: ClassVar[Provider] = Provider.groq

    @classmethod
    def _build_llm(cls, llm_model: str, temperature: float = None) -> BaseChatModel:
        return ChatGroq(model=llm_model, temperature=temperature)