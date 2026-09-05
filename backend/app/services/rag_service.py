import time
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from groq import Groq

from app.core.config import settings
from app.models.patient import Patient
from app.models.note import ClinicalNote
from app.schemas.rag import RAGQueryResponse, RAGSourceCitation
from app.services.vector_store import vector_store

logger = logging.getLogger(__name__)

CLINICAL_SYSTEM_PROMPT = """You are MediMind AI, an advanced clinical assistant supporting physicians, nurses, and hospital staff.

CRITICAL CLINICAL DIRECTIVES:
1. STRICT GROUNDING: Answer the query ONLY using the provided excerpts from this patient's documented medical notes.
2. ABSOLUTE ZERO HALLUCINATION: If the information is not explicitly documented in the provided notes, state clearly: "This information is not documented in the patient's records."
3. NO INFERENCE/GUESSING: Do not assume symptoms, dosages, test results, or timelines that are not in the context.
4. CITATIONS & TIMELINES: Reference the note dates, note types, and clinician names when providing summaries (e.g., 'According to the Progress Note on 2026-08-15 by Dr. Chen...').
5. CLINICAL CONCISENESS: Organize answers clearly with bullet points, medications, vitals, or clinical findings as appropriate.
"""

def generate_offline_synthesis(question: str, sources: List[Dict[str, Any]], patient_name: str) -> str:
    """
    Fallback deterministic synthesizer when GROQ_API_KEY is not configured or network is offline.
    Ensures zero downtime and demo reliability while maintaining strict grounding in retrieved notes.
    """
    bullet_points = []
    for s in sources:
        chunk = s.get("chunk_text", "")
        # Clean chunk header
        clean_lines = [line.strip() for line in chunk.split("\n") if line.strip() and not line.strip().startswith("[")]
        if clean_lines:
            bullet_points.append(f"- **{s.get('note_title')}** ({s.get('date_recorded')} by {s.get('author_name')}): {' '.join(clean_lines[:3])}")

    response = (
        f"Based on the documented records for **{patient_name}**:\n\n"
        + "\n".join(bullet_points)
        + "\n\n*(Note: Groq LLM API key not configured or offline. Showing direct grounded clinical excerpt synthesis.)*"
    )
    return response

class RAGService:
    def __init__(self):
        self._groq_client = None

    @property
    def groq_client(self) -> Optional[Groq]:
        if not settings.GROQ_API_KEY:
            return None
        if self._groq_client is None:
            try:
                self._groq_client = Groq(api_key=settings.GROQ_API_KEY)
            except Exception as e:
                logger.error(f"Failed to initialize Groq client: {e}")
                return None
        return self._groq_client

    def answer_clinical_query(
        self, patient_id: int, question: str, db: Session
    ) -> RAGQueryResponse:
        """
        Executes grounded Clinical RAG:
        1. Validates patient existence.
        2. Retrieves top-k note chunks strictly scoped to patient_id via FAISS vector search.
        3. Applies Similarity Threshold: If best similarity < threshold, immediately rejects
           to protect clinical accuracy and avoid hallucinated care guidance.
        4. Invokes Groq Llama 3.3 70B with bounded context and explicit refusal instructions.
        5. Returns structured response with source citations.
        """
        t0 = time.perf_counter()

        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            return RAGQueryResponse(
                patient_id=patient_id,
                patient_name="Unknown Patient",
                question=question,
                answer="Patient not found.",
                has_sufficient_context=False
            )

        # 1. Vector Search Scoped Strictly to Patient
        retrieval_results = vector_store.search_patient_notes(
            patient_id=patient_id,
            query=question,
            top_k=settings.TOP_K_NOTES,
            db=db
        )

        t_retrieved = time.perf_counter()
        retrieval_time_ms = round((t_retrieved - t0) * 1000, 2)

        # 2. Similarity Score Threshold Guard
        # If no notes exist or top similarity is below threshold, stop immediately.
        if not retrieval_results or retrieval_results[0][1] < settings.SIMILARITY_THRESHOLD:
            max_score = retrieval_results[0][1] if retrieval_results else 0.0
            logger.info(f"Query rejected by similarity threshold. Top score: {max_score:.4f} < {settings.SIMILARITY_THRESHOLD}")
            return RAGQueryResponse(
                patient_id=patient.id,
                patient_name=patient.full_name,
                question=question,
                answer="No relevant information found in this patient's records.",
                sources=[],
                has_sufficient_context=False,
                retrieval_time_ms=retrieval_time_ms,
                generation_time_ms=0.0
            )

        # Filter chunks that meet the minimum threshold
        relevant_chunks = [
            (meta, score) for meta, score in retrieval_results if score >= (settings.SIMILARITY_THRESHOLD - 0.05)
        ]

        citations: List[RAGSourceCitation] = [
            RAGSourceCitation(
                note_id=meta["note_id"],
                note_title=meta["note_title"],
                note_type=meta["note_type"],
                author_name=meta.get("author_name", "Clinical Staff"),
                date_recorded=meta.get("date_recorded", "Unknown Date"),
                chunk_text=meta["chunk_text"],
                similarity_score=round(score, 4)
            )
            for meta, score in relevant_chunks
        ]

        # 3. Context Construction
        context_blocks = []
        for i, (meta, score) in enumerate(relevant_chunks, 1):
            context_blocks.append(
                f"--- NOTE EXCERPT #{i} ---\n"
                f"Note: {meta['note_title']} ({meta['note_type']})\n"
                f"Date: {meta['date_recorded']} | Author: {meta.get('author_name', 'Staff')}\n"
                f"Relevance Score: {score:.3f}\n"
                f"Content:\n{meta['chunk_text']}\n"
            )

        formatted_context = "\n".join(context_blocks)
        user_prompt = (
            f"PATIENT CONTEXT:\n"
            f"Patient Name: {patient.full_name}\n"
            f"MRN: {patient.mrn}\n"
            f"Age/Gender: {patient.gender}\n"
            f"Primary Diagnosis: {patient.primary_diagnosis or 'Not specified'}\n"
            f"Allergies: {patient.allergies or 'None documented'}\n\n"
            f"DOCUMENTED CLINICAL NOTES EXCERPTS:\n"
            f"{formatted_context}\n\n"
            f"CLINICAL QUESTION: {question}\n\n"
            f"ANSWER (Ground strictly in the excerpts above. If not mentioned, state 'This information is not documented in the patient's records.'):"
        )

        # 4. LLM Generation via Groq
        t_gen_start = time.perf_counter()
        answer = ""
        client = self.groq_client

        if client:
            try:
                chat_completion = client.chat.completions.create(
                    model=settings.GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": CLINICAL_SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.1,  # Low temperature for deterministic clinical precision
                    max_tokens=1024,
                )
                answer = chat_completion.choices[0].message.content
            except Exception as e:
                logger.error(f"Groq LLM call error: {e}. Falling back to synthesis.")
                answer = generate_offline_synthesis(question, [m for m, _ in relevant_chunks], patient.full_name)
        else:
            answer = generate_offline_synthesis(question, [m for m, _ in relevant_chunks], patient.full_name)

        t_gen_end = time.perf_counter()
        generation_time_ms = round((t_gen_end - t_gen_start) * 1000, 2)

        return RAGQueryResponse(
            patient_id=patient.id,
            patient_name=patient.full_name,
            question=question,
            answer=answer,
            sources=citations,
            has_sufficient_context=True,
            retrieval_time_ms=retrieval_time_ms,
            generation_time_ms=generation_time_ms
        )

rag_service = RAGService()
