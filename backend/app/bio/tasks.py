"""
Genetic-Algorithm care-task prioritization (Improvement #2).

WHERE IT PLUGS IN
    The task queue previously ordered work with a fixed two-key SQL sort:
    `ORDER BY due_time ASC, priority DESC`. That rule cannot express the
    trade-offs a charge nurse makes constantly — an overdue MEDIUM medication
    on a CRITICAL patient outranks a not-yet-due HIGH hygiene task, and no
    static sort key encodes that.

WHY BIO-INSPIRED
    We want a policy that reproduces expert clinical judgement. We can elicit
    *preferences* from clinicians ("this task should come before that one")
    far more easily than we can elicit a scoring formula. Pairwise-agreement
    is a discontinuous step function of the weights, so again there is no
    gradient to follow — a GA optimizes it directly.

FITNESS
    Fraction of expert-labeled pairwise orderings the policy reproduces,
    blended with Kendall's tau against full expert-ranked scenarios.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Sequence

from app.bio.common import (
    GAConfig, GeneticAlgorithm, GenerationRecord, clamp, kendall_tau, scale,
)

TASK_CATEGORIES: List[str] = [
    "medication", "assessment", "labs", "vitals", "mobility", "hygiene",
]

CATEGORY_KEYWORDS: Dict[str, Sequence[str]] = {
    "medication": ("medication", "dose", "administer", "iv ", "antibiotic", "insulin",
                   "furosemide", "infusion", "analgesi", "pain med", "drug"),
    "assessment": ("assess", "check", "review", "evaluat", "neuro", "wound", "pain score",
                   "consult", "round"),
    "labs":       ("lab", "draw", "blood", "culture", "specimen", "sample", "panel", "abg",
                   "troponin", "glucose stick"),
    "vitals":     ("vital", "bp", "blood pressure", "temperature", "oxygen", "spo2",
                   "saturation", "heart rate", "telemetry", "weigh"),
    "mobility":   ("ambulat", "mobil", "reposition", "turn", "physio", "transfer", "range of motion"),
    "hygiene":    ("hygiene", "bath", "linen", "oral care", "catheter care", "dressing change",
                   "grooming"),
}

PRIORITY_ORDINAL = {"STAT": 1.0, "HIGH": 0.72, "MEDIUM": 0.4, "LOW": 0.12}
ACUITY_ORDINAL = {"CRITICAL": 1.0, "ADMITTED": 0.55, "STABLE": 0.28, "DISCHARGED": 0.05}

GENOME_LENGTH = 14
GENE_LABELS = [
    "w_priority", "w_acuity", "w_overdue", "w_pending", "w_workload", "w_category",
    "overdue_scale_hours", "pending_scale_hours",
] + [f"prior_{c}" for c in TASK_CATEGORIES]

OVERDUE_SCALE_RANGE = (1.0, 48.0)
PENDING_SCALE_RANGE = (2.0, 96.0)


def categorize_task(title: str, description: str = "") -> str:
    blob = f"{title or ''} {description or ''}".lower()
    best, best_hits = "assessment", 0
    for cat, keywords in CATEGORY_KEYWORDS.items():
        hits = sum(1 for kw in keywords if kw in blob)
        if hits > best_hits:
            best, best_hits = cat, hits
    return best


def _as_naive(dt) -> Optional[datetime]:
    if dt is None:
        return None
    if isinstance(dt, str):
        for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(dt, fmt)
                break
            except ValueError:
                continue
        else:
            return None
    if isinstance(dt, datetime) and dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt if isinstance(dt, datetime) else None


@dataclass
class TaskFeatures:
    """Normalized, model-ready view of one care task."""
    task_id: int
    priority: str
    acuity: str
    category: str
    overdue_hours: float      # positive => past due
    pending_hours: float      # age since creation
    nurse_open_tasks: int

    def to_dict(self) -> Dict:
        return {
            "task_id": self.task_id, "priority": self.priority, "acuity": self.acuity,
            "category": self.category, "overdue_hours": round(self.overdue_hours, 2),
            "pending_hours": round(self.pending_hours, 2), "nurse_open_tasks": self.nurse_open_tasks,
        }


def extract_task_features(task, patient_status: str, nurse_open_tasks: int,
                          now: Optional[datetime] = None) -> TaskFeatures:
    now = _as_naive(now) or datetime.utcnow()
    due = _as_naive(getattr(task, "due_time", None))
    created = _as_naive(getattr(task, "created_at", None)) or now
    priority = getattr(task, "priority", None)
    priority = priority.value if hasattr(priority, "value") else str(priority or "MEDIUM")

    return TaskFeatures(
        task_id=getattr(task, "id", 0),
        priority=priority,
        acuity=str(patient_status or "ADMITTED"),
        category=categorize_task(getattr(task, "title", ""), getattr(task, "description", "")),
        overdue_hours=((now - due).total_seconds() / 3600.0) if due else 0.0,
        pending_hours=max(0.0, (now - created).total_seconds() / 3600.0),
        nurse_open_tasks=int(nurse_open_tasks or 0),
    )


@dataclass
class TaskPolicy:
    """Decoded prioritization policy — the evolved 'clinical instinct'."""
    w_priority: float = 1.0
    w_acuity: float = 0.0
    w_overdue: float = 0.0
    w_pending: float = 0.0
    w_workload: float = 0.0
    w_category: float = 0.0
    overdue_scale_hours: float = 12.0
    pending_scale_hours: float = 24.0
    category_priors: Dict[str, float] = field(default_factory=lambda: {c: 0.5 for c in TASK_CATEGORIES})

    @staticmethod
    def baseline() -> "TaskPolicy":
        """Reproduces the original hardcoded sort: priority first, due time second."""
        return TaskPolicy(w_priority=1.0, w_overdue=0.25, overdue_scale_hours=12.0)

    @classmethod
    def from_genome(cls, genome: Sequence[float]) -> "TaskPolicy":
        g = list(genome) + [0.5] * (GENOME_LENGTH - len(genome))
        return cls(
            w_priority=clamp(g[0]), w_acuity=clamp(g[1]), w_overdue=clamp(g[2]),
            w_pending=clamp(g[3]), w_workload=clamp(g[4]), w_category=clamp(g[5]),
            overdue_scale_hours=scale(g[6], *OVERDUE_SCALE_RANGE),
            pending_scale_hours=scale(g[7], *PENDING_SCALE_RANGE),
            category_priors={c: clamp(g[8 + i]) for i, c in enumerate(TASK_CATEGORIES)},
        )

    def to_dict(self) -> Dict:
        return {
            "w_priority": round(self.w_priority, 4), "w_acuity": round(self.w_acuity, 4),
            "w_overdue": round(self.w_overdue, 4), "w_pending": round(self.w_pending, 4),
            "w_workload": round(self.w_workload, 4), "w_category": round(self.w_category, 4),
            "overdue_scale_hours": round(self.overdue_scale_hours, 2),
            "pending_scale_hours": round(self.pending_scale_hours, 2),
            "category_priors": {k: round(v, 4) for k, v in self.category_priors.items()},
        }

    @classmethod
    def from_dict(cls, d: Dict) -> "TaskPolicy":
        base = cls()
        for key in ("w_priority", "w_acuity", "w_overdue", "w_pending", "w_workload",
                    "w_category", "overdue_scale_hours", "pending_scale_hours"):
            if key in d:
                setattr(base, key, d[key])
        base.category_priors = d.get("category_priors", base.category_priors)
        return base

    def score(self, f: TaskFeatures) -> float:
        """Urgency score in roughly [0, 1]; higher means 'do this sooner'."""
        overdue_norm = clamp(f.overdue_hours / max(self.overdue_scale_hours, 0.5), -1.0, 1.0)
        overdue_norm = (overdue_norm + 1.0) / 2.0           # remap to [0,1]
        pending_norm = clamp(f.pending_hours / max(self.pending_scale_hours, 0.5))
        # A heavily-loaded nurse's queue gets gently flattened so one nurse's
        # backlog does not monopolize the top of the ward-wide board.
        workload_norm = 1.0 - clamp(f.nurse_open_tasks / 12.0)

        parts = {
            "priority": self.w_priority * PRIORITY_ORDINAL.get(f.priority, 0.4),
            "acuity": self.w_acuity * ACUITY_ORDINAL.get(f.acuity, 0.5),
            "overdue": self.w_overdue * overdue_norm,
            "pending": self.w_pending * pending_norm,
            "workload": self.w_workload * workload_norm,
            "category": self.w_category * self.category_priors.get(f.category, 0.5),
        }
        total_w = sum([self.w_priority, self.w_acuity, self.w_overdue,
                       self.w_pending, self.w_workload, self.w_category]) or 1.0
        return sum(parts.values()) / total_w

    def explain(self, f: TaskFeatures) -> Dict:
        overdue_norm = (clamp(f.overdue_hours / max(self.overdue_scale_hours, 0.5), -1.0, 1.0) + 1) / 2
        total_w = sum([self.w_priority, self.w_acuity, self.w_overdue,
                       self.w_pending, self.w_workload, self.w_category]) or 1.0
        return {
            "score": round(self.score(f), 4),
            "features": f.to_dict(),
            "contribution": {
                "priority": round(self.w_priority * PRIORITY_ORDINAL.get(f.priority, 0.4) / total_w, 4),
                "acuity": round(self.w_acuity * ACUITY_ORDINAL.get(f.acuity, 0.5) / total_w, 4),
                "overdue": round(self.w_overdue * overdue_norm / total_w, 4),
                "pending": round(self.w_pending * clamp(f.pending_hours / max(self.pending_scale_hours, .5)) / total_w, 4),
                "workload": round(self.w_workload * (1 - clamp(f.nurse_open_tasks / 12.0)) / total_w, 4),
                "category": round(self.w_category * self.category_priors.get(f.category, 0.5) / total_w, 4),
            },
        }

    def order(self, features: Sequence[TaskFeatures]) -> List[TaskFeatures]:
        return sorted(features, key=self.score, reverse=True)


# --------------------------------------------------------------------------
# Evaluation against elicited expert judgement
# --------------------------------------------------------------------------
@dataclass
class TaskMetrics:
    pairwise_agreement: float
    kendall_tau: float
    top1_accuracy: float
    scenarios: int
    pairs: int

    def to_dict(self) -> Dict:
        return {
            "pairwise_agreement": round(self.pairwise_agreement, 4),
            "kendall_tau": round(self.kendall_tau, 4),
            "top1_accuracy": round(self.top1_accuracy, 4),
            "scenarios": self.scenarios, "pairs": self.pairs,
        }


def evaluate_policy(policy: TaskPolicy, scenarios: Sequence[Dict]) -> TaskMetrics:
    """A scenario = a set of tasks plus the expert's preferred ordering."""
    if not scenarios:
        return TaskMetrics(0.0, 0.0, 0.0, 0, 0)

    agree = pairs = 0
    tau_sum = top1 = 0.0
    for sc in scenarios:
        feats: List[TaskFeatures] = sc["features"]
        expert_order: List[int] = sc["expert_order"]
        by_id = {f.task_id: f for f in feats}
        scores = {f.task_id: policy.score(f) for f in feats}

        # Pairwise agreement over every expert-stated preference.
        for i in range(len(expert_order)):
            for j in range(i + 1, len(expert_order)):
                a, b = expert_order[i], expert_order[j]
                if a not in by_id or b not in by_id:
                    continue
                pairs += 1
                if scores[a] > scores[b]:
                    agree += 1

        model_order = [f.task_id for f in policy.order(feats)]
        tau_sum += kendall_tau(model_order, expert_order)
        if model_order and expert_order and model_order[0] == expert_order[0]:
            top1 += 1.0

    n = len(scenarios)
    return TaskMetrics(
        pairwise_agreement=(agree / pairs) if pairs else 0.0,
        kendall_tau=tau_sum / n,
        top1_accuracy=top1 / n,
        scenarios=n, pairs=pairs,
    )


@dataclass
class TaskTrainingResult:
    best_policy: TaskPolicy
    best_fitness: float
    history: List[GenerationRecord]
    baseline_metrics: TaskMetrics
    optimized_metrics: TaskMetrics

    def improvement_pct(self) -> Dict[str, float]:
        def pct(new, old):
            return 0.0 if abs(old) < 1e-9 else round((new - old) / abs(old) * 100.0, 2)
        return {
            "pairwise_agreement": pct(self.optimized_metrics.pairwise_agreement,
                                      self.baseline_metrics.pairwise_agreement),
            "kendall_tau": pct(self.optimized_metrics.kendall_tau, self.baseline_metrics.kendall_tau),
            "top1_accuracy": pct(self.optimized_metrics.top1_accuracy,
                                 self.baseline_metrics.top1_accuracy),
        }

    def to_dict(self) -> Dict:
        return {
            "optimizer": "Genetic Algorithm",
            "best_fitness": round(self.best_fitness, 6),
            "policy": self.best_policy.to_dict(),
            "gene_labels": GENE_LABELS,
            "history": [h.to_dict() for h in self.history],
            "baseline_metrics": self.baseline_metrics.to_dict(),
            "optimized_metrics": self.optimized_metrics.to_dict(),
            "improvement_pct": self.improvement_pct(),
        }


def train_task_policy(scenarios: Sequence[Dict], generations: int = 45,
                      population: int = 60, seed: int = 7) -> TaskTrainingResult:
    def fitness(genome: List[float]) -> float:
        m = evaluate_policy(TaskPolicy.from_genome(genome), scenarios)
        # Pairwise agreement is the primary signal; tau keeps global ordering
        # sane; top-1 makes sure the single most urgent task is right.
        return 0.6 * m.pairwise_agreement + 0.25 * ((m.kendall_tau + 1) / 2) + 0.15 * m.top1_accuracy

    ga = GeneticAlgorithm(
        GAConfig(genome_length=GENOME_LENGTH, population_size=population,
                 generations=generations, seed=seed),
        fitness,
    )
    best_genome, best_fit = ga.run()
    best_policy = TaskPolicy.from_genome(best_genome)
    return TaskTrainingResult(
        best_policy=best_policy,
        best_fitness=best_fit,
        history=ga.history,
        baseline_metrics=evaluate_policy(TaskPolicy.baseline(), scenarios),
        optimized_metrics=evaluate_policy(best_policy, scenarios),
    )
