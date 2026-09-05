"""
Ant Colony Optimization for multi-source retrieval routing (Improvement #5).

HONEST SCOPING NOTE
    The original proposal framed this as routing across separate stores
    (encounters / prescriptions / reports). This codebase has a single
    clinical-notes store, so routing across those tables would be fiction.
    What *does* exist is a genuine partitioned search space: every indexed
    chunk carries a (note_type x SOAP section) label, giving 30+ addressable
    partitions. Routing across those partitions is a real optimization problem
    with a real cost saving, so that is what the colony optimizes.

WHERE IT PLUGS IN
    Ahead of the FAISS scan. Rather than scanning every partition for every
    query, the colony learns which partitions historically answered which
    class of question, and probes those first.

THE BIOLOGICAL ANALOGY
    Foraging ants deposit pheromone on the paths they travel, and deposit more
    when the path was short and led to food. Later ants probabilistically
    prefer strong trails, so good routes reinforce and bad ones evaporate.

    Here an "ant" is a query walking from an intent node to a sequence of
    partitions. Trails that surfaced the gold chunk early get reinforced in
    proportion to how few chunks had to be scanned.

WHY ACO AND NOT A LOOKUP TABLE
    Evaporation. A static table of "intent -> best partition" goes stale as
    documentation habits shift. Pheromone decay makes the policy continuously
    forget outdated routes while exploration keeps probing alternatives, so
    the routing adapts instead of ossifying.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np

from app.bio.features import detect_intent

INTENTS: List[str] = [
    "medication", "lab", "vitals", "diagnosis", "symptom",
    "plan", "history", "procedure", "general",
]


def partition_key(note_type: str, section: str) -> str:
    """Stable identifier for one searchable partition."""
    sec = (section or "General").split("(")[0].strip()
    if sec.lower().startswith("narrative"):
        sec = "Narrative"
    return f"{note_type or 'PROGRESS'}::{sec}"


@dataclass
class ACOConfig:
    n_ants: int = 30
    iterations: int = 40
    evaporation: float = 0.12      # rho — how fast stale trails fade
    alpha: float = 1.0             # pheromone influence
    beta: float = 2.0              # heuristic (prior affinity) influence
    q_deposit: float = 1.0
    initial_pheromone: float = 0.25
    probe_budget: int = 3          # partitions a query is allowed to visit
    min_pheromone: float = 0.02
    max_pheromone: float = 6.0
    seed: int = 99


@dataclass
class ACOMetrics:
    hit_rate: float                # gold chunk found within the probe budget
    mean_partitions_scanned: float
    mean_chunks_scanned: float
    scan_reduction_pct: float
    queries: int

    def to_dict(self) -> Dict:
        return {
            "hit_rate": round(self.hit_rate, 4),
            "mean_partitions_scanned": round(self.mean_partitions_scanned, 2),
            "mean_chunks_scanned": round(self.mean_chunks_scanned, 2),
            "scan_reduction_pct": round(self.scan_reduction_pct, 2),
            "queries": self.queries,
        }


class AntColonyRouter:
    """Pheromone-based router over (intent -> partition) edges."""

    def __init__(self, config: Optional[ACOConfig] = None):
        self.cfg = config or ACOConfig()
        self.partitions: List[str] = []
        self.pheromone: np.ndarray = np.zeros((len(INTENTS), 0))
        self.heuristic: np.ndarray = np.zeros((len(INTENTS), 0))
        self.partition_sizes: Dict[str, int] = {}
        self.history: List[Dict] = []
        self.trained = False

    # ---- setup -----------------------------------------------------------
    def _init_matrices(self, partitions: Sequence[str], cases: Sequence[Dict]) -> None:
        self.partitions = list(partitions)
        n_i, n_p = len(INTENTS), len(self.partitions)
        self.pheromone = np.full((n_i, n_p), self.cfg.initial_pheromone)

        # Heuristic prior eta: observed co-occurrence of intent and partition,
        # smoothed. Gives ants a sensible starting bias before any pheromone exists.
        counts = np.ones((n_i, n_p)) * 0.1
        for case in cases:
            i = INTENTS.index(case["intent"]) if case["intent"] in INTENTS else INTENTS.index("general")
            for p in case["gold_partitions"]:
                if p in self.partitions:
                    counts[i, self.partitions.index(p)] += 1.0
        self.heuristic = counts / counts.sum(axis=1, keepdims=True)

    # ---- probabilistic path construction ---------------------------------
    def _select_partitions(self, intent_idx: int, budget: int, rng: random.Random,
                           explore: bool = True) -> List[int]:
        """One ant's walk: pick `budget` partitions without replacement, with
        probability proportional to tau^alpha * eta^beta."""
        tau = self.pheromone[intent_idx] ** self.cfg.alpha
        eta = (self.heuristic[intent_idx] + 1e-9) ** self.cfg.beta
        desire = tau * eta

        chosen: List[int] = []
        available = list(range(len(self.partitions)))
        for _ in range(min(budget, len(available))):
            weights = np.array([desire[i] for i in available])
            total = weights.sum()
            if total <= 0 or not explore:
                pick = int(np.argmax(weights))
            else:
                r = rng.random() * total
                cum, pick = 0.0, len(available) - 1
                for idx, w in enumerate(weights):
                    cum += w
                    if cum >= r:
                        pick = idx
                        break
            chosen.append(available.pop(pick))
        return chosen

    # ---- training --------------------------------------------------------
    def fit(self, cases: Sequence[Dict], partitions: Sequence[str],
            partition_sizes: Dict[str, int]) -> "AntColonyRouter":
        """`cases`: {intent, gold_partitions}. `partition_sizes`: chunks per partition."""
        if not cases or not partitions:
            self.trained = False
            return self

        self._init_matrices(partitions, cases)
        self.partition_sizes = dict(partition_sizes)
        rng = random.Random(self.cfg.seed)
        total_chunks = max(1, sum(partition_sizes.values()))

        for it in range(self.cfg.iterations):
            deposits = np.zeros_like(self.pheromone)
            iter_hits, iter_scanned = 0, 0.0

            for _ in range(self.cfg.n_ants):
                case = cases[rng.randrange(len(cases))]
                intent = case["intent"] if case["intent"] in INTENTS else "general"
                i_idx = INTENTS.index(intent)

                route = self._select_partitions(i_idx, self.cfg.probe_budget, rng)
                names = [self.partitions[p] for p in route]
                scanned = sum(self.partition_sizes.get(n, 0) for n in names)
                gold = set(case["gold_partitions"])

                # Reward = did we find it, and how cheaply.
                found_at = next((r for r, n in enumerate(names) if n in gold), None)
                if found_at is None:
                    quality = 0.0
                else:
                    iter_hits += 1
                    rank_bonus = 1.0 / (found_at + 1)
                    cost = scanned / total_chunks
                    quality = rank_bonus * (1.0 - 0.5 * cost)

                iter_scanned += scanned
                if quality > 0:
                    for r, p in enumerate(route):
                        # Earlier steps on a successful route earn more credit.
                        deposits[i_idx, p] += self.cfg.q_deposit * quality / (r + 1)

            # Evaporate, then deposit — trails that stopped paying off decay away.
            self.pheromone *= (1.0 - self.cfg.evaporation)
            self.pheromone += deposits / max(1, self.cfg.n_ants)
            np.clip(self.pheromone, self.cfg.min_pheromone, self.cfg.max_pheromone,
                    out=self.pheromone)

            self.history.append({
                "iteration": it,
                "hit_rate": round(iter_hits / max(1, self.cfg.n_ants), 4),
                "mean_chunks_scanned": round(iter_scanned / max(1, self.cfg.n_ants), 2),
                "total_pheromone": round(float(self.pheromone.sum()), 4),
                "max_pheromone": round(float(self.pheromone.max()), 4),
            })

        self.trained = True
        return self

    # ---- inference -------------------------------------------------------
    def route(self, question: str, budget: Optional[int] = None) -> Dict:
        """Return the partitions this query should probe first."""
        intent = detect_intent(question)
        if not self.trained or not self.partitions:
            return {"intent": intent, "partitions": [], "trained": False, "strengths": {}}

        i_idx = INTENTS.index(intent) if intent in INTENTS else INTENTS.index("general")
        b = budget or self.cfg.probe_budget
        desire = (self.pheromone[i_idx] ** self.cfg.alpha) * ((self.heuristic[i_idx] + 1e-9) ** self.cfg.beta)
        order = np.argsort(-desire)[:b]
        names = [self.partitions[i] for i in order]
        return {
            "intent": intent,
            "partitions": names,
            "trained": True,
            "strengths": {self.partitions[i]: round(float(self.pheromone[i_idx, i]), 4) for i in order},
            "estimated_chunks": sum(self.partition_sizes.get(n, 0) for n in names),
        }

    def evaluate(self, cases: Sequence[Dict], budget: Optional[int] = None) -> ACOMetrics:
        if not cases or not self.trained:
            return ACOMetrics(0.0, 0.0, 0.0, 0.0, 0)
        b = budget or self.cfg.probe_budget
        total_chunks = max(1, sum(self.partition_sizes.values()))
        hits, scanned_sum, parts_sum = 0, 0.0, 0.0

        for case in cases:
            i_idx = INTENTS.index(case["intent"]) if case["intent"] in INTENTS else INTENTS.index("general")
            desire = (self.pheromone[i_idx] ** self.cfg.alpha) * ((self.heuristic[i_idx] + 1e-9) ** self.cfg.beta)
            order = np.argsort(-desire)[:b]
            names = [self.partitions[i] for i in order]
            if set(names) & set(case["gold_partitions"]):
                hits += 1
            scanned_sum += sum(self.partition_sizes.get(n, 0) for n in names)
            parts_sum += len(names)

        n = len(cases)
        mean_scanned = scanned_sum / n
        return ACOMetrics(
            hit_rate=hits / n,
            mean_partitions_scanned=parts_sum / n,
            mean_chunks_scanned=mean_scanned,
            scan_reduction_pct=100.0 * (1 - mean_scanned / total_chunks),
            queries=n,
        )

    def baseline_metrics(self, cases: Sequence[Dict]) -> ACOMetrics:
        """Exhaustive scan — what the system does without routing."""
        total_chunks = max(1, sum(self.partition_sizes.values()))
        return ACOMetrics(
            hit_rate=1.0,                       # scanning everything always contains the gold
            mean_partitions_scanned=float(len(self.partitions)),
            mean_chunks_scanned=float(total_chunks),
            scan_reduction_pct=0.0,
            queries=len(cases),
        )

    def pheromone_matrix(self) -> Dict:
        """Serializable trail map for the visualization page."""
        return {
            "intents": INTENTS,
            "partitions": self.partitions,
            "matrix": [[round(float(v), 4) for v in row] for row in self.pheromone],
            "partition_sizes": self.partition_sizes,
        }

    # ---- persistence -----------------------------------------------------
    def to_dict(self) -> Dict:
        return {
            "config": {
                "n_ants": self.cfg.n_ants, "iterations": self.cfg.iterations,
                "evaporation": self.cfg.evaporation, "alpha": self.cfg.alpha,
                "beta": self.cfg.beta, "probe_budget": self.cfg.probe_budget,
                "seed": self.cfg.seed,
            },
            "partitions": self.partitions,
            "pheromone": [[round(float(v), 5) for v in row] for row in self.pheromone],
            "heuristic": [[round(float(v), 5) for v in row] for row in self.heuristic],
            "partition_sizes": self.partition_sizes,
            "history": self.history,
            "trained": self.trained,
        }

    @classmethod
    def from_dict(cls, d: Dict) -> "AntColonyRouter":
        cfg = ACOConfig(**{k: v for k, v in d.get("config", {}).items()
                           if k in ACOConfig.__dataclass_fields__})
        obj = cls(cfg)
        obj.partitions = d.get("partitions", [])
        obj.pheromone = np.asarray(d.get("pheromone", []), dtype=float)
        obj.heuristic = np.asarray(d.get("heuristic", []), dtype=float)
        if obj.pheromone.size == 0:
            obj.pheromone = np.zeros((len(INTENTS), len(obj.partitions)))
            obj.heuristic = np.zeros((len(INTENTS), len(obj.partitions)))
        obj.partition_sizes = d.get("partition_sizes", {})
        obj.history = d.get("history", [])
        obj.trained = d.get("trained", False)
        return obj
