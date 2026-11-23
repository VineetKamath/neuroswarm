"""
Feature extraction for retrieval re-ranking.

The baseline engine ranks candidate note-chunks by a *single* signal: embedding
cosine similarity. A clinically good result also depends on how recent the note
is, what kind of note it is, whether the exact clinical terms appear verbatim,
and whether the SOAP section matches what the question is actually asking for.

This module turns each candidate into a small, interpretable feature vector.
The bio-inspired optimizers then evolve how those features should be weighed.
"""
from __future__ import annotations

import math
import re
from datetime import datetime
from typing import Dict, List, Sequence

# Order is fixed and load-bearing: genomes index into it.
NOTE_TYPES: List[str] = ["PROGRESS", "ADMISSION", "DISCHARGE", "CONSULT", "SOAP", "PROCEDURE"]

FEATURE_NAMES: List[str] = [
    "similarity",     # cosine from the sentence-transformer embedding
    "recency",        # exponential decay on note age
    "lexical",        # verbatim clinical-term overlap (embeddings miss exact codes/doses)
    "type_prior",     # evolved authority of this note type
    "section_match",  # does the SOAP section answer this kind of question?
    "length_norm",    # informative-length preference; penalizes stubs and rambles
]

# Which SOAP section tends to answer which kind of clinical question.
# ACO later learns the *empirical* version of this from query outcomes; here it
# provides the initial heuristic the GA is free to up- or down-weight.
INTENT_SECTION_AFFINITY: Dict[str, Dict[str, float]] = {
    "medication": {"Plan & Orders": 1.0, "Assessment & Diagnosis": 0.45, "Objective / Vitals / Labs": 0.3},
    "lab":        {"Objective / Vitals / Labs": 1.0, "Assessment & Diagnosis": 0.5, "Plan & Orders": 0.3},
    "vitals":     {"Objective / Vitals / Labs": 1.0, "Subjective History": 0.25, "Plan & Orders": 0.2},
    "diagnosis":  {"Assessment & Diagnosis": 1.0, "Chief Complaint": 0.55, "Plan & Orders": 0.35},
    "symptom":    {"Subjective History": 1.0, "Chief Complaint": 0.9, "Assessment & Diagnosis": 0.4},
    "plan":       {"Plan & Orders": 1.0, "Assessment & Diagnosis": 0.5},
    "history":    {"Subjective History": 1.0, "Chief Complaint": 0.6, "Assessment & Diagnosis": 0.35},
    "procedure":  {"Plan & Orders": 0.8, "Objective / Vitals / Labs": 0.6, "Assessment & Diagnosis": 0.5},
    "general":    {},
}

INTENT_KEYWORDS: Dict[str, Sequence[str]] = {
    "medication": ("medication", "med", "drug", "dose", "dosage", "mg", "prescri", "antibiotic",
                   "administer", "infusion", "titrate", "started on", "taking", "diuretic", "insulin",
                   "antiplatelet", "antimalarial", "anti-tubercular", "steroid", "analgesi", "fluids"),
    "lab":        ("lab", "culture", "wbc", "hemoglobin", "haemoglobin", "creatinine", "troponin", "bnp",
                   "panel", "result", "sputum", "blood test", "abg", "electrolyte", "platelet", "ns1",
                   "cbnaat", "smear", "parasite", "widal", "ecg", "x-ray", "angiograph", "bicarbonate"),
    "vitals":     ("vital", "blood pressure", "bp", "heart rate", "pulse", "temperature", "fever",
                   "saturation", "spo2", "o2", "respiratory rate", "glucose", "weight"),
    "diagnosis":  ("diagnos", "assessment", "impression", "condition", "why", "cause", "etiolog"),
    "symptom":    ("symptom", "complain", "pain", "short of breath", "dyspnea", "cough", "nausea",
                   "feel", "report", "onset"),
    "plan":       ("plan", "next step", "discharge", "follow up", "follow-up", "order", "recommend",
                   "management", "treatment"),
    "history":    ("history", "past", "background", "prior", "previously", "admitted for", "chronic"),
    "procedure":  ("procedure", "surgery", "catheter", "intubat", "drain", "biopsy", "echo", "scan",
                   "imaging", "x-ray", "ct "),
}

_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "what", "which", "who", "whom", "how", "when",
    "does", "do", "did", "of", "for", "on", "in", "to", "and", "or", "with", "at", "by", "this",
    "that", "there", "it", "its", "be", "been", "has", "have", "had", "patient", "patients", "any",
    "show", "me", "tell", "about", "his", "her", "their", "they", "please", "can", "you",
}

_TOKEN_RE = re.compile(r"[a-z0-9]+")

# Tokenizing the same chunk text on every fitness evaluation dominated training
# time; a population of 60 over 40 generations re-tokenizes each chunk 2400
# times. Caching makes the whole GA run in seconds instead of minutes.
_TOKEN_CACHE: Dict[str, List[str]] = {}
_TOKEN_SET_CACHE: Dict[str, set] = {}


def tokenize(text: str) -> List[str]:
    key = text or ""
    cached = _TOKEN_CACHE.get(key)
    if cached is None:
        cached = [t for t in _TOKEN_RE.findall(key.lower())
                  if t not in _STOPWORDS and len(t) > 1]
        if len(_TOKEN_CACHE) < 20000:
            _TOKEN_CACHE[key] = cached
    return cached


def token_set(text: str) -> set:
    key = text or ""
    cached = _TOKEN_SET_CACHE.get(key)
    if cached is None:
        cached = set(tokenize(key))
        if len(_TOKEN_SET_CACHE) < 20000:
            _TOKEN_SET_CACHE[key] = cached
    return cached


def detect_intent(question: str) -> str:
    """Classify a clinical question into one of the intent archetypes.

    Deliberately keyword-based and transparent: a clinician can audit exactly
    why a query routed the way it did, which an opaque classifier would not allow.
    """
    q = (question or "").lower()
    scores: Dict[str, int] = {}
    for intent, keywords in INTENT_KEYWORDS.items():
        hits = sum(1 for kw in keywords if kw in q)
        if hits:
            scores[intent] = hits
    if not scores:
        return "general"
    return max(scores.items(), key=lambda kv: kv[1])[0]


def _parse_date(value) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if not value:
        return None
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(value), fmt)
        except ValueError:
            continue
    return None


def age_in_days(date_recorded, reference: datetime | None = None) -> float:
    ref = reference or datetime.utcnow()
    dt = _parse_date(date_recorded)
    if dt is None:
        return 30.0  # neutral default rather than silently favouring unknown dates
    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None)
    return max(0.0, (ref - dt).total_seconds() / 86400.0)


def lexical_overlap(query_tokens: Sequence[str], chunk_text: str) -> float:
    """Fraction of meaningful query terms appearing verbatim in the chunk.

    Complements the embedding: dense vectors are good at paraphrase but blur
    exact identifiers (drug names, organisms, dose numbers) that clinicians
    search by literally.
    """
    if not query_tokens:
        return 0.0
    chunk_tokens = token_set(chunk_text)
    if not chunk_tokens:
        return 0.0
    q = set(query_tokens)
    return sum(1 for t in q if t in chunk_tokens) / len(q)


def section_affinity(intent: str, section: str) -> float:
    table = INTENT_SECTION_AFFINITY.get(intent, {})
    if not table:
        return 0.5  # unknown intent -> neutral, never penalizing
    for key, value in table.items():
        if key.lower() in (section or "").lower():
            return value
    return 0.15


def length_score(text: str, pivot: float) -> float:
    """Saturating length preference peaking near `pivot` characters."""
    n = len(text or "")
    if n <= 0:
        return 0.0
    ratio = n / max(pivot, 1.0)
    return float(math.exp(-((math.log(max(ratio, 1e-6))) ** 2) / 2.0))


def build_feature_matrix(
    candidates: Sequence,
    question: str,
    half_life_days: float,
    length_pivot: float,
    reference_time: datetime | None = None,
) -> List[Dict[str, float]]:
    """Compute the per-candidate feature dictionary.

    `candidates` is a sequence of (metadata_dict, cosine_similarity) pairs as
    returned by the vector store.
    """
    q_tokens = tokenize(question)
    intent = detect_intent(question)
    rows: List[Dict[str, float]] = []

    for meta, sim in candidates:
        age = age_in_days(meta.get("date_recorded"), reference_time)
        recency = float(math.pow(0.5, age / max(half_life_days, 0.5)))
        chunk = meta.get("chunk_text", "")
        rows.append({
            "similarity": float(max(0.0, min(1.0, sim))),
            "recency": recency,
            "lexical": lexical_overlap(q_tokens, chunk),
            "section_match": section_affinity(intent, meta.get("section", "")),
            "length_norm": length_score(chunk, length_pivot),
            "_note_type": meta.get("note_type", "PROGRESS"),
        })
    return rows
