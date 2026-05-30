from pydantic_settings import BaseSettings
from pydantic import model_validator
from schemas.provider import Provider
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///catalog.db"
    DATABASE_ECHO: bool = False
    LANGGRAPH_CHECKPOINT_DATABASE_URL: Optional[str] = None
    AUTH_TOKEN_SECRET: str = "development-auth-secret-change-me"
    AUTH_TOKEN_EXPIRE_MINUTES: int = 10080

    GOOGLE_LLM_MODEL: Optional[str] = None
    GROQ_LLM_MODEL: Optional[str] = None

    GOOGLE_EMBEDDING_MODEL: Optional[str] = None
    GROQ_EMBEDDING_MODEL: Optional[str] = None

    GOOGLE_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None

    LLM_SUB_AGENTS_PROVIDER: Provider = Provider.google
    LLM_SUPERVISOR_PROVIDER: Provider = Provider.google
    EMBEDDINGS_PROVIDER: Provider = Provider.google

    GOOGLE_LLM_TEMPERATURE: Optional[float] = None
    GROQ_LLM_TEMPERATURE: Optional[float] = None

    INCLUDE_PROMPT_EXAMPLES: Optional[bool] = None
    PRODUCT_SEARCH_PRIORITY_FIELDS: str = ""

    BUSINESS_KNOWLEDGE_DIR: str = "data/business_knowledge"
    BUSINESS_KNOWLEDGE_GLOB: str = "*.knowledge.md"
    BUSINESS_FAISS_INDEX_DIR: str = "data/business_knowledge_index"
    BUSINESS_RAG_CHUNK_SIZE: int = 700
    BUSINESS_RAG_CHUNK_OVERLAP: int = 120
    BUSINESS_RAG_TOP_K: int = 4
    BUSINESS_RAG_MIN_SCORE: float = 0.2

    def _check_api_key_and_model(self, provider: str, model: Optional[str], api_key: Optional[str], is_embedding_provider: bool = False):
        if is_embedding_provider:
            if model is None:
                raise ValueError(f"Please set the embedding model for {provider} in your environment variables.")
            elif api_key is None:
                raise ValueError(f"Please set the API key for {provider} in your environment variables.")
        else:
            if model is None:
                raise ValueError(f"Please set the LLM model for {provider} in your environment variables.")
            elif api_key is None:
                raise ValueError(f"Please set the API key for {provider} in your environment variables.")

    @model_validator(mode="after")
    def check_enough_info(self):
        match self.LLM_SUB_AGENTS_PROVIDER:
            case Provider.google: self._check_api_key_and_model(Provider.google, self.GOOGLE_LLM_MODEL, self.GOOGLE_API_KEY)
            case Provider.groq: self._check_api_key_and_model(Provider.groq, self.GROQ_LLM_MODEL, self.GROQ_API_KEY)
        match self.LLM_SUPERVISOR_PROVIDER:
            case Provider.google: self._check_api_key_and_model(Provider.google, self.GOOGLE_LLM_MODEL, self.GOOGLE_API_KEY)
            case Provider.groq: self._check_api_key_and_model(Provider.groq, self.GROQ_LLM_MODEL, self.GROQ_API_KEY)
        match self.EMBEDDINGS_PROVIDER:
            case Provider.google: self._check_api_key_and_model(Provider.google, self.GOOGLE_EMBEDDING_MODEL, self.GOOGLE_API_KEY, is_embedding_provider=True)
            case Provider.groq: self._check_api_key_and_model(Provider.groq, self.GROQ_EMBEDDING_MODEL, self.GROQ_API_KEY, is_embedding_provider=True)
        return self

    class Config:
        env_file = ".env"

settings = Settings()
