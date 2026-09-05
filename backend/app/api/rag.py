from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.rbac import require_any_authenticated
from app.db.session import get_db
from app.models.user import User
from app.schemas.rag import RAGQueryRequest, RAGQueryResponse
from app.services.rag_service import rag_service

router = APIRouter(prefix="/rag", tags=["Clinical RAG Assistant"])

@router.post("/query", response_model=RAGQueryResponse)
def query_clinical_assistant(
    request: RAGQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_authenticated)
):
    """
    Query the AI Clinical Assistant for a specific patient.
    
    Security & Clinical Boundary:
    - Scoped strictly to the provided patient_id.
    - Employs Sentence-BERT + FAISS vector search.
    - Applies a similarity threshold before LLM call: returns refusal if question is irrelevant or unrecorded.
    - Answers are grounded strictly in the patient's documented notes with source citations.
    Available to: Doctor, Nurse, Admin.
    """
    if not request.question or not request.question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty."
        )

    response = rag_service.answer_clinical_query(
        patient_id=request.patient_id,
        question=request.question.strip(),
        db=db
    )
    return response
