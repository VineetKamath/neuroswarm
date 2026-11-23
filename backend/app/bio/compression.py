"""
Evolved embedding compression (Improvement #4).

WHERE IT PLUGS IN
    Between the sentence-transformer encoder and the FAISS index. The encoder
    emits 384-dimensional vectors; this module evolves a binary mask selecting
    the subset of dimensions that actually carries the retrieval signal for
    *this clinical corpus*, and the index is built in that subspace.

WHY BIO-INSPIRED
    Choosing k of 384 dimensions is a combinatorial subset-selection problem
    with 2^384 candidates. It is not convex, not differentiable, and greedy
    forward selection gets trapped because dimensions interact, a dimension
    that is useless alone can be decisive alongside another. A binary GA with
    uniform crossover recombines useful dimension groups directly, which is
    precisely the building-block behaviour crossover is designed to exploit.

WHY THIS MATTERS HERE
    NeuroSwarm runs no language model, so retrieval *is* the response path.
    Every millisecond removed from vector search is a millisecond off the
    clinician's answer. Compression also shrinks the resident index, which
    matters because indices are held per patient.

FITNESS
    Retrieval nDCG@5 in the reduced subspace, minus a parsimony penalty
    proportional to the fraction of dimensions retained. The penalty is what
    stops the GA from trivially keeping all 384.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence

import numpy as np

from app.bio.common import BinaryGAConfig, BinaryGeneticAlgorithm, GenerationRecord, ndcg_at_k


def _masked_scores(query: np.ndarray, docs: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Cosine similarity computed only over the retained dimensions.

    Re-normalizing inside the subspace is essential: dropping dimensions
    shortens every vector, and without renormalization the scores are no
    longer cosines and the threshold semantics break.
    """
    q = query[mask]
    d = docs[:, mask]
    qn = np.linalg.norm(q)
    dn = np.linalg.norm(d, axis=1)
    if qn < 1e-9:
        return np.zeros(len(docs))
    dn = np.where(dn < 1e-9, 1e-9, dn)
    return (d @ q) / (dn * qn)


@dataclass
class CompressionMetrics:
    ndcg_at_5: float
    dims_kept: int
    dims_total: int
    search_ms: float
    bytes_per_vector: int

    @property
    def compression_ratio(self) -> float:
        return self.dims_total / max(1, self.dims_kept)

    def to_dict(self) -> Dict:
        return {
            "ndcg_at_5": round(self.ndcg_at_5, 4),
            "dims_kept": self.dims_kept, "dims_total": self.dims_total,
            "retention_pct": round(100.0 * self.dims_kept / max(1, self.dims_total), 2),
            "compression_ratio": round(self.compression_ratio, 2),
            "search_ms": round(self.search_ms, 4),
            "bytes_per_vector": self.bytes_per_vector,
        }


@dataclass
class CompressionResult:
    mask: np.ndarray
    best_fitness: float
    history: List[GenerationRecord]
    baseline_metrics: CompressionMetrics
    optimized_metrics: CompressionMetrics
    dimension_importance: List[float] = field(default_factory=list)

    def improvement(self) -> Dict[str, float]:
        b, o = self.baseline_metrics, self.optimized_metrics
        speedup = (b.search_ms / o.search_ms) if o.search_ms > 1e-9 else 1.0
        return {
            "ndcg_delta_pct": round(
                ((o.ndcg_at_5 - b.ndcg_at_5) / b.ndcg_at_5 * 100.0) if b.ndcg_at_5 > 1e-9 else 0.0, 2),
            "accuracy_retained_pct": round(
                (o.ndcg_at_5 / b.ndcg_at_5 * 100.0) if b.ndcg_at_5 > 1e-9 else 0.0, 2),
            "search_speedup_x": round(speedup, 2),
            "memory_saved_pct": round(
                100.0 * (1 - o.bytes_per_vector / max(1, b.bytes_per_vector)), 2),
        }

    def to_dict(self) -> Dict:
        return {
            "optimizer": "Binary Genetic Algorithm",
            "best_fitness": round(self.best_fitness, 6),
            "mask": [int(b) for b in self.mask],
            "dims_kept": int(self.mask.sum()),
            "history": [h.to_dict() for h in self.history],
            "baseline_metrics": self.baseline_metrics.to_dict(),
            "optimized_metrics": self.optimized_metrics.to_dict(),
            "improvement": self.improvement(),
            "dimension_importance": [round(x, 4) for x in self.dimension_importance],
        }


def _measure(cases: Sequence[Dict], mask: np.ndarray, repeats: int = 3) -> CompressionMetrics:
    """Evaluate accuracy and wall-clock search cost in the masked subspace."""
    dims_total = len(mask)
    dims_kept = int(mask.sum())

    ndcg_sum = 0.0
    t0 = time.perf_counter()
    for _ in range(repeats):
        ndcg_sum = 0.0
        for case in cases:
            scores = _masked_scores(case["query_vec"], case["doc_vecs"], mask)
            order = np.argsort(-scores)
            rels = [case["relevance"][i] for i in order]
            ndcg_sum += ndcg_at_k(rels, 5)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0 / max(1, repeats * len(cases))

    return CompressionMetrics(
        ndcg_at_5=ndcg_sum / max(1, len(cases)),
        dims_kept=dims_kept, dims_total=dims_total,
        search_ms=elapsed_ms,
        bytes_per_vector=dims_kept * 4,     # float32
    )


def train_compression(
    cases: Sequence[Dict],
    dims_total: int,
    generations: int = 30,
    population: int = 40,
    parsimony: float = 0.35,
    target_retention: float = 0.33,
    seed: int = 21,
) -> CompressionResult:
    """Evolve the dimension mask.

    `cases` entries hold: query_vec (d,), doc_vecs (n,d), relevance (n,).
    `parsimony` sets how hard the GA is pushed toward fewer dimensions;
    `target_retention` is the fraction below which no further reward accrues,
    preventing degenerate 1-dimension solutions.
    """
    full_mask = np.ones(dims_total, dtype=bool)
    baseline = _measure(cases, full_mask)

    def fitness(mask: np.ndarray) -> float:
        kept = int(mask.sum())
        if kept < 8:
            return -1.0                       # degenerate subspace
        ndcg_sum = 0.0
        for case in cases:
            scores = _masked_scores(case["query_vec"], case["doc_vecs"], mask)
            order = np.argsort(-scores)
            ndcg_sum += ndcg_at_k([case["relevance"][i] for i in order], 5)
        accuracy = ndcg_sum / max(1, len(cases))
        retention = kept / dims_total
        # Reward shrinking only until the target is reached.
        savings = max(0.0, min(1.0, (1.0 - retention) / (1.0 - target_retention)))
        return accuracy + parsimony * savings

    ga = BinaryGeneticAlgorithm(
        BinaryGAConfig(genome_length=dims_total, population_size=population,
                       generations=generations, init_density=0.45,
                       mutation_rate=2.5 / dims_total, seed=seed),
        fitness,
    )
    best_mask, best_fit = ga.run()

    # Per-dimension importance: variance of that coordinate across all indexed
    # chunks. Useful as an interpretable overlay on the evolved mask.
    all_docs = np.vstack([c["doc_vecs"] for c in cases]) if cases else np.zeros((1, dims_total))
    importance = np.var(all_docs, axis=0)
    importance = (importance / (importance.max() or 1.0)).tolist()

    return CompressionResult(
        mask=best_mask,
        best_fitness=best_fit,
        history=ga.history,
        baseline_metrics=baseline,
        optimized_metrics=_measure(cases, best_mask),
        dimension_importance=importance,
    )


class CompressedProjector:
    """Applies a learned mask to embeddings at index and query time."""

    def __init__(self, mask: Optional[np.ndarray] = None):
        self.mask = mask

    @property
    def enabled(self) -> bool:
        return self.mask is not None and bool(self.mask.any())

    @property
    def out_dim(self) -> int:
        return int(self.mask.sum()) if self.enabled else 0

    def project(self, vectors: np.ndarray) -> np.ndarray:
        """Select dimensions and re-normalize so inner product stays a cosine."""
        if not self.enabled:
            return vectors
        single = vectors.ndim == 1
        v = vectors.reshape(1, -1) if single else vectors
        out = v[:, self.mask]
        norms = np.linalg.norm(out, axis=1, keepdims=True)
        norms = np.where(norms < 1e-9, 1e-9, norms)
        out = (out / norms).astype(np.float32)
        return out[0] if single else out

    def to_dict(self) -> Dict:
        return {"mask": [int(b) for b in self.mask] if self.enabled else None,
                "out_dim": self.out_dim}

    @classmethod
    def from_dict(cls, d: Dict) -> "CompressedProjector":
        m = d.get("mask")
        return cls(np.asarray(m, dtype=bool) if m else None)
