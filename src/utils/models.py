
from core.settings import Settings
from langchain_core.language_models.chat_models import BaseChatModel
from schemas.provider import Provider

def get_llm_model(settings: Settings, is_supervisor: bool = False) -> BaseChatModel:
    provider = settings.LLM_SUPERVISOR_PROVIDER if is_supervisor else settings.LLM_SUB_AGENTS_PROVIDER
    provider = provider.lower()
    if provider == Provider.google:
        from infra.providers.factories.google_factory import GoogleFactory
        return GoogleFactory.get_llm_model_instance(
            settings.GOOGLE_LLM_MODEL, settings.GOOGLE_LLM_TEMPERATURE
        )
    elif provider == Provider.groq:
        from infra.providers.factories.groq_factory import GroqFactory
        return GroqFactory.get_llm_model_instance(
            settings.GROQ_LLM_MODEL, settings.GROQ_LLM_TEMPERATURE
        )
    else:
        raise ValueError(f"Unsupported provider: {provider}")