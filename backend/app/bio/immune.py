"""
Artificial Immune System, real-valued negative selection (Improvement #3).

WHERE IT PLUGS IN
    A checkpoint over vital-sign records, run before the data is trusted for
    alerts, trend displays, or clinical decision-making.

THE BIOLOGICAL ANALOGY
    In the thymus, immature T-cells are exposed to the body's own proteins.
    Any cell that binds to "self" is destroyed; the survivors, by construction,
    only react to things the body has never seen. Those survivors then patrol
    the bloodstream, and anything they bind to is flagged as foreign.

    Here: "self" is the manifold of physiologically normal vital-sign vectors.
    We generate random candidate detectors in the same 7-D space, delete any
    that fall inside the self-region, and keep the rest as anomaly detectors.

WHY THIS RATHER THAN A CLASSIFIER
    A supervised model needs labeled examples of every error type. We do not
    have those, transcription typos, transposed digits, and unit mix-ups are
    open-ended and unpredictable. Negative selection trains on *normal data
    only*, so it flags error modes that were never enumerated in advance.
    This is the defining strength of the immune metaphor for safety checking.

VARIABLE-RADIUS DETECTORS (V-detector)
    Rather than fixing one radius, each detector's radius grows until it
    nearly touches the self-region. Large detectors blanket empty space
    cheaply; small ones squeeze into the crevices near the normal manifold.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np

# Feature order is fixed; detectors are stored against these indices.
VITAL_FEATURES: List[str] = [
    "heart_rate", "bp_systolic", "bp_diastolic", "resp_rate",
    "temp_celsius", "o2_saturation", "blood_glucose",
]

# Physiologically plausible recording ranges, used to normalize into a unit
# hypercube. Values outside these bounds are impossible recordings, not merely
# abnormal ones, and are caught by a hard range check before the AIS runs.
FEATURE_BOUNDS: Dict[str, Tuple[float, float]] = {
    "heart_rate": (20.0, 220.0),
    "bp_systolic": (50.0, 260.0),
    "bp_diastolic": (25.0, 160.0),
    "resp_rate": (5.0, 60.0),
    "temp_celsius": (30.0, 43.0),
    "o2_saturation": (50.0, 100.0),
    "blood_glucose": (20.0, 600.0),
}

FEATURE_UNITS: Dict[str, str] = {
    "heart_rate": "bpm", "bp_systolic": "mmHg", "bp_diastolic": "mmHg",
    "resp_rate": "/min", "temp_celsius": "°C", "o2_saturation": "%",
    "blood_glucose": "mg/dL",
}


def normalize_vector(values: Dict[str, Optional[float]]) -> Tuple[np.ndarray, np.ndarray]:
    """Map a vitals reading into [0,1]^7. Returns (vector, present_mask)."""
    vec = np.zeros(len(VITAL_FEATURES), dtype=float)
    mask = np.zeros(len(VITAL_FEATURES), dtype=bool)
    for i, name in enumerate(VITAL_FEATURES):
        v = values.get(name)
        if v is None:
            continue
        lo, hi = FEATURE_BOUNDS[name]
        vec[i] = min(1.0, max(0.0, (float(v) - lo) / (hi - lo)))
        mask[i] = True
    return vec, mask


def hard_range_violations(values: Dict[str, Optional[float]]) -> List[Dict]:
    """Deterministic impossibility screen, run ahead of the AIS.

    Two classes of error belong in rules rather than in learned detectors:

    1. Out-of-range values, a systolic of 1200 is a typo, not rare physiology.
    2. Impossible RELATIONSHIPS, a diastolic above the systolic cannot occur
       at any acuity, yet both numbers are individually plausible, so they sit
       close enough to the self-region that no detector reliably covers them.
       Negative selection exists to catch error modes nobody enumerated; a
       known-impossible relation is enumerable, so it gets a rule.
    """
    out = []
    for name in VITAL_FEATURES:
        v = values.get(name)
        if v is None:
            continue
        lo, hi = FEATURE_BOUNDS[name]
        if not (lo <= float(v) <= hi):
            out.append({
                "feature": name, "value": float(v),
                "plausible_range": [lo, hi], "unit": FEATURE_UNITS[name],
                "reason": f"{name.replace('_', ' ')} of {v} {FEATURE_UNITS[name]} lies outside "
                          f"the physiologically recordable range {lo}-{hi}.",
            })

    sys_v, dia_v = values.get("bp_systolic"), values.get("bp_diastolic")
    if sys_v is not None and dia_v is not None:
        sys_f, dia_f = float(sys_v), float(dia_v)
        if dia_f >= sys_f:
            out.append({
                "feature": "bp_diastolic", "value": dia_f,
                "plausible_range": [FEATURE_BOUNDS["bp_diastolic"][0], sys_f - 1],
                "unit": "mmHg",
                "reason": f"Diastolic pressure ({dia_f:.0f} mmHg) is not below systolic "
                          f"({sys_f:.0f} mmHg), physiologically impossible, most likely the "
                          f"two values were entered in the wrong fields.",
            })
        elif sys_f - dia_f < 10:
            out.append({
                "feature": "bp_diastolic", "value": dia_f,
                "plausible_range": [FEATURE_BOUNDS["bp_diastolic"][0], sys_f - 10],
                "unit": "mmHg",
                "reason": f"Pulse pressure of {sys_f - dia_f:.0f} mmHg is implausibly narrow; "
                          f"verify the blood pressure reading.",
            })
    return out


@dataclass
class Detector:
    """One matured 'T-cell': a hypersphere covering non-self space."""
    center: np.ndarray
    radius: float

    def distance(self, x: np.ndarray, mask: Optional[np.ndarray] = None) -> float:
        if mask is None or mask.all():
            return float(np.linalg.norm(x - self.center))
        if not mask.any():
            return math.inf
        diff = (x - self.center)[mask]
        # Rescale so partial readings are compared on the same footing as full ones.
        return float(np.linalg.norm(diff) * math.sqrt(len(self.center) / mask.sum()))

    def to_dict(self) -> Dict:
        return {"center": [round(float(c), 4) for c in self.center], "radius": round(self.radius, 4)}


@dataclass
class ImmuneReport:
    is_anomalous: bool
    anomaly_score: float               # 0 = deep inside normal, 1 = far outside
    matched_detector_radius: float
    nearest_self_distance: float
    hard_violations: List[Dict] = field(default_factory=list)
    suspect_features: List[Dict] = field(default_factory=list)
    explanation: str = ""

    def to_dict(self) -> Dict:
        return {
            "is_anomalous": self.is_anomalous,
            "anomaly_score": round(self.anomaly_score, 4),
            "matched_detector_radius": round(self.matched_detector_radius, 4),
            "nearest_self_distance": round(self.nearest_self_distance, 4),
            "hard_violations": self.hard_violations,
            "suspect_features": self.suspect_features,
            "explanation": self.explanation,
        }


class NegativeSelectionDetector:
    """V-detector style real-valued negative selection over vitals space."""

    def __init__(self, self_radius: float = 0.11, max_detectors: int = 320,
                 max_attempts: int = 60000, seed: int = 13):
        self.self_radius = self_radius
        self.max_detectors = max_detectors
        self.max_attempts = max_attempts
        self.seed = seed
        self.detectors: List[Detector] = []
        self.self_set: np.ndarray = np.zeros((0, len(VITAL_FEATURES)))
        self.feature_stats: Dict[str, Dict[str, float]] = {}
        self.generation_log: List[Dict] = []

    # ---- training --------------------------------------------------------
    def fit(self, self_samples: Sequence[Dict[str, Optional[float]]]) -> "NegativeSelectionDetector":
        vectors = []
        for s in self_samples:
            vec, mask = normalize_vector(s)
            if mask.sum() >= 4:          # need a reasonably complete reading to define 'self'
                vectors.append(vec)
        if not vectors:
            raise ValueError("Negative selection requires at least one complete self sample.")

        self.self_set = np.asarray(vectors, dtype=float)
        self._compute_feature_stats(self_samples)

        rng = random.Random(self.seed)
        np_rng = np.random.default_rng(self.seed)
        detectors: List[Detector] = []
        attempts = 0
        checkpoint_every = max(1, self.max_detectors // 25)

        while len(detectors) < self.max_detectors and attempts < self.max_attempts:
            attempts += 1
            candidate = np_rng.random(len(VITAL_FEATURES))

            # Censoring step: distance to the closest self sample.
            d_self = float(np.min(np.linalg.norm(self.self_set - candidate, axis=1)))
            if d_self <= self.self_radius:
                continue                                  # binds self -> apoptosis

            radius = d_self - self.self_radius            # grow until it nearly touches self

            # Skip candidates already blanketed by an existing detector, so
            # coverage spreads instead of piling up in one corner.
            if any(np.linalg.norm(candidate - d.center) < d.radius * 0.65 for d in detectors):
                continue

            detectors.append(Detector(center=candidate, radius=radius))
            if len(detectors) % checkpoint_every == 0:
                self.generation_log.append({
                    "detectors": len(detectors),
                    "attempts": attempts,
                    "mean_radius": round(float(np.mean([d.radius for d in detectors])), 4),
                    "coverage_estimate": round(self._estimate_coverage(detectors, np_rng), 4),
                })

        self.detectors = detectors
        return self

    def _compute_feature_stats(self, samples: Sequence[Dict[str, Optional[float]]]) -> None:
        for name in VITAL_FEATURES:
            vals = [float(s[name]) for s in samples if s.get(name) is not None]
            if vals:
                self.feature_stats[name] = {
                    "mean": float(np.mean(vals)), "std": float(np.std(vals) or 1e-6),
                    "min": float(np.min(vals)), "max": float(np.max(vals)),
                    "p05": float(np.percentile(vals, 5)), "p95": float(np.percentile(vals, 95)),
                }

    def _estimate_coverage(self, detectors: List[Detector], np_rng, probes: int = 900) -> float:
        """Monte-Carlo estimate of how much non-self space the repertoire covers."""
        if not detectors:
            return 0.0
        pts = np_rng.random((probes, len(VITAL_FEATURES)))
        d_self = np.min(np.linalg.norm(self.self_set[None, :, :] - pts[:, None, :], axis=2), axis=1)
        nonself = pts[d_self > self.self_radius]
        if len(nonself) == 0:
            return 1.0
        centers = np.asarray([d.center for d in detectors])
        radii = np.asarray([d.radius for d in detectors])
        dists = np.linalg.norm(nonself[:, None, :] - centers[None, :, :], axis=2)
        return float(np.mean(np.any(dists <= radii[None, :], axis=1)))

    # ---- inference -------------------------------------------------------
    def check(self, values: Dict[str, Optional[float]]) -> ImmuneReport:
        hard = hard_range_violations(values)
        vec, mask = normalize_vector(values)

        if not mask.any():
            return ImmuneReport(False, 0.0, 0.0, 1.0, hard, [], "No vital values recorded to check.")

        nearest_self = (
            float(np.min(np.linalg.norm(self.self_set[:, mask] - vec[mask], axis=1)
                         * math.sqrt(len(VITAL_FEATURES) / max(1, mask.sum()))))
            if len(self.self_set) else 1.0
        )

        best_margin, best_radius = -math.inf, 0.0
        for d in self.detectors:
            margin = d.radius - d.distance(vec, mask)
            if margin > best_margin:
                best_margin, best_radius = margin, d.radius

        matched = best_margin >= 0.0
        # Score blends "a detector bound this" with "how far from anything normal".
        score = min(1.0, max(0.0, 0.5 * (1.0 if matched else 0.0)
                             + 0.5 * min(1.0, nearest_self / max(self.self_radius * 3, 1e-6))))
        if hard:
            score = 1.0

        suspects = self._suspect_features(values)
        is_anom = bool(hard) or matched

        return ImmuneReport(
            is_anomalous=is_anom,
            anomaly_score=score,
            matched_detector_radius=best_radius if matched else 0.0,
            nearest_self_distance=nearest_self,
            hard_violations=hard,
            suspect_features=suspects,
            explanation=self._explain(is_anom, hard, suspects, nearest_self),
        )

    def _suspect_features(self, values: Dict[str, Optional[float]]) -> List[Dict]:
        """Attribute an anomaly to specific fields via robust z-scores, so the
        alert tells a nurse *which number* looks wrong."""
        out = []
        for name in VITAL_FEATURES:
            v = values.get(name)
            stats = self.feature_stats.get(name)
            if v is None or not stats:
                continue
            z = (float(v) - stats["mean"]) / max(stats["std"], 1e-6)
            if abs(z) >= 2.5:
                out.append({
                    "feature": name, "value": float(v), "unit": FEATURE_UNITS[name],
                    "z_score": round(z, 2),
                    "normal_band": [round(stats["p05"], 1), round(stats["p95"], 1)],
                })
        return sorted(out, key=lambda d: -abs(d["z_score"]))

    @staticmethod
    def _explain(is_anom: bool, hard: List[Dict], suspects: List[Dict], nearest: float) -> str:
        if hard:
            return hard[0]["reason"] + " This is almost certainly a documentation error."
        if not is_anom:
            return "Reading falls inside the learned self-region; no immune detector bound it."
        if suspects:
            s = suspects[0]
            direction = "above" if s["z_score"] > 0 else "below"
            return (f"A detector bound this reading. {s['feature'].replace('_', ' ').title()} of "
                    f"{s['value']} {s['unit']} sits {abs(s['z_score']):.1f}σ {direction} the learned "
                    f"norm (typical {s['normal_band'][0]}-{s['normal_band'][1]}). Verify before acting.")
        return (f"Reading lies {nearest:.3f} from the nearest normal pattern and was bound by a "
                f"non-self detector, the combination of values is unusual even though each "
                f"individual number looks acceptable.")

    # ---- persistence -----------------------------------------------------
    def to_dict(self) -> Dict:
        return {
            "self_radius": self.self_radius,
            "seed": self.seed,
            "detectors": [d.to_dict() for d in self.detectors],
            "self_set": [[round(float(x), 4) for x in row] for row in self.self_set],
            "feature_stats": self.feature_stats,
            "generation_log": self.generation_log,
        }

    @classmethod
    def from_dict(cls, d: Dict) -> "NegativeSelectionDetector":
        obj = cls(self_radius=d.get("self_radius", 0.11), seed=d.get("seed", 13))
        obj.detectors = [
            Detector(center=np.asarray(x["center"], dtype=float), radius=float(x["radius"]))
            for x in d.get("detectors", [])
        ]
        obj.self_set = np.asarray(d.get("self_set", []), dtype=float)
        if obj.self_set.size == 0:
            obj.self_set = np.zeros((0, len(VITAL_FEATURES)))
        obj.feature_stats = d.get("feature_stats", {})
        obj.generation_log = d.get("generation_log", [])
        return obj


@dataclass
class ImmuneMetrics:
    true_positives: int
    false_positives: int
    true_negatives: int
    false_negatives: int
    detectors: int
    coverage: float

    @property
    def detection_rate(self) -> float:
        d = self.true_positives + self.false_negatives
        return self.true_positives / d if d else 0.0

    @property
    def false_alarm_rate(self) -> float:
        d = self.false_positives + self.true_negatives
        return self.false_positives / d if d else 0.0

    @property
    def precision(self) -> float:
        d = self.true_positives + self.false_positives
        return self.true_positives / d if d else 0.0

    @property
    def f1(self) -> float:
        p, r = self.precision, self.detection_rate
        return 2 * p * r / (p + r) if (p + r) else 0.0

    def to_dict(self) -> Dict:
        return {
            "true_positives": self.true_positives, "false_positives": self.false_positives,
            "true_negatives": self.true_negatives, "false_negatives": self.false_negatives,
            "detectors": self.detectors, "coverage": round(self.coverage, 4),
            "detection_rate": round(self.detection_rate, 4),
            "false_alarm_rate": round(self.false_alarm_rate, 4),
            "precision": round(self.precision, 4), "f1": round(self.f1, 4),
        }


def evaluate_immune(model: NegativeSelectionDetector, normal: Sequence[Dict],
                    anomalous: Sequence[Dict]) -> ImmuneMetrics:
    tp = sum(1 for s in anomalous if model.check(s).is_anomalous)
    fn = len(anomalous) - tp
    fp = sum(1 for s in normal if model.check(s).is_anomalous)
    tn = len(normal) - fp
    np_rng = np.random.default_rng(model.seed)
    coverage = model._estimate_coverage(model.detectors, np_rng)
    return ImmuneMetrics(tp, fp, tn, fn, len(model.detectors), coverage)
