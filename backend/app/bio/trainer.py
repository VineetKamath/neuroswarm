"""
Training orchestrator for the five bio-inspired optimizers.

Everything trains against labeled ground truth produced during seeding, and
every run reports the baseline it was measured against, so each improvement
claim is reproducible rather than asserted.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Sequence

import numpy as np

from app.bio.compression import CompressedProjector, train_compression
from app.bio.immune import (
    NegativeSelectionDetector, VITAL_FEATURES, evaluate_immune,
)
from app.bio.ranking import train_ranking
from app.bio.registry import bio_registry
from app.bio.routing import ACOConfig, AntColonyRouter, partition_key
from app.bio.seeding import build_task_scenarios, load_benchmark
from app.bio.tasks import TaskFeatures, TaskPolicy, evaluate_policy, train_task_policy
from app.core.config import settings

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------
# Benchmark case construction
# --------------------------------------------------------------------------
def build_ranking_cases(db, labels: Sequence[Dict], pool_k: int = 20) -> List[Dict]:
    """Pre-compute the FAISS candidate pool and graded relevance per query.

    RELEVANCE IS DEFINED AT THE CHUNK LEVEL, NOT THE NOTE LEVEL.
    An earlier version marked every chunk of the gold *note* as relevant. That
    leaked: because generated questions were always answered by the admission
    note, the GA could score a perfect nDCG by learning "rank ADMISSION first"
    and driving the similarity weight to zero, gaming the benchmark instead of
    learning retrieval. Grading by section removes the shortcut:

        1.0  correct section, in the most recent note that has it
             (what a clinician actually wants: the current answer)
        0.6  correct section, in an older note (still correct, less current)
        0.0  any other section

    Every note type now contains every section, so no note-type prior can
    substitute for reading the content.
    """
    from app.services.vector_store import vector_store

    cases: List[Dict] = []
    for lab in labels:
        candidates = vector_store.search_patient_notes(
            patient_id=lab["patient_id"], query=lab["question"], top_k=pool_k, db=db,
        )
        if not candidates:
            continue

        gold_section = (lab.get("gold_section") or "").lower()
        if not gold_section:
            continue

        # Identify the most recent note among candidates carrying the gold section.
        dated = [
            (m.get("date_recorded", ""), m.get("note_id"))
            for m, _ in candidates
            if gold_section in (m.get("section") or "").lower()
        ]
        if not dated:
            continue                    # gold section not retrievable in this pool
        newest_note_id = max(dated)[1]

        relevance = []
        for m, _ in candidates:
            if gold_section in (m.get("section") or "").lower():
                relevance.append(1.0 if m.get("note_id") == newest_note_id else 0.6)
            else:
                relevance.append(0.0)

        cases.append({
            "question": lab["question"],
            "patient_id": lab["patient_id"],
            "gold_section": lab.get("gold_section"),
            "candidates": candidates,
            "relevance": relevance,
        })
    return cases


def split_cases(cases: Sequence[Dict], test_frac: float = 0.3, seed: int = 11):
    """Hold out a test split so reported gains are generalization, not memorization."""
    import random as _random
    idx = list(range(len(cases)))
    _random.Random(seed).shuffle(idx)
    cut = int(len(idx) * (1 - test_frac))
    return [cases[i] for i in idx[:cut]], [cases[i] for i in idx[cut:]]


def build_compression_cases(db, labels: Sequence[Dict], max_cases: int = 60) -> List[Dict]:
    """Assemble raw (unprojected) vectors so the GA can search dimension space."""
    from app.services.vector_store import vector_store

    cases: List[Dict] = []
    for lab in labels[:max_cases]:
        pid = lab["patient_id"]
        metadata = vector_store.get_patient_metadata(pid)
        if not metadata:
            continue
        texts = [m["chunk_text"] for m in metadata]
        doc_vecs = vector_store.encode(texts, apply_projection=False)
        q_vec = vector_store.encode([lab["question"]], apply_projection=False)[0]
        gold_section = (lab.get("gold_section") or "").lower()
        if not gold_section:
            continue
        # Same chunk-level grading as the ranking benchmark, so compression is
        # measured against the retrieval task it actually has to preserve.
        relevance = [
            1.0 if gold_section in (m.get("section") or "").lower() else 0.0
            for m in metadata
        ]
        if not any(r > 0 for r in relevance):
            continue
        cases.append({"query_vec": q_vec, "doc_vecs": doc_vecs, "relevance": relevance})
    return cases


def build_routing_cases(db, labels: Sequence[Dict]) -> List[Dict]:
    """Map each labeled query to the partition(s) holding its gold chunk."""
    from app.bio.features import detect_intent
    from app.services.vector_store import vector_store

    cases: List[Dict] = []
    for lab in labels:
        metadata = vector_store.get_patient_metadata(lab["patient_id"])
        if not metadata:
            continue
        gold_section = (lab.get("gold_section") or "").lower()
        if not gold_section:
            continue
        golds = {
            m.get("partition") or partition_key(m.get("note_type", ""), m.get("section", ""))
            for m in metadata
            if gold_section in (m.get("section") or "").lower()
        }
        if not golds:
            continue
        cases.append({"intent": detect_intent(lab["question"]), "gold_partitions": sorted(golds)})
    return cases


def build_task_scenarios_from_db(db, n_scenarios: int = 90) -> List[Dict]:
    """Convert stored scenario labels into model-ready TaskFeatures."""
    from app.models.task import CareTask, TaskStatus

    raw = load_benchmark("task_scenarios")
    if not raw:
        return []

    scenarios: List[Dict] = []
    for sc in raw[:n_scenarios]:
        feats = [
            TaskFeatures(
                task_id=t["task_id"], priority=t["priority"], acuity=t["acuity"],
                category=t["category"], overdue_hours=t["overdue_hours"],
                pending_hours=t["pending_hours"], nurse_open_tasks=t["nurse_open_tasks"],
            )
            for t in sc["tasks"]
        ]
        scenarios.append({"features": feats, "expert_order": sc["expert_order"]})
    return scenarios


def build_immune_datasets(db) -> Dict[str, List[Dict]]:
    """Split labeled vitals into a clean training set and a held-out test set."""
    labels = load_benchmark("vitals")
    if not labels:
        from app.models.vital import VitalSign
        labels = [{
            "values": {f: getattr(v, f) for f in VITAL_FEATURES},
            "is_error": False, "corruption_type": "clean",
        } for v in db.query(VitalSign).all()]

    clean = [l["values"] for l in labels if not l["is_error"]]
    errors = [l["values"] for l in labels if l["is_error"]]

    # Train on 75% of normal data only, negative selection never sees an error.
    split = max(1, int(len(clean) * 0.75))
    return {
        "train_self": clean[:split],
        "test_normal": clean[split:] or clean[-6:],
        "test_anomalous": errors,
        "error_types": [l["corruption_type"] for l in labels if l["is_error"]],
    }


# --------------------------------------------------------------------------
# Orchestration
# --------------------------------------------------------------------------
def train_all(
    db,
    ranking_optimizer: str = "ga",
    generations: int = 40,
    compare_optimizers: bool = True,
    reindex_after_compression: bool = True,
) -> Dict:
    """Run all five optimizers and persist their artifacts."""
    from app.services.vector_store import vector_store

    report: Dict = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "project": settings.PROJECT_SHORT_NAME,
    }
    labels = load_benchmark("retrieval")
    logger.info("Training bio-inspired subsystem on %d labeled queries", len(labels))

    # NOTE ON ORDERING
    # Compression runs FIRST and reindexes every patient. It has to: the
    # evolved dimension mask changes the vector space, so cosine similarities
    # shift. Training the ranker before that would tune weights against
    # similarity values the served index no longer produces. Compression's own
    # fitness uses raw unprojected vectors, so it has no such dependency, and
    # routing partitions are likewise recomputed against the final index.

    # ---- 4. Embedding compression (binary GA) ----------------------------
    t0 = time.perf_counter()
    comp_cases = build_compression_cases(db, labels)
    comp_train, comp_test = split_cases(comp_cases, test_frac=0.3, seed=23)
    report["compression_cases"] = len(comp_cases)
    report["compression_split"] = {"train": len(comp_train), "test": len(comp_test)}
    if comp_train and comp_test:
        comp = train_compression(
            comp_train, dims_total=settings.EMBEDDING_DIM,
            generations=max(20, generations // 2), population=36,
        )
        # Held-out accuracy/speed: the mask never saw these queries.
        from app.bio.compression import _measure
        import numpy as _np
        held_base = _measure(comp_test, _np.ones(settings.EMBEDDING_DIM, dtype=bool))
        held_opt = _measure(comp_test, comp.mask)
        comp.baseline_metrics, comp.optimized_metrics = held_base, held_opt
        projector = CompressedProjector(comp.mask)
        bio_registry.set_projector(projector)
        payload = comp.to_dict()
        payload["train_seconds"] = round(time.perf_counter() - t0, 2)
        bio_registry.write("compression", payload)
        report["compression"] = {
            "baseline": comp.baseline_metrics.to_dict(),
            "optimized": comp.optimized_metrics.to_dict(),
            "improvement": comp.improvement(),
            "seconds": round(time.perf_counter() - t0, 2),
        }
        if reindex_after_compression:
            # Indices must be rebuilt in the evolved subspace or queries and
            # documents would live in different vector spaces.
            chunks = vector_store.reindex_all(db)
            report["reindexed_chunks"] = chunks
    else:
        report["compression"] = {"error": "no compression cases available"}

    # ---- 1. Ranking (GA, and PSO for comparison) -------------------------
    t0 = time.perf_counter()
    all_cases = build_ranking_cases(db, labels)
    train_cases, test_cases = split_cases(all_cases, test_frac=0.3, seed=11)
    report["ranking_cases"] = len(all_cases)
    report["ranking_split"] = {"train": len(train_cases), "test": len(test_cases)}

    if train_cases and test_cases:
        from app.bio.ranking import RankingWeights, evaluate_weights

        ga_result = train_ranking(train_cases, optimizer="ga", generations=generations, seed=42)
        best_result, results = ga_result, {"ga": ga_result.to_dict()}

        if compare_optimizers:
            pso_result = train_ranking(train_cases, optimizer="pso",
                                       generations=generations, seed=42)
            results["pso"] = pso_result.to_dict()
            if pso_result.best_fitness > ga_result.best_fitness:
                best_result = pso_result

        bio_registry.set_ranking(best_result.best_weights)

        # The headline numbers are the HELD-OUT ones: weights were evolved on
        # the train split and never saw these queries.
        held_base = evaluate_weights(RankingWeights.baseline(), test_cases)
        held_opt = evaluate_weights(best_result.best_weights, test_cases)

        def pct(new, old):
            return 0.0 if old <= 1e-9 else round((new - old) / old * 100.0, 2)

        held_improvement = {
            "ndcg_at_5": pct(held_opt.ndcg_at_5, held_base.ndcg_at_5),
            "ndcg_at_3": pct(held_opt.ndcg_at_3, held_base.ndcg_at_3),
            "recall_at_5": pct(held_opt.recall_at_5, held_base.recall_at_5),
            "mrr": pct(held_opt.mrr, held_base.mrr),
        }

        payload = best_result.to_dict()
        payload["comparison"] = results
        payload["selected"] = best_result.optimizer
        payload["train_seconds"] = round(time.perf_counter() - t0, 2)
        payload["split"] = {"train": len(train_cases), "test": len(test_cases)}
        payload["heldout_baseline_metrics"] = held_base.to_dict()
        payload["heldout_optimized_metrics"] = held_opt.to_dict()
        payload["heldout_improvement_pct"] = held_improvement
        bio_registry.write("ranking", payload)

        report["ranking"] = {
            "selected": best_result.optimizer,
            "baseline": held_base.to_dict(),
            "optimized": held_opt.to_dict(),
            "improvement_pct": held_improvement,
            "train_metrics": best_result.optimized_metrics.to_dict(),
            "seconds": round(time.perf_counter() - t0, 2),
        }
    else:
        report["ranking"] = {"error": "insufficient labeled retrieval cases"}

    # ---- 5. Ant Colony routing -------------------------------------------
    t0 = time.perf_counter()
    routing_cases = build_routing_cases(db, labels)
    sizes = vector_store.partition_sizes()
    report["routing_cases"] = len(routing_cases)
    if routing_cases and sizes:
        router = AntColonyRouter(ACOConfig(n_ants=40, iterations=60, probe_budget=5,
                                   evaporation=0.10, alpha=1.0, beta=2.5))
        router.fit(routing_cases, sorted(sizes.keys()), sizes)
        metrics = router.evaluate(routing_cases)
        baseline = router.baseline_metrics(routing_cases)
        bio_registry.set_router(router)
        bio_registry.write("routing", {
            "router": router.to_dict(),
            "metrics": metrics.to_dict(),
            "baseline_metrics": baseline.to_dict(),
            "pheromone_matrix": router.pheromone_matrix(),
            "history": router.history,
            "train_seconds": round(time.perf_counter() - t0, 2),
        })
        report["routing"] = {
            "baseline": baseline.to_dict(),
            "optimized": metrics.to_dict(),
            "seconds": round(time.perf_counter() - t0, 2),
        }
    else:
        report["routing"] = {"error": "no routing cases or partitions available"}

    # ---- 2. Task prioritization (GA) -------------------------------------
    t0 = time.perf_counter()
    scenarios = build_task_scenarios_from_db(db, n_scenarios=110)
    tr_sc, te_sc = split_cases(scenarios, test_frac=0.3, seed=17)
    report["task_scenarios"] = len(scenarios)
    report["task_split"] = {"train": len(tr_sc), "test": len(te_sc)}
    if tr_sc and te_sc:
        task_result = train_task_policy(tr_sc, generations=generations + 5)
        bio_registry.set_task_policy(task_result.best_policy)

        held_base = evaluate_policy(TaskPolicy.baseline(), te_sc)
        held_opt = evaluate_policy(task_result.best_policy, te_sc)

        def pctt(new, old):
            return 0.0 if abs(old) < 1e-9 else round((new - old) / abs(old) * 100.0, 2)

        held_imp = {
            "pairwise_agreement": pctt(held_opt.pairwise_agreement, held_base.pairwise_agreement),
            "kendall_tau": pctt(held_opt.kendall_tau, held_base.kendall_tau),
            "top1_accuracy": pctt(held_opt.top1_accuracy, held_base.top1_accuracy),
        }

        payload = task_result.to_dict()
        payload["train_seconds"] = round(time.perf_counter() - t0, 2)
        payload["split"] = {"train": len(tr_sc), "test": len(te_sc)}
        payload["heldout_baseline_metrics"] = held_base.to_dict()
        payload["heldout_optimized_metrics"] = held_opt.to_dict()
        payload["heldout_improvement_pct"] = held_imp
        bio_registry.write("tasks", payload)
        report["tasks"] = {
            "baseline": held_base.to_dict(),
            "optimized": held_opt.to_dict(),
            "improvement_pct": held_imp,
            "seconds": round(time.perf_counter() - t0, 2),
        }
    else:
        report["tasks"] = {"error": "no task scenarios available"}

    # ---- 3. Artificial Immune System -------------------------------------
    t0 = time.perf_counter()
    ds = build_immune_datasets(db)
    if ds["train_self"]:
        model = NegativeSelectionDetector(self_radius=0.11, max_detectors=320, seed=13)
        model.fit(ds["train_self"])
        metrics = evaluate_immune(model, ds["test_normal"], ds["test_anomalous"])
        bio_registry.set_immune(model)
        bio_registry.write("immune", {
            "model": model.to_dict(),
            "metrics": metrics.to_dict(),
            "train_self_count": len(ds["train_self"]),
            "test_normal_count": len(ds["test_normal"]),
            "test_anomalous_count": len(ds["test_anomalous"]),
            "error_types": sorted(set(ds["error_types"])),
            "generation_log": model.generation_log,
            "train_seconds": round(time.perf_counter() - t0, 2),
        })
        report["immune"] = {
            "metrics": metrics.to_dict(),
            "detectors": len(model.detectors),
            "seconds": round(time.perf_counter() - t0, 2),
        }
    else:
        report["immune"] = {"error": "no self samples available"}

    bio_registry.set_report(report)
    bio_registry.write("report", report)
    logger.info("Bio-inspired training complete.")
    return report
