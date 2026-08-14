from abc import ABC, abstractmethod
import hashlib
from typing import Dict, Optional, Any, ClassVar

from langchain_core.language_models.chat_models import BaseChatModel
from pydantic import SecretStr
from schemas.provider import Provider
from langchain_core.tools import BaseTool

class ProviderFactory(ABC): # aplica abstract factory y flyweight en conjunto, ya que no tiene mucho sentido en este caso aplicar el flyweight por separado porque hay que pasar por parametro la clase a instanciar al flyweight (bastante sucio), o crear un flyweight para cada alternativa, es innecesario

    _llm_instances: Dict[str, BaseChatModel] = {}
    _embedding_instances: Dict[str, Any] = {}
    _provider: ClassVar[Provider]

    @classmethod
    def get_llm_model_instance(
        cls, llm_model: Optional[str], temperature: Optional[float], api_key: Optional[SecretStr]
    ) -> BaseChatModel:
        model, credential = cls._require_configuration(llm_model, api_key, "LLM")
        key = cls._get_llm_instance_key(model, temperature, credential)
        llm_model_instance = cls._llm_instances.get(key)
        if llm_model_instance is None:
            llm_model_instance = cls._build_llm(model, temperature, credential)
            cls._llm_instances[key] = llm_model_instance

        return llm_model_instance

    @classmethod
    def get_embedding_model_instance(
        cls, embedding_model: Optional[str], api_key: Optional[SecretStr]
    ):
        model, credential = cls._require_configuration(embedding_model, api_key, "embedding")
        key = cls._get_embedding_instance_key(model, credential)

        if key not in cls._embedding_instances:
            cls._embedding_instances[key] = cls._build_embedding(model, credential)

        return cls._embedding_instances[key]

    @classmethod
    @abstractmethod
    def _build_llm(
        cls, llm_model: str, temperature: Optional[float], api_key: str
    ) -> BaseChatModel:
        pass

    @classmethod
    @abstractmethod
    def _build_embedding(
        cls, embedding_model: str, api_key: str
    ):
        pass

    @classmethod
    def _get_llm_instance_key(
        cls, llm_model: str, temperature: Optional[float], api_key: str
    ) -> str:
        temp = temperature if temperature is not None else "default"
        credential_id = hashlib.sha256(api_key.encode("utf-8")).hexdigest()
        return f"{cls._provider}:{llm_model}:{temp}:{credential_id}"

    @classmethod
    def _get_embedding_instance_key(
        cls, embedding_model: str, api_key: str
    ) -> str:
        credential_id = hashlib.sha256(api_key.encode("utf-8")).hexdigest()
        return f"{cls._provider}:{embedding_model}:{credential_id}"

    @classmethod
    def _require_configuration(
        cls, model: Optional[str], api_key: Optional[SecretStr], capability: str
    ) -> tuple[str, str]:
        if not model or not model.strip():
            raise ValueError(f"{cls._provider.value} {capability} model is not configured")
        if api_key is None or not api_key.get_secret_value().strip():
            raise ValueError(f"{cls._provider.value} API key is not configured")
        return model.strip(), api_key.get_secret_value()
