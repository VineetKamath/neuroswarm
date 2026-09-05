"""
Bio-inspired retrieval re-ranking (Improvement #1).

WHERE IT PLUGS IN
    FAISS returns a candidate pool ordered by raw cosine similarity. Before
    those chunks reach the clinician, this module re-scores them using a
    weighted combination of six signals whose weights were *evolved* rather
    than hand-tuned.

WHY BIO-INSPIRED
    The scoring function is non-differentiable (nDCG is a rank metric, flat
    almost everywhere) and the search space is a 14-dimensional continuous
    box with interacting parameters. Gradient methods do not apply; grid
    search over 14 dimensions is intractable. Population-based metaheuristics
    are the natural fit, which is exactly the regime GA and PSO were built for.

FITNESS
    Mean nDCG@5 over a labeled benchmark of clinical queries, blended with
    Recall@5 and MRR so the optimizer is rewarded both for finding the right
    notes and for placing them first.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Sequence, Tuple

from app.bio.common import (
    GAConfig, GeneticAlgorithm, GenerationRecord, PSOConfig, ParticleSwarm,
    clamp, ndcg_at_k, recall_at_k, reciprocal_rank, scale,
)
from app.bio.features import NOTE_TYPES, build_feature_matrix

# ---- Genome layout -------------------------------------------------------
# 0..5   feature weights (similarity, recency, lexical, type, section, length)
# 6      recency half-life           -> [3, 180] days
# 7      length pivot                -> [80, 900] characters
# 8..13  per-note-type authority prior
GENOME_LENGTH = 14

GENE_LABELS = [
    "w_similarity", "w_recency", "w_lexical", "w_type", "w_section", "w_length",
    "half_life_days", "length_pivot",
] + [f"prior_{t}" for t in NOTE_TYPES]

HALF_LIFE_RANGE = (3.0, 180.0)
LENGTH_PIVOT_RANGE = (80.0, 900.0)


@dataclass
class RankingWeights:
    """Decoded, human-readable form of a ranking genome."""
    w_similarity: float = 1.0
    w_recency: float = 0.0
    w_lexical: float = 0.0
    w_type: float = 0.0
    w_section: float = 0.0
    w_length: float = 0.0
    half_life_days: float = 45.0
    length_pivot: float = 320.0
    type_priors: Dict[str, float] = field(default_factory=lambda: {t: 0.5 for t in NOTE_TYPES})

    @staticmethod
    def baseline() -> "RankingWeights":
        """The pre-optimization system: pure cosine similarity, nothing else."""
        return RankingWeights(w_similarity=1.0)

    @classmethod
    def from_genome(cls, genome: Sequence[float]) -> "RankingWeights":
        g = list(genome) + [0.5] * (GENOME_LENGTH - len(genome))
        return cls(
            w_similarity=clamp(g[0]),
            w_recency=clamp(g[1]),
            w_lexical=clamp(g[2]),
            w_type=clamp(g[3]),
            w_section=clamp(g[4]),
            w_length=clamp(g[5]),
            half_life_days=scale(g[6], *HALF_LIFE_RANGE),
            length_pivot=scale(g[7], *LENGTH_PIVOT_RANGE),
            type_priors={t: clamp(g[8 + i]) for i, t in enumerate(NOTE_TYPES)},
        )

    def to_dict(self) -> Dict:
        return {
            "w_similarity": round(self.w_similarity, 4),
            "w_recency": round(self.w_recency, 4),
            "w_lexical": round(self.w_lexical, 4),
            "w_type": round(self.w_type, 4),
            "w_section": round(self.w_section, 4),
            "w_length": round(self.w_length, 4),
            "half_life_days": round(self.half_life_days, 2),
            "length_pivot": round(self.length_pivot, 1),
            "type_priors": {k: round(v, 4) for k, v in self.type_priors.items()},
        }

    @classmethod
    def from_dict(cls, d: Dict) -> "RankingWeights":
        return cls(
            w_similarity=d.get("w_similarity", 1.0),
            w_recency=d.get("w_recency", 0.0),
            w_lexical=d.get("w_lexical", 0.0),
            w_type=d.get("w_type", 0.0),
            w_section=d.get("w_section", 0.0),
            w_length=d.get("w_length", 0.0),
            half_life_days=d.get("half_life_days", 45.0),
            length_pivot=d.get("length_pivot", 320.0),
            type_priors=d.get("type_priors", {t: 0.5 for t in NOTE_TYPES}),
        )

    # ---- scoring ---------------------------------------------------------
    def score_only(
        self,
        candidates: Sequence[Tuple[Dict, float]],
        question: str,
        reference_time: Optional[datetime] = None,
    ) -> List[float]:
        """Blended scores aligned to the input order — the hot path used by the
        optimizers, which need scores but not the explanation payload."""
        if not candidates:
            return []
        rows = build_feature_matrix(
            candidates, question, self.half_life_days, self.length_pivot, reference_time
        )
        total_weight = (
            self.w_similarity + self.w_recency + self.w_lexical
            + self.w_type + self.w_section + self.w_length
        ) or 1.0
        out = []
        for f in rows:
            out.append((
                self.w_similarity * f["similarity"]
                + self.w_recency * f["recency"]
                + self.w_lexical * f["lexical"]
                + self.w_type * self.type_priors.get(f["_note_type"], 0.5)
                + self.w_section * f["section_match"]
                + self.w_length * f["length_norm"]
            ) / total_weight)
        return out

    def score_candidates(
        self,
        candidates: Sequence[Tuple[Dict, float]],
        question: str,
        reference_time: Optional[datetime] = None,
    ) -> List[Tuple[Dict, float, float, Dict[str, float]]]:
        """Return (metadata, blended_score, raw_similarity, feature_breakdown),
        sorted best-first. The breakdown is surfaced in the UI so every ranking
        decision stays explainable at the bedside."""
        if not candidates:
            return []

        rows = build_feature_matrix(
            candidates, question, self.half_life_days, self.length_pivot, reference_time
        )

        scored = []
        for (meta, sim), feats in zip(candidates, rows):
            type_prior = self.type_priors.get(feats["_note_type"], 0.5)
            contributions = {
                "similarity": self.w_similarity * feats["similarity"],
                "recency": self.w_recency * feats["recency"],
                "lexical": self.w_lexical * feats["lexical"],
                "type_prior": self.w_type * type_prior,
                "section_match": self.w_section * feats["section_match"],
                "length_norm": self.w_length * feats["length_norm"],
            }
            total_weight = (
                self.w_similarity + self.w_recency + self.w_lexical
                + self.w_type + self.w_section + self.w_length
            ) or 1.0
            blended = sum(contributions.values()) / total_weight
            scored.append((meta, blended, float(sim), {
                "raw": {k: round(v, 4) for k, v in feats.items() if not k.startswith("_")},
                "contribution": {k: round(v / total_weight, 4) for k, v in contributions.items()},
            }))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored


# --------------------------------------------------------------------------
# Benchmark evaluation
# --------------------------------------------------------------------------
@dataclass
class RankingMetrics:
    ndcg_at_5: float
    recall_at_5: float
    mrr: float
    ndcg_at_3: float
    queries: int

    def to_dict(self) -> Dict:
        return {
            "ndcg_at_5": round(self.ndcg_at_5, 4),
            "ndcg_at_3": round(self.ndcg_at_3, 4),
            "recall_at_5": round(self.recall_at_5, 4),
            "mrr": round(self.mrr, 4),
            "queries": self.queries,
        }


def evaluate_weights(
    weights: RankingWeights,
    cases: Sequence[Dict],
    reference_time: Optional[datetime] = None,
) -> RankingMetrics:
    """Score a weight vector across every labeled benchmark query.

    Each case carries a pre-computed candidate pool AND a per-candidate graded
    relevance vector. Pre-computing the pool means training never re-runs the
    embedding model, which is what lets a 40-generation GA finish in seconds.
    """
    if not cases:
        return RankingMetrics(0.0, 0.0, 0.0, 0.0, 0)

    n5 = r5 = rr = n3 = 0.0
    for case in cases:
        rel_vec: Sequence[float] = case["relevance"]
        scores = weights.score_only(case["candidates"], case["question"], reference_time)
        order = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
        rels = [rel_vec[i] for i in order]
        total_relevant = sum(1 for r in rel_vec if r > 0)

        n5 += ndcg_at_k(rels, 5)
        n3 += ndcg_at_k(rels, 3)
        r5 += recall_at_k(rels, 5, total_relevant)
        rr += reciprocal_rank(rels)

    m = len(cases)
    return RankingMetrics(n5 / m, r5 / m, rr / m, n3 / m, m)


def _fitness(weights: RankingWeights, cases: Sequence[Dict], reference_time) -> float:
    """Composite objective. nDCG dominates (ordering quality is the goal), with
    recall and MRR as secondary pressure so the GA cannot win by gaming one metric."""
    m = evaluate_weights(weights, cases, reference_time)
    return 0.6 * m.ndcg_at_5 + 0.25 * m.recall_at_5 + 0.15 * m.mrr


@dataclass
class RankingTrainingResult:
    optimizer: str
    best_weights: RankingWeights
    best_fitness: float
    history: List[GenerationRecord]
    baseline_metrics: RankingMetrics
    optimized_metrics: RankingMetrics
    swarm_trace: List = field(default_factory=list)

    def improvement_pct(self) -> Dict[str, float]:
        def pct(new: float, old: float) -> float:
            if old <= 1e-9:
                return 0.0
            return round((new - old) / old * 100.0, 2)
        return {
            "ndcg_at_5": pct(self.optimized_metrics.ndcg_at_5, self.baseline_metrics.ndcg_at_5),
            "ndcg_at_3": pct(self.optimized_metrics.ndcg_at_3, self.baseline_metrics.ndcg_at_3),
            "recall_at_5": pct(self.optimized_metrics.recall_at_5, self.baseline_metrics.recall_at_5),
            "mrr": pct(self.optimized_metrics.mrr, self.baseline_metrics.mrr),
        }

    def to_dict(self) -> Dict:
        return {
            "optimizer": self.optimizer,
            "best_fitness": round(self.best_fitness, 6),
            "weights": self.best_weights.to_dict(),
            "gene_labels": GENE_LABELS,
            "history": [h.to_dict() for h in self.history],
            "baseline_metrics": self.baseline_metrics.to_dict(),
            "optimized_metrics": self.optimized_metrics.to_dict(),
            "improvement_pct": self.improvement_pct(),
            "swarm_trace": self.swarm_trace,
        }


def train_ranking(
    cases: Sequence[Dict],
    optimizer: str = "ga",
    generations: int = 40,
    population: int = 60,
    seed: int = 42,
    reference_time: Optional[datetime] = None,
) -> RankingTrainingResult:
    """Evolve retrieval weights with either a Genetic Algorithm or Particle Swarm."""
    def fitness(genome: List[float]) -> float:
        return _fitness(RankingWeights.from_genome(genome), cases, reference_time)

    swarm_trace: List = []
    if optimizer.lower() == "pso":
        pso = ParticleSwarm(
            PSOConfig(genome_length=GENOME_LENGTH, swarm_size=population,
                      iterations=generations, seed=seed),
            fitness,
        )
        best_genome, best_fit = pso.run(trace_dims=2, trace_every=max(1, generations // 20))
        history, swarm_trace = pso.history, pso.swarm_trace
        label = "Particle Swarm Optimization"
    else:
        ga = GeneticAlgorithm(
            GAConfig(genome_length=GENOME_LENGTH, population_size=population,
                     generations=generations, seed=seed),
            fitness,
        )
        best_genome, best_fit = ga.run()
        history = ga.history
        label = "Genetic Algorithm"

    best_weights = RankingWeights.from_genome(best_genome)
    return RankingTrainingResult(
        optimizer=label,
        best_weights=best_weights,
        best_fitness=best_fit,
        history=history,
        baseline_metrics=evaluate_weights(RankingWeights.baseline(), cases, reference_time),
        optimized_metrics=evaluate_weights(best_weights, cases, reference_time),
        swarm_trace=swarm_trace,
    )
