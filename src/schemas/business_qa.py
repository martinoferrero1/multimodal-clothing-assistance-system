from pydantic import BaseModel, Field


class BusinessQASource(BaseModel):
    document_id: str
    document_name: str
    chunk_id: str
    score: float
    excerpt: str


class BusinessAnswer(BaseModel):
    question: str
    answer: str
    supporting_sources: list[BusinessQASource] = Field(default_factory=list)
    used_fallback: bool = False


class BusinessAnswerDraft(BaseModel):
    answer: str
