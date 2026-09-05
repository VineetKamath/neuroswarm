from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class RAGQueryRequest(BaseModel):
    patient_id: int
    question: str
    explain: bool = False


class RAGSourceCitation(BaseModel):
    note_id: int
    note_title: str
    note_type: str
    section: Optional[str] = None
    author_name: Optional[str] = "Clinical Staff"
    date_recorded: str
    chunk_text: str
    similarity_score: float
    # Blended score produced by the evolved ranking weights.
    ranked_score: Optional[float] = None
    # Per-signal breakdown, returned when the caller asks to explain a ranking.
    rank_explanation: Optional[Dict[str, Any]] = None


class RAGQueryResponse(BaseModel):
    patient_id: int
    patient_name: str
    question: str
    answer: str
    sources: List[RAGSourceCitation] = []
    has_sufficient_context: bool = True

    retrieval_time_ms: float = 0.0
    ranking_time_ms: float = 0.0
    total_time_ms: float = 0.0

    top_similarity: float = 0.0
    candidates_considered: int = 0
    ranking_optimized: bool = False
    intent: Optional[str] = None
    routing: Optional[Dict[str, Any]] = None
