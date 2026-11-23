"""
Persistence and live access for trained bio-inspired artifacts.

Training is offline and deterministic; serving is a cheap lookup. The registry
loads whatever has been trained from disk at startup, and every consumer in the
request path (retrieval, task board, vitals intake) asks the registry for the
current policy. If nothing has been trained yet, each accessor degrades to the
documented baseline rather than failing, the product still works, it just
works the un-optimized way.
"""
from __future__ import annotations

import json
import logging
import threading
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np

from app.bio.compression import CompressedProjector
from app.bio.immune import NegativeSelectionDetector
from app.bio.ranking import RankingWeights
from app.bio.routing import AntColonyRouter
from app.bio.tasks import TaskPolicy
from app.core.config import settings

logger = logging.getLogger(__name__)

ARTIFACTS = {
    "ranking": "ranking.json",
    "tasks": "task_policy.json",
    "immune": "immune.json",
    "compression": "compression.json",
    "routing": "routing.json",
    "report": "training_report.json",
}


class BioRegistry:
    """Thread-safe holder for the five trained artifacts."""

    def __init__(self, artifact_dir: Optional[Path] = None):
        self.dir = Path(artifact_dir or settings.BIO_ARTIFACT_DIR)
        self.dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()

        self._ranking: Optional[RankingWeights] = None
        self._task_policy: Optional[TaskPolicy] = None
        self._immune: Optional[NegativeSelectionDetector] = None
        self._projector: Optional[CompressedProjector] = None
        self._router: Optional[AntColonyRouter] = None
        self._report: Dict[str, Any] = {}

    # ---- io --------------------------------------------------------------
    def _path(self, key: str) -> Path:
        return self.dir / ARTIFACTS[key]

    def _read(self, key: str) -> Optional[Dict]:
        p = self._path(key)
        if not p.exists():
            return None
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception as e:
            logger.warning("Could not read bio artifact %s: %s", key, e)
            return None

    def write(self, key: str, payload: Dict) -> None:
        with self._lock:
            self._path(key).write_text(
                json.dumps(payload, indent=2, default=str), encoding="utf-8"
            )

    def load_all(self) -> None:
        """Called at application startup."""
        with self._lock:
            d = self._read("ranking")
            self._ranking = RankingWeights.from_dict(d["weights"]) if d and "weights" in d else None

            d = self._read("tasks")
            self._task_policy = TaskPolicy.from_dict(d["policy"]) if d and "policy" in d else None

            d = self._read("immune")
            self._immune = NegativeSelectionDetector.from_dict(d["model"]) if d and "model" in d else None

            d = self._read("compression")
            if d and d.get("mask"):
                self._projector = CompressedProjector(np.asarray(d["mask"], dtype=bool))
            else:
                self._projector = None

            d = self._read("routing")
            self._router = AntColonyRouter.from_dict(d["router"]) if d and "router" in d else None

            self._report = self._read("report") or {}

        logger.info(
            "Bio registry loaded, ranking:%s tasks:%s immune:%s compression:%s routing:%s",
            bool(self._ranking), bool(self._task_policy), bool(self._immune),
            bool(self._projector and self._projector.enabled),
            bool(self._router and self._router.trained),
        )

    # ---- accessors (always return something usable) ----------------------
    @property
    def ranking_weights(self) -> RankingWeights:
        if self._ranking and settings.BIO_RANKING_ENABLED:
            return self._ranking
        return RankingWeights.baseline()

    @property
    def ranking_is_optimized(self) -> bool:
        return bool(self._ranking) and settings.BIO_RANKING_ENABLED

    @property
    def task_policy(self) -> TaskPolicy:
        if self._task_policy and settings.BIO_TASK_GA_ENABLED:
            return self._task_policy
        return TaskPolicy.baseline()

    @property
    def task_is_optimized(self) -> bool:
        return bool(self._task_policy) and settings.BIO_TASK_GA_ENABLED

    @property
    def immune(self) -> Optional[NegativeSelectionDetector]:
        return self._immune if settings.BIO_AIS_ENABLED else None

    @property
    def projector(self) -> Optional[CompressedProjector]:
        if self._projector and self._projector.enabled and settings.BIO_COMPRESSION_ENABLED:
            return self._projector
        return None

    @property
    def router(self) -> Optional[AntColonyRouter]:
        if self._router and self._router.trained and settings.BIO_ACO_ENABLED:
            return self._router
        return None

    @property
    def report(self) -> Dict[str, Any]:
        return self._report

    # ---- setters used by the trainer -------------------------------------
    def set_ranking(self, weights: RankingWeights) -> None:
        with self._lock:
            self._ranking = weights

    def set_task_policy(self, policy: TaskPolicy) -> None:
        with self._lock:
            self._task_policy = policy

    def set_immune(self, model: NegativeSelectionDetector) -> None:
        with self._lock:
            self._immune = model

    def set_projector(self, projector: CompressedProjector) -> None:
        with self._lock:
            self._projector = projector

    def set_router(self, router: AntColonyRouter) -> None:
        with self._lock:
            self._router = router

    def set_report(self, report: Dict) -> None:
        with self._lock:
            self._report = report

    # ---- introspection ---------------------------------------------------
    def status(self) -> Dict[str, Any]:
        return {
            "artifact_dir": str(self.dir),
            "algorithms": {
                "ranking": {
                    "name": "Search Result Ranking",
                    "family": "Genetic Algorithm / Particle Swarm",
                    "trained": bool(self._ranking),
                    "enabled": settings.BIO_RANKING_ENABLED,
                    "active": self.ranking_is_optimized,
                },
                "tasks": {
                    "name": "Care Task Prioritization",
                    "family": "Genetic Algorithm",
                    "trained": bool(self._task_policy),
                    "enabled": settings.BIO_TASK_GA_ENABLED,
                    "active": self.task_is_optimized,
                },
                "immune": {
                    "name": "Clinical Data Anomaly Detection",
                    "family": "Artificial Immune System (Negative Selection)",
                    "trained": bool(self._immune),
                    "enabled": settings.BIO_AIS_ENABLED,
                    "active": bool(self.immune),
                    "detectors": len(self._immune.detectors) if self._immune else 0,
                },
                "compression": {
                    "name": "Embedding Dimension Selection",
                    "family": "Binary Genetic Algorithm",
                    "trained": bool(self._projector and self._projector.enabled),
                    "enabled": settings.BIO_COMPRESSION_ENABLED,
                    "active": bool(self.projector),
                    "out_dim": self._projector.out_dim if self._projector else 0,
                },
                "routing": {
                    "name": "Multi-Source Query Routing",
                    "family": "Ant Colony Optimization",
                    "trained": bool(self._router and self._router.trained),
                    "enabled": settings.BIO_ACO_ENABLED,
                    "active": bool(self.router),
                    "partitions": len(self._router.partitions) if self._router else 0,
                },
            },
        }


bio_registry = BioRegistry()
