from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

class RAGQueryRequest(BaseModel):
    patient_id: int
    question: str

class RAGSourceCitation(BaseModel):
    note_id: int
    note_title: str
    note_type: str
    author_name: Optional[str] = "Clinical Staff"
    date_recorded: str
    chunk_text: str
    similarity_score: float

class RAGQueryResponse(BaseModel):
    patient_id: int
    patient_name: str
    question: str
    answer: str
    sources: List[RAGSourceCitation] = []
    has_sufficient_context: bool = True
    retrieval_time_ms: float = 0.0
    generation_time_ms: float = 0.0
