from pydantic import BaseModel
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, field_validator, model_validator

class NodeName(str, Enum):
    BUSINESS_QA = "business_qa"
    EXTRACT_OUTFIT_REQUEST = "extract_outfit_request"
    SEARCH_PRODUCTS = "search_products"
    BUILD_OUTFIT = "build_outfit"
    FINAL_RESPONSE = "final_response"

class OrchestatorDecision(BaseModel):
    plan: List[NodeName]

    business_qa_queries: Optional[List[str]] = None
    outfit_search_intents: Optional[List[str]] = None

    custom_answer: Optional[str] = None
    use_default_clarification: bool = False

    @model_validator(mode="after")
    def validate_consistency(self):
        has_plan = len(self.plan) > 0
        uses_business = NodeName.BUSINESS_QA in self.plan
        uses_outfit = any(
            node in self.plan
            for node in [
                NodeName.EXTRACT_OUTFIT_REQUEST,
                NodeName.SEARCH_PRODUCTS,
                NodeName.BUILD_OUTFIT,
            ]
        )

        if self.use_default_clarification:
            if has_plan:
                raise ValueError("Clarification cannot have a plan")
            if self.custom_answer is not None:
                raise ValueError("Clarification cannot have custom_answer")
            if self.business_qa_queries is not None:
                raise ValueError("Clarification cannot have business_qa_queries")
            if self.outfit_search_intents is not None:
                raise ValueError("Clarification cannot have outfit_search_intents")
            return self

        if has_plan and self.custom_answer is not None:
            raise ValueError("Cannot have both plan and custom_answer")

        if not has_plan and self.custom_answer is None:
            raise ValueError("Either plan or custom_answer must be provided")

        if has_plan and self.plan[-1] != NodeName.FINAL_RESPONSE:
            raise ValueError("Plan must end with final_response")

        if uses_business:
            if not self.business_qa_queries:
                raise ValueError("business_qa requires business_qa_queries")
        else:
            if self.business_qa_queries is not None:
                raise ValueError("business_qa_queries must be null if not used")

        if uses_outfit:
            if not self.outfit_search_intents:
                raise ValueError("Outfit flow requires outfit_search_intents")
        else:
            if self.outfit_search_intents is not None:
                raise ValueError("outfit_search_intents must be null if not used")

        if NodeName.SEARCH_PRODUCTS in self.plan:
            if NodeName.EXTRACT_OUTFIT_REQUEST not in self.plan:
                raise ValueError(
                    "search_products requires extract_outfit_request in the plan"
                )

        return self
    
    @field_validator("business_qa_queries")
    @classmethod
    def clean_queries(cls, v):
        if v is None:
            return v
        return [q.strip() for q in v if q.strip()]


    @field_validator("outfit_search_intents")
    @classmethod
    def clean_intents(cls, v):
        if v is None:
            return v
        return [i.strip() for i in v if i.strip()]