"""
NeuroSwarm clinical retrieval engine.

There is deliberately NO language model in this path. Answers are composed
directly from the clinician's own documented text, which means:

  * every sentence shown is verbatim from a real note (zero hallucination is
    structural, not a prompt instruction);
  * the response is deterministic — the same question returns the same answer,
    which is what makes GA fitness measurable and what a clinical audit needs;
  * latency is dominated by retrieval, so the bio-inspired speed work has a
    visible effect instead of vanishing behind a generation call.

Pipeline
    1. ACO routing        picks which partitions to probe first
    2. FAISS search       returns a candidate pool (wider than the final k)
    3. GA/PSO re-ranking  re-scores candidates on six evolved signals
    4. Threshold gate     refuses rather than guessing
    5. Extractive answer  composes a cited response from the winning chunks
"""
from __future__ import annotations

import logging
import re
import time
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.bio.features import detect_intent
from app.bio.registry import bio_registry
from app.core.config import settings
from app.models.patient import Patient
from app.schemas.rag import RAGQueryResponse, RAGSourceCitation
from app.services.vector_store import vector_store

logger = logging.getLogger(__name__)

_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")

INTENT_LEAD = {
    "medication": "Documented medications and orders",
    "lab": "Documented laboratory results",
    "vitals": "Documented observations",
    "diagnosis": "Documented assessment",
    "symptom": "Documented history from the patient",
    "plan": "Documented plan of care",
    "history": "Documented background",
    "procedure": "Documented procedures",
    "general": "Documented findings",
}


def _strip_header(chunk: str) -> str:
    """Remove the bracketed provenance header the indexer prepends."""
    lines = [ln for ln in (chunk or "").split("\n") if ln.strip()]
    if lines and lines[0].strip().startswith("["):
        lines = lines[1:]
    return "\n".join(lines).strip()


def _select_sentences(text: str, query_terms: List[str], max_sentences: int = 3) -> str:
    """Pick the sentences within a chunk that actually address the question.

    Chunks are section-sized; showing the whole thing buries the answer. This
    keeps the passage extractive (nothing is generated) while surfacing the
    relevant lines first.
    """
    body = _strip_header(text)
    if not body:
        return ""

    # Preserve list/numbered formatting, which carries clinical meaning.
    if re.search(r"^\s*\d+\.", body, flags=re.M):
        lines = [ln.strip() for ln in body.split("\n") if ln.strip()]
        if query_terms:
            scored = sorted(lines, key=lambda ln: -sum(1 for t in query_terms if t in ln.lower()))
            keep = [ln for ln in scored[:max_sentences]]
            return "\n".join([ln for ln in lines if ln in keep])
        return "\n".join(lines[:max_sentences])

    sentences = [s.strip() for s in _SENT_SPLIT.split(body) if s.strip()]
    if not sentences:
        return body
    if not query_terms:
        return " ".join(sentences[:max_sentences])

    ranked = sorted(
        range(len(sentences)),
        key=lambda i: -sum(1 for t in query_terms if t in sentences[i].lower()),
    )
    chosen = sorted(ranked[:max_sentences])
    return " ".join(sentences[i] for i in chosen)


def compose_extractive_answer(
    question: str,
    ranked: List[Tuple[Dict, float, float, Dict]],
    patient_name: str,
) -> str:
    """Build a cited, fully extractive answer from the top-ranked chunks."""
    from app.bio.features import tokenize

    terms = tokenize(question)
    intent = detect_intent(question)
    lead = INTENT_LEAD.get(intent, "Documented findings")

    blocks: List[str] = []
    seen: set = set()
    for meta, _blended, _sim, _expl in ranked[:4]:
        passage = _select_sentences(meta.get("chunk_text", ""), terms)
        if not passage:
            continue
        fingerprint = passage[:90].lower()
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        blocks.append(
            f"**{meta.get('note_title', 'Clinical Note')}** — {meta.get('section', 'Note')} "
            f"({meta.get('date_recorded', 'undated')}, {meta.get('author_name', 'clinical staff')})\n"
            f"{passage}"
        )

    if not blocks:
        return "No relevant information found in this patient's records."

    return (
        f"{lead} for **{patient_name}**:\n\n"
        + "\n\n".join(blocks)
        + "\n\n_Every line above is quoted directly from the cited notes. "
          "NeuroSwarm does not generate clinical text._"
    )


class RetrievalService:
    """Bio-inspired clinical retrieval — no language model in the path."""

    def answer_clinical_query(
        self,
        patient_id: int,
        question: str,
        db: Session,
        explain: bool = False,
    ) -> RAGQueryResponse:
        t0 = time.perf_counter()

        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            return RAGQueryResponse(
                patient_id=patient_id, patient_name="Unknown Patient",
                question=question, answer="Patient not found.",
                has_sufficient_context=False,
            )

        # ---- 1. Ant Colony routing ---------------------------------------
        router = bio_registry.router
        routing_info: Optional[Dict] = None
        restrict = None
        if router:
            routing_info = router.route(question)
            restrict = routing_info.get("partitions") or None

        # ---- 2. Candidate retrieval --------------------------------------
        t_r0 = time.perf_counter()
        candidates = vector_store.search_patient_notes(
            patient_id=patient_id,
            query=question,
            top_k=settings.CANDIDATE_POOL_K,
            db=db,
            restrict_partitions=restrict,
        )
        # A routing miss must never cost recall: if the narrowed scan found
        # nothing usable, fall back to the full patient index.
        if restrict and (not candidates or candidates[0][1] < settings.SIMILARITY_THRESHOLD):
            candidates = vector_store.search_patient_notes(
                patient_id=patient_id, query=question,
                top_k=settings.CANDIDATE_POOL_K, db=db,
            )
            if routing_info:
                routing_info["fell_back_to_full_scan"] = True

        retrieval_time_ms = round((time.perf_counter() - t_r0) * 1000, 3)

        if not candidates:
            return RAGQueryResponse(
                patient_id=patient.id, patient_name=patient.full_name,
                question=question,
                answer="No relevant information found in this patient's records.",
                sources=[], has_sufficient_context=False,
                retrieval_time_ms=retrieval_time_ms, ranking_time_ms=0.0,
                routing=routing_info,
            )

        # ---- 3. Evolved re-ranking ---------------------------------------
        t_rank0 = time.perf_counter()
        weights = bio_registry.ranking_weights
        ranked = weights.score_candidates(candidates, question)
        ranking_time_ms = round((time.perf_counter() - t_rank0) * 1000, 3)

        best_similarity = max((sim for _, _, sim, _ in ranked), default=0.0)

        # ---- 4. Threshold gate -------------------------------------------
        if best_similarity < settings.SIMILARITY_THRESHOLD:
            logger.info("Query rejected by similarity gate: %.4f < %.2f",
                        best_similarity, settings.SIMILARITY_THRESHOLD)
            return RAGQueryResponse(
                patient_id=patient.id, patient_name=patient.full_name,
                question=question,
                answer="No relevant information found in this patient's records.",
                sources=[], has_sufficient_context=False,
                retrieval_time_ms=retrieval_time_ms, ranking_time_ms=ranking_time_ms,
                top_similarity=round(best_similarity, 4), routing=routing_info,
            )

        floor = max(0.0, settings.SIMILARITY_THRESHOLD - 0.08)
        kept = [r for r in ranked if r[2] >= floor][: settings.TOP_K_NOTES]
        if not kept:
            kept = ranked[: settings.TOP_K_NOTES]

        citations = [
            RAGSourceCitation(
                note_id=meta["note_id"],
                note_title=meta["note_title"],
                note_type=meta["note_type"],
                section=meta.get("section"),
                author_name=meta.get("author_name", "Clinical Staff"),
                date_recorded=meta.get("date_recorded", "Unknown Date"),
                chunk_text=meta["chunk_text"],
                similarity_score=round(sim, 4),
                ranked_score=round(blended, 4),
                rank_explanation=expl if explain else None,
            )
            for meta, blended, sim, expl in kept
        ]

        answer = compose_extractive_answer(question, kept, patient.full_name)

        return RAGQueryResponse(
            patient_id=patient.id,
            patient_name=patient.full_name,
            question=question,
            answer=answer,
            sources=citations,
            has_sufficient_context=True,
            retrieval_time_ms=retrieval_time_ms,
            ranking_time_ms=ranking_time_ms,
            total_time_ms=round((time.perf_counter() - t0) * 1000, 3),
            top_similarity=round(best_similarity, 4),
            candidates_considered=len(candidates),
            ranking_optimized=bio_registry.ranking_is_optimized,
            intent=detect_intent(question),
            routing=routing_info,
        )

    def compare_baseline(self, patient_id: int, question: str, db: Session) -> Dict[str, Any]:
        """Run the same query through the baseline and the evolved ranker.

        This is what the demonstration page uses to show the difference on a
        live query rather than only on stored benchmark numbers.
        """
        from app.bio.ranking import RankingWeights

        candidates = vector_store.search_patient_notes(
            patient_id=patient_id, query=question,
            top_k=settings.CANDIDATE_POOL_K, db=db,
        )
        if not candidates:
            return {"question": question, "baseline": [], "optimized": [], "changed": False}

        def summarize(ranked):
            return [{
                "note_id": m.get("note_id"),
                "note_title": m.get("note_title"),
                "section": m.get("section"),
                "note_type": m.get("note_type"),
                "date_recorded": m.get("date_recorded"),
                "similarity": round(sim, 4),
                "score": round(blended, 4),
                "contribution": expl.get("contribution", {}),
                "preview": _strip_header(m.get("chunk_text", ""))[:220],
            } for m, blended, sim, expl in ranked[:5]]

        base = RankingWeights.baseline().score_candidates(candidates, question)
        opt = bio_registry.ranking_weights.score_candidates(candidates, question)
        base_ids = [m.get("note_id") for m, _, _, _ in base[:5]]
        opt_ids = [m.get("note_id") for m, _, _, _ in opt[:5]]

        return {
            "question": question,
            "intent": detect_intent(question),
            "baseline": summarize(base),
            "optimized": summarize(opt),
            "changed": base_ids != opt_ids,
            "weights": bio_registry.ranking_weights.to_dict(),
            "optimizer_active": bio_registry.ranking_is_optimized,
        }


retrieval_service = RetrievalService()
# Backwards-compatible alias for existing imports.
rag_service = retrieval_service
