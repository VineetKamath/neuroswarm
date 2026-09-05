"""
Bio-inspired subsystem API.

Serves the trained artifacts, convergence histories and live A/B comparisons
that the NeuroSwarm Bio-Lab page visualizes.
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.bio.immune import VITAL_FEATURES, hard_range_violations
from app.bio.registry import bio_registry
from app.bio.routing import INTENTS
from app.bio.tasks import TaskFeatures, TaskPolicy, extract_task_features
from app.core.rbac import require_admin, require_any_authenticated
from app.db.session import get_db
from app.models.patient import Patient
from app.models.task import CareTask, TaskStatus
from app.models.user import User
from app.models.vital import VitalSign
from app.services.rag_service import retrieval_service

router = APIRouter(prefix="/bio", tags=["Bio-Inspired Optimization"])


def _artifact(name: str) -> Dict[str, Any]:
    path = bio_registry.dir / f"{name}.json"
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"'{name}' has not been trained yet. Run: python -m app.bio.cli train",
        )
    return json.loads(path.read_text(encoding="utf-8"))


@router.get("/status")
def bio_status(current_user: User = Depends(require_any_authenticated)):
    """Which optimizers are trained, enabled and actively serving traffic."""
    return bio_registry.status()


@router.get("/report")
def training_report(current_user: User = Depends(require_any_authenticated)):
    """Latest end-to-end training report with baseline vs held-out numbers."""
    if not bio_registry.report:
        raise HTTPException(status_code=404, detail="No training report available yet.")
    return bio_registry.report


@router.get("/algorithms")
def algorithm_catalog(current_user: User = Depends(require_any_authenticated)):
    """Explanatory catalogue driving the Bio-Lab narrative."""
    return {
        "algorithms": [
            {
                "key": "ranking",
                "index": 1,
                "name": "Adaptive Retrieval Ranking",
                "family": "Genetic Algorithm + Particle Swarm Optimization",
                "metaphor": "Natural selection and flocking",
                "plugs_into": "Between the FAISS candidate pool and the clinician's result list",
                "problem": "Ranking on cosine similarity alone ignores recency, note type, "
                           "verbatim clinical terms and which SOAP section answers the question.",
                "why_bio": "nDCG is a rank metric — flat almost everywhere, so it has no gradient "
                           "to descend. The search space is a 14-dimensional continuous box with "
                           "interacting parameters, where grid search is intractable. "
                           "Population-based metaheuristics are built for exactly this regime.",
                "fitness": "0.6 x nDCG@5 + 0.25 x Recall@5 + 0.15 x MRR over labeled clinical queries",
                "genome": "6 signal weights, a recency half-life, a length pivot, 6 note-type priors",
            },
            {
                "key": "tasks",
                "index": 2,
                "name": "Care Task Prioritization",
                "family": "Genetic Algorithm",
                "metaphor": "Evolutionary selection of a triage policy",
                "plugs_into": "The nurse task queue and ward dashboard ordering",
                "problem": "A fixed 'ORDER BY due_time, priority' sort cannot express that an "
                           "overdue MEDIUM medication on a CRITICAL patient outranks a "
                           "not-yet-due HIGH hygiene task.",
                "why_bio": "Clinicians can state pairwise preferences far more easily than a "
                           "scoring formula. Pairwise agreement is a discontinuous step function "
                           "of the weights, so a GA optimizes it directly where calculus cannot.",
                "fitness": "0.6 x pairwise agreement + 0.25 x Kendall tau + 0.15 x top-1 accuracy",
                "genome": "6 factor weights, 2 time-scale parameters, 6 task-category priors",
            },
            {
                "key": "immune",
                "index": 3,
                "name": "Clinical Data Anomaly Detection",
                "family": "Artificial Immune System — Negative Selection",
                "metaphor": "T-cell maturation in the thymus",
                "plugs_into": "A checkpoint on vital signs before they are trusted for alerts",
                "problem": "Transcription typos, decimal slips and unit confusion enter the "
                           "record silently and then drive clinical decisions.",
                "why_bio": "A supervised classifier needs labeled examples of every error type, "
                           "which nobody has. Negative selection trains on NORMAL data only and "
                           "flags whatever fails to match — so it catches error modes never "
                           "enumerated in advance. That is the defining strength of the metaphor.",
                "fitness": "Detection rate against planted errors, penalized by false alarms",
                "genome": "Variable-radius detectors censored against the learned self-region",
            },
            {
                "key": "compression",
                "index": 4,
                "name": "Embedding Dimension Selection",
                "family": "Binary Genetic Algorithm",
                "metaphor": "Genetic recombination of building blocks",
                "plugs_into": "Between the sentence-transformer encoder and the FAISS index",
                "problem": "384 dimensions per chunk are stored and scanned for every query, "
                           "and retrieval is the entire response path since there is no LLM.",
                "why_bio": "Choosing k of 384 dimensions is a 2^384 combinatorial search. "
                           "Greedy selection gets trapped because dimensions interact — one "
                           "useless alone can be decisive alongside another. Uniform crossover "
                           "recombines useful dimension groups directly.",
                "fitness": "Retrieval nDCG@5 in the reduced subspace minus a parsimony penalty",
                "genome": "A 384-bit mask; set bits survive into the index",
            },
            {
                "key": "routing",
                "index": 5,
                "name": "Multi-Source Query Routing",
                "family": "Ant Colony Optimization",
                "metaphor": "Pheromone trails laid by foraging ants",
                "plugs_into": "Ahead of the FAISS scan, choosing which partitions to probe",
                "problem": "Every query scans every partition, even though a medication question "
                           "is almost never answered by a Chief Complaint section.",
                "why_bio": "A static lookup table goes stale as documentation habits shift. "
                           "Pheromone evaporation makes the policy continuously forget outdated "
                           "routes while probabilistic exploration keeps testing alternatives.",
                "fitness": "Probability the gold partition is probed, weighted by chunks scanned",
                "genome": "A pheromone matrix over (query intent x note partition) edges",
                "scoping_note": "The original brief proposed routing across separate stores "
                                "(encounters / prescriptions / reports). This system has one "
                                "clinical-notes store, so that framing would be fiction. It does "
                                "have a real partitioned space — note type x SOAP section — and "
                                "the colony optimizes routing across those instead.",
            },
        ],
        "intents": INTENTS,
    }


# ---- per-algorithm artifacts --------------------------------------------
@router.get("/ranking")
def ranking_artifact(current_user: User = Depends(require_any_authenticated)):
    return _artifact("ranking")


@router.get("/tasks")
def tasks_artifact(current_user: User = Depends(require_any_authenticated)):
    return _artifact("task_policy")


@router.get("/immune")
def immune_artifact(current_user: User = Depends(require_any_authenticated)):
    """Detector repertoire and evaluation metrics (detector centers trimmed for payload size)."""
    art = _artifact("immune")
    model = art.get("model", {})
    return {
        "metrics": art.get("metrics", {}),
        "generation_log": art.get("generation_log", []),
        "error_types": art.get("error_types", []),
        "train_self_count": art.get("train_self_count", 0),
        "test_normal_count": art.get("test_normal_count", 0),
        "test_anomalous_count": art.get("test_anomalous_count", 0),
        "self_radius": model.get("self_radius"),
        "feature_stats": model.get("feature_stats", {}),
        "features": VITAL_FEATURES,
        "detector_count": len(model.get("detectors", [])),
        "detectors": model.get("detectors", [])[:220],
        "self_set": model.get("self_set", [])[:220],
    }


@router.get("/compression")
def compression_artifact(current_user: User = Depends(require_any_authenticated)):
    return _artifact("compression")


@router.get("/routing")
def routing_artifact(current_user: User = Depends(require_any_authenticated)):
    art = _artifact("routing")
    return {
        "metrics": art.get("metrics", {}),
        "baseline_metrics": art.get("baseline_metrics", {}),
        "pheromone_matrix": art.get("pheromone_matrix", {}),
        "history": art.get("history", []),
        "config": art.get("router", {}).get("config", {}),
    }


# ---- live demonstrations -------------------------------------------------
@router.post("/compare-ranking")
def compare_ranking(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_authenticated),
):
    """Run one live query through both the baseline and the evolved ranker."""
    patient_id = payload.get("patient_id")
    question = (payload.get("question") or "").strip()
    if not patient_id or not question:
        raise HTTPException(status_code=400, detail="patient_id and question are required.")
    return retrieval_service.compare_baseline(patient_id, question, db)


@router.post("/check-vitals")
def check_vitals(
    payload: Dict[str, Any] = Body(...),
    current_user: User = Depends(require_any_authenticated),
):
    """Run an arbitrary vitals reading through the immune checkpoint."""
    model = bio_registry.immune
    values = {f: payload.get(f) for f in VITAL_FEATURES}
    if model is None:
        return {
            "trained": False,
            "is_anomalous": bool(hard_range_violations(values)),
            "hard_violations": hard_range_violations(values),
            "explanation": "Immune system not trained; only hard range checks applied.",
        }
    report = model.check(values)
    return {"trained": True, **report.to_dict()}


@router.get("/anomalies")
def scan_anomalies(
    limit: int = Query(60, ge=1, le=400),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_authenticated),
):
    """Sweep recorded vitals through the immune checkpoint and return the hits."""
    model = bio_registry.immune
    rows = (db.query(VitalSign, Patient)
              .join(Patient, VitalSign.patient_id == Patient.id)
              .order_by(VitalSign.recorded_at.desc())
              .limit(600).all())

    findings: List[Dict[str, Any]] = []
    scanned = 0
    for vital, patient in rows:
        scanned += 1
        values = {f: getattr(vital, f) for f in VITAL_FEATURES}
        if model is None:
            violations = hard_range_violations(values)
            if not violations:
                continue
            findings.append({
                "vital_id": vital.id, "patient_id": patient.id,
                "patient_name": patient.full_name, "room": patient.room_number,
                "recorded_at": vital.recorded_at, "values": values,
                "anomaly_score": 1.0, "hard_violations": violations,
                "suspect_features": [], "explanation": violations[0]["reason"],
            })
        else:
            report = model.check(values)
            if not report.is_anomalous:
                continue
            findings.append({
                "vital_id": vital.id, "patient_id": patient.id,
                "patient_name": patient.full_name, "room": patient.room_number,
                "recorded_at": vital.recorded_at, "values": values,
                **report.to_dict(),
            })
        if len(findings) >= limit:
            break

    findings.sort(key=lambda f: -f.get("anomaly_score", 0))
    return {
        "trained": model is not None,
        "scanned": scanned,
        "flagged": len(findings),
        "findings": findings,
    }


@router.post("/retrain")
def retrain(
    generations: int = Query(30, ge=5, le=120),
    compare: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Re-run the full evolution. Admin only — it rebuilds every vector index."""
    from app.bio.trainer import train_all
    return train_all(db, generations=generations, compare_optimizers=compare)


@router.get("/task-ranking")
def task_ranking(
    limit: int = Query(15, ge=1, le=60),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_authenticated),
):
    """Side-by-side: the old hardcoded sort vs the evolved GA policy."""
    tasks = (db.query(CareTask)
               .filter(CareTask.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS]))
               .all())
    if not tasks:
        return {"baseline": [], "optimized": [], "changed": False}

    loads: Dict[int, int] = {}
    for t in tasks:
        if t.assigned_nurse_id:
            loads[t.assigned_nurse_id] = loads.get(t.assigned_nurse_id, 0) + 1

    policy = bio_registry.task_policy
    baseline_policy = TaskPolicy.baseline()

    enriched = []
    for t in tasks:
        pstatus = t.patient.status.value if (t.patient and t.patient.status) else "ADMITTED"
        feats = extract_task_features(t, pstatus, loads.get(t.assigned_nurse_id, 0))
        enriched.append((t, feats))

    def render(pol: TaskPolicy):
        ordered = sorted(enriched, key=lambda x: pol.score(x[1]), reverse=True)[:limit]
        return [{
            "task_id": t.id, "title": t.title,
            "patient_name": t.patient.full_name if t.patient else "Unknown",
            "room": t.patient.room_number if t.patient else None,
            "priority": t.priority.value, "status": t.status.value,
            "acuity": f.acuity, "category": f.category,
            "overdue_hours": round(f.overdue_hours, 1),
            "due_time": t.due_time,
            **pol.explain(f),
        } for t, f in ordered]

    base = render(baseline_policy)
    opt = render(policy)
    return {
        "baseline": base,
        "optimized": opt,
        "changed": [b["task_id"] for b in base] != [o["task_id"] for o in opt],
        "policy": policy.to_dict(),
        "optimizer_active": bio_registry.task_is_optimized,
        "total_open_tasks": len(tasks),
    }
