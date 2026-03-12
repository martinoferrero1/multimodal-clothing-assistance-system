from abc import ABC, abstractmethod
from typing import Dict, Optional, Any, ClassVar, Sequence
from langchain_core.language_models.chat_models import BaseChatModel
from schemas.provider import Provider
from langchain_core.tools import BaseTool

class ProviderFactory(ABC): # aplica abstract factory y flyweight en conjunto, ya que no tiene mucho sentido en este caso aplicar el flyweight por separado porque hay que pasar por parametro la clase a instanciar al flyweight (bastante sucio), o crear un flyweight para cada alternativa, es innecesario

    _llm_instances: Dict[str, BaseChatModel] = {}
    _embedding_instances: Dict[str, Any] = {}
    _provider: ClassVar[Provider]

    @classmethod
    def get_llm_model_instance(
        cls, llm_model: str, temperature: Optional[float]
    ) -> BaseChatModel:
        key = cls._get_llm_instance_key(llm_model, temperature)
        llm_model_instance = cls._llm_instances.get(key)
        if llm_model_instance is None:
            llm_model_instance = cls._build_llm(llm_model, temperature)
            cls._llm_instances[key] = llm_model_instance

        return llm_model_instance

    @classmethod
    def get_embedding_model_instance(
        cls, embedding_model: str
    ):
        key = cls._get_embedding_instance_key(embedding_model)

        if key not in cls._embedding_instances:
            cls._embedding_instances[key] = cls._build_embedding(embedding_model)

        return cls._embedding_instances[key]

    @classmethod
    @abstractmethod
    def _build_llm(
        cls, llm_model: str, temperature: Optional[float]
    ) -> BaseChatModel:
        pass

    @classmethod
    @abstractmethod
    def _build_embedding(
        cls, embedding_model: str
    ):
        pass

    @classmethod
    def _get_llm_instance_key(
        cls, llm_model: str, temperature: Optional[float]
    ) -> str:
        temp = temperature if temperature is not None else "default"
        return f"{cls._provider}:{llm_model}:{temp}"

    @classmethod
    def _get_embedding_instance_key(
        cls, embedding_model: str
    ) -> str:
        return f"{cls._provider}:{embedding_model}"