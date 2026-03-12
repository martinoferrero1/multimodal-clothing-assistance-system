from typing import ClassVar
from langchain_google_genai import ChatGoogleGenerativeAI
from infra.providers.factories.base_factory import ProviderFactory
from langchain_core.language_models.chat_models import BaseChatModel
from schemas.provider import Provider

class GoogleFactory(ProviderFactory):
    
    _provider: ClassVar[Provider] = Provider.google

    @classmethod
    def _build_llm(cls, llm_model: str, temperature: float = None) -> BaseChatModel:
        return ChatGoogleGenerativeAI(model=llm_model, temperature=temperature)