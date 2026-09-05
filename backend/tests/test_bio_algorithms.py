"""
Tests for the bio-inspired optimizers.

These assert the properties that make the algorithms *correct*, not merely
runnable: that each optimizer actually improves its objective, that the immune
system trained only on normal data still catches planted errors, and that the
serving path degrades to a documented baseline when nothing is trained.
"""
import math

import numpy as np
import pytest

from app.bio.common import (
    BinaryGAConfig, BinaryGeneticAlgorithm, GAConfig, GeneticAlgorithm,
    PSOConfig, ParticleSwarm, kendall_tau, ndcg_at_k, recall_at_k, reciprocal_rank,
)
from app.bio.compression import CompressedProjector, _masked_scores
from app.bio.features import detect_intent, lexical_overlap, section_affinity, tokenize
from app.bio.immune import (
    NegativeSelectionDetector, VITAL_FEATURES, hard_range_violations, normalize_vector,
)
from app.bio.ranking import RankingWeights, evaluate_weights
from app.bio.routing import ACOConfig, AntColonyRouter, partition_key
from app.bio.tasks import TaskFeatures, TaskPolicy, categorize_task, evaluate_policy


# ---------------------------------------------------------------- metrics --
def test_ndcg_rewards_top_placement():
    """Same relevant items, better position must score strictly higher."""
    assert ndcg_at_k([1, 0, 0, 0, 0], 5) > ndcg_at_k([0, 0, 0, 0, 1], 5)
    assert ndcg_at_k([1, 1, 1], 3) == pytest.approx(1.0)
    assert ndcg_at_k([0, 0, 0], 3) == 0.0


def test_reciprocal_rank_and_recall():
    assert reciprocal_rank([0, 1, 0]) == pytest.approx(0.5)
    assert reciprocal_rank([0, 0, 0]) == 0.0
    assert recall_at_k([1, 0, 1], 3, 2) == pytest.approx(1.0)


def test_kendall_tau_bounds():
    assert kendall_tau([1, 2, 3], [1, 2, 3]) == pytest.approx(1.0)
    assert kendall_tau([1, 2, 3], [3, 2, 1]) == pytest.approx(-1.0)


# ------------------------------------------------------------- optimizers --
def test_genetic_algorithm_converges_on_known_optimum():
    target = 0.73
    ga = GeneticAlgorithm(
        GAConfig(genome_length=5, population_size=40, generations=30, seed=1),
        lambda g: -sum((x - target) ** 2 for x in g),
    )
    best, fit = ga.run()
    assert fit > -0.01
    for gene in best:
        assert abs(gene - target) < 0.08
    # Fitness must be monotonically non-decreasing: elitism guarantees it.
    bests = [h.best_fitness for h in ga.history]
    assert max(bests) == pytest.approx(fit, abs=1e-9)


def test_particle_swarm_converges_and_loses_diversity():
    ps = ParticleSwarm(
        PSOConfig(genome_length=4, swarm_size=30, iterations=30, seed=3),
        lambda g: -sum((x - 0.25) ** 2 for x in g),
    )
    best, fit = ps.run()
    assert fit > -0.01
    assert all(abs(g - 0.25) < 0.08 for g in best)
    # The swarm should contract as inertia decays.
    assert ps.history[-1].diversity < ps.history[0].diversity
    assert len(ps.swarm_trace) > 0


def test_binary_ga_finds_optimal_subset():
    """Reward the first 10 bits, penalize the rest — optimum is exactly known."""
    bga = BinaryGeneticAlgorithm(
        BinaryGAConfig(genome_length=24, population_size=40, generations=40,
                       mutation_rate=0.05, seed=2),
        lambda m: float(m[:10].sum()) - float(m[10:].sum()),
    )
    mask, fit = bga.run()
    assert fit >= 9.0
    assert mask[:10].sum() >= 9
    assert mask[10:].sum() <= 1


def test_binary_ga_never_returns_empty_mask():
    bga = BinaryGeneticAlgorithm(
        BinaryGAConfig(genome_length=16, population_size=12, generations=8,
                       mutation_rate=0.9, seed=4),
        lambda m: 1.0,
    )
    mask, _ = bga.run()
    assert mask.any()


# ---------------------------------------------------------------- features --
def test_intent_detection():
    assert detect_intent("What antibiotic dose was given?") == "medication"
    assert detect_intent("What did the sputum culture grow?") == "lab"
    assert detect_intent("qwerty zxcvb") == "general"


def test_section_affinity_prefers_matching_section():
    assert section_affinity("medication", "Plan & Orders") > \
           section_affinity("medication", "Subjective History")


def test_lexical_overlap_catches_verbatim_terms():
    """The signal embeddings blur: exact drug names and organisms."""
    q = tokenize("was ceftriaxone prescribed")
    assert lexical_overlap(q, "Started IV Ceftriaxone 2g daily.") > 0.0
    assert lexical_overlap(q, "Patient ambulated in corridor.") == 0.0


# ----------------------------------------------------------------- ranking --
def _mk_candidates():
    def meta(nid, section, ntype, date, text):
        return ({"note_id": nid, "section": section, "note_type": ntype,
                 "date_recorded": date, "chunk_text": text,
                 "partition": partition_key(ntype, section)}, 0.5)
    return [
        meta(1, "Subjective History", "PROGRESS", "2026-01-01 09:00",
             "Patient reports feeling tired and short of breath at night."),
        meta(2, "Plan & Orders", "PROGRESS", "2026-09-01 09:00",
             "Start IV Furosemide 80mg BID. Fluid restriction 1.5L daily."),
    ]


def test_baseline_weights_are_similarity_only():
    b = RankingWeights.baseline()
    assert b.w_similarity == 1.0
    assert (b.w_recency, b.w_lexical, b.w_type, b.w_section, b.w_length) == (0, 0, 0, 0, 0)


def test_evolved_weights_can_beat_similarity_baseline():
    """With equal cosine scores, the baseline cannot separate the candidates,
    but section+lexical signals can. This is the whole premise of #1."""
    cands = _mk_candidates()
    cases = [{
        "question": "What diuretic dose was prescribed?",
        "candidates": cands,
        "relevance": [0.0, 1.0],       # the Plan & Orders chunk is the answer
    }]
    baseline = evaluate_weights(RankingWeights.baseline(), cases)
    evolved = evaluate_weights(
        RankingWeights(w_similarity=0.3, w_lexical=0.6, w_section=0.8, w_recency=0.4), cases,
    )
    assert evolved.ndcg_at_5 >= baseline.ndcg_at_5
    assert evolved.mrr == pytest.approx(1.0)


def test_ranking_genome_roundtrip():
    genome = [0.4] * 14
    w = RankingWeights.from_genome(genome)
    again = RankingWeights.from_dict(w.to_dict())
    assert again.w_similarity == pytest.approx(w.w_similarity)
    assert again.half_life_days == pytest.approx(w.half_life_days)


def test_score_only_matches_score_candidates_ordering():
    """The fast optimizer path must agree with the explainable serving path."""
    w = RankingWeights(w_similarity=0.5, w_section=0.5, w_lexical=0.3)
    cands = _mk_candidates()
    q = "What diuretic dose was prescribed?"
    fast = w.score_only(cands, q)
    full = w.score_candidates(cands, q)
    fast_order = sorted(range(len(fast)), key=lambda i: -fast[i])
    assert [cands[i][0]["note_id"] for i in fast_order] == [m["note_id"] for m, _, _, _ in full]


# ------------------------------------------------------------------- tasks --
def test_task_categorization():
    assert categorize_task("Administer IV antibiotic dose") == "medication"
    assert categorize_task("Record full set of vital signs") == "vitals"
    assert categorize_task("Provide assisted bed bath") == "hygiene"


def test_ga_policy_can_outrank_priority_only_sort():
    """An overdue MEDIUM task on a CRITICAL patient should beat a not-yet-due
    HIGH task on a stable one — the exact case a fixed sort cannot express."""
    urgent = TaskFeatures(1, "MEDIUM", "CRITICAL", "medication", overdue_hours=9.0,
                          pending_hours=30.0, nurse_open_tasks=2)
    routine = TaskFeatures(2, "HIGH", "STABLE", "hygiene", overdue_hours=-8.0,
                           pending_hours=2.0, nurse_open_tasks=2)
    scenario = [{"features": [urgent, routine], "expert_order": [1, 2]}]

    baseline = evaluate_policy(TaskPolicy.baseline(), scenario)
    evolved = evaluate_policy(
        TaskPolicy(w_priority=0.35, w_acuity=0.9, w_overdue=0.85, w_pending=0.2,
                   w_workload=0.05, w_category=0.4, overdue_scale_hours=8.0), scenario)

    assert baseline.pairwise_agreement == 0.0    # priority-first gets it wrong
    assert evolved.pairwise_agreement == 1.0     # the evolved policy gets it right


def test_task_policy_scores_are_bounded():
    f = TaskFeatures(1, "STAT", "CRITICAL", "medication", 50.0, 500.0, 40)
    assert 0.0 <= TaskPolicy.baseline().score(f) <= 1.0


# ------------------------------------------------------------------ immune --
def _normal_vitals(n=90):
    rng = np.random.default_rng(0)
    out = []
    for _ in range(n):
        out.append({
            "heart_rate": float(rng.normal(78, 8)),
            "bp_systolic": float(rng.normal(122, 10)),
            "bp_diastolic": float(rng.normal(76, 7)),
            "resp_rate": float(rng.normal(16, 2)),
            "temp_celsius": float(rng.normal(36.8, 0.3)),
            "o2_saturation": float(rng.normal(97, 1.2)),
            "blood_glucose": float(rng.normal(100, 12)),
        })
    return out


def test_hard_range_screen_catches_impossible_values():
    v = {"bp_systolic": 1200, "heart_rate": 70}
    hits = hard_range_violations(v)
    assert len(hits) == 1 and hits[0]["feature"] == "bp_systolic"
    assert hard_range_violations({"heart_rate": 70}) == []


def test_negative_selection_trains_only_on_self_and_flags_nonself():
    """The defining property: never shown an error, still detects one."""
    model = NegativeSelectionDetector(self_radius=0.10, max_detectors=180, seed=5)
    model.fit(_normal_vitals())
    assert len(model.detectors) > 0

    # Every detector must lie outside the self-region — that is the censoring
    # guarantee that makes false alarms structurally rare.
    for d in model.detectors:
        d_self = float(np.min(np.linalg.norm(model.self_set - d.center, axis=1)))
        assert d_self > model.self_radius

    normal = {"heart_rate": 78, "bp_systolic": 121, "bp_diastolic": 76, "resp_rate": 16,
              "temp_celsius": 36.8, "o2_saturation": 97, "blood_glucose": 100}
    assert model.check(normal).is_anomalous is False

    # A decimal-shift typo the model has never seen.
    typo = dict(normal, temp_celsius=368.0)
    assert model.check(typo).is_anomalous is True


def test_immune_flags_physiologically_impossible_combination():
    model = NegativeSelectionDetector(self_radius=0.10, max_detectors=180, seed=5)
    model.fit(_normal_vitals())
    contradiction = {"heart_rate": 44, "bp_systolic": 88, "bp_diastolic": 96,
                     "resp_rate": 16, "temp_celsius": 36.8,
                     "o2_saturation": 97, "blood_glucose": 100}
    assert model.check(contradiction).is_anomalous is True


def test_immune_serialization_roundtrip():
    model = NegativeSelectionDetector(self_radius=0.1, max_detectors=60, seed=7)
    model.fit(_normal_vitals(40))
    restored = NegativeSelectionDetector.from_dict(model.to_dict())
    sample = {"heart_rate": 78, "bp_systolic": 122, "bp_diastolic": 76, "resp_rate": 16,
              "temp_celsius": 36.8, "o2_saturation": 97, "blood_glucose": 100}
    assert restored.check(sample).is_anomalous == model.check(sample).is_anomalous


def test_normalize_handles_missing_values():
    vec, mask = normalize_vector({"heart_rate": 80})
    assert mask.sum() == 1 and 0.0 <= vec[0] <= 1.0


# ------------------------------------------------------------- compression --
def test_masked_scores_are_true_cosines():
    """Renormalizing inside the subspace is what keeps threshold semantics valid."""
    rng = np.random.default_rng(0)
    docs = rng.normal(size=(5, 16))
    docs /= np.linalg.norm(docs, axis=1, keepdims=True)
    mask = np.zeros(16, dtype=bool); mask[:8] = True
    scores = _masked_scores(docs[0], docs, mask)
    assert scores[0] == pytest.approx(1.0, abs=1e-6)   # identical vector -> cosine 1
    assert np.all(scores <= 1.0 + 1e-6) and np.all(scores >= -1.0 - 1e-6)


def test_projector_reduces_dimension_and_renormalizes():
    mask = np.zeros(10, dtype=bool); mask[[1, 3, 5]] = True
    proj = CompressedProjector(mask)
    assert proj.enabled and proj.out_dim == 3
    out = proj.project(np.ones((4, 10), dtype=np.float32))
    assert out.shape == (4, 3)
    assert np.allclose(np.linalg.norm(out, axis=1), 1.0, atol=1e-5)


def test_disabled_projector_is_passthrough():
    proj = CompressedProjector(None)
    v = np.ones((2, 6), dtype=np.float32)
    assert not proj.enabled
    assert np.array_equal(proj.project(v), v)


# ------------------------------------------------------------------ routing --
def test_partition_key_normalizes_narrative_chunks():
    assert partition_key("SOAP", "Narrative Part 3") == "SOAP::Narrative"
    assert partition_key("PROGRESS", "Plan & Orders") == "PROGRESS::Plan & Orders"


def test_aco_learns_to_prefer_the_rewarding_partition():
    """Pheromone must concentrate on the partition that actually holds answers."""
    partitions = [f"P{i}" for i in range(8)]
    sizes = {p: 10 for p in partitions}
    cases = [{"intent": "medication", "gold_partitions": ["P3"]} for _ in range(40)]

    router = AntColonyRouter(ACOConfig(n_ants=25, iterations=40, probe_budget=2, seed=1))
    router.fit(cases, partitions, sizes)

    assert router.trained
    result = router.route("What medication dose was given?")
    assert "P3" in result["partitions"]

    metrics = router.evaluate(cases)
    assert metrics.hit_rate > 0.9
    assert metrics.scan_reduction_pct > 0     # fewer chunks than a full scan


def test_aco_untrained_router_returns_no_restriction():
    """An untrained router must not silently narrow the search."""
    router = AntColonyRouter()
    out = router.route("anything")
    assert out["trained"] is False and out["partitions"] == []


def test_aco_serialization_roundtrip():
    partitions = ["A", "B", "C"]
    cases = [{"intent": "lab", "gold_partitions": ["B"]}] * 12
    router = AntColonyRouter(ACOConfig(n_ants=10, iterations=10, probe_budget=1, seed=2))
    router.fit(cases, partitions, {p: 5 for p in partitions})
    restored = AntColonyRouter.from_dict(router.to_dict())
    assert restored.trained
    assert restored.route("lab result")["partitions"] == router.route("lab result")["partitions"]
