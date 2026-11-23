"""
Structured patient-record facts for the retrieval assistant.

The vector index holds clinical *notes*. But the questions clinicians ask most
often at the bedside, "any allergies?", "latest vitals?", "what is pending?",
"give me a summary", are answered by the structured record (patient profile,
vitals table, task list), which no note necessarily repeats. Previously those
questions fell below the similarity gate and were refused.

This module renders the structured record as a handful of short, verbatim
"fact cards". They are matched to the question by the same sentence embedding
used for notes, plus a transparent keyword trigger, and cited exactly like a
note. Nothing is generated: every line is a field read straight from the
database.
"""
from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import numpy as np

from app.models.patient import Patient
from app.models.task import TaskStatus

RECORD_TYPE = "RECORD"
RECORD_TITLE = "Electronic Health Record"

# Keyword triggers per fact card. Deliberately simple and auditable.
FACT_TRIGGERS: Dict[str, Tuple[str, ...]] = {
    "Allergies": ("allerg", "reaction", "contraindicat", "sensitiv", "intoleran"),
    "Latest Vital Signs": ("vital", " bp", "blood pressure", "heart rate", "pulse", "spo2",
                           "saturation", "temperature", "temp ", "fever", "glucose", "sugar",
                           "oxygen", "respiratory rate", "observations", "obs"),
    "Open Care Tasks": ("task", "pending", "nursing", "to do", "todo", "due", "outstanding",
                        "overdue", "checklist"),
    "Medical History": ("history", "background", "past", "comorbid", "chronic", "smok"),
    "Patient Profile": ("diagnos", "admitted", "admission date", "ward", "room", "age", "how old",
                        "blood group", "status", "profile", "who is", "condition"),
    "Emergency Contact": ("contact", "family", "relative", "next of kin", "wife", "husband",
                          "son", "daughter", "phone", "attender"),
    "Notes on File": ("notes", "documented", "documentation", "which notes", "records available"),
}

SUMMARY_TRIGGERS = ("summar", "overview", "brief me", "tell me about", "status of",
                    "how is the patient", "how is he", "how is she", "handover", "snapshot")


def is_summary_request(question: str) -> bool:
    q = f" {question.lower()} "
    return any(t in q for t in SUMMARY_TRIGGERS)


def _age(dob) -> Optional[int]:
    if not dob:
        return None
    today = datetime.now(timezone.utc).date()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _fmt_dt(dt) -> str:
    if not dt:
        return "undated"
    try:
        return dt.strftime("%Y-%m-%d %H:%M")
    except Exception:  # pragma: no cover - defensive
        return str(dt)


def _vital_line(v) -> str:
    parts = []
    if v.heart_rate is not None:
        parts.append(f"HR {v.heart_rate} bpm")
    if v.bp_systolic is not None and v.bp_diastolic is not None:
        parts.append(f"BP {v.bp_systolic}/{v.bp_diastolic} mmHg")
    if v.resp_rate is not None:
        parts.append(f"RR {v.resp_rate}/min")
    if v.temp_celsius is not None:
        parts.append(f"Temp {v.temp_celsius}°C")
    if v.o2_saturation is not None:
        parts.append(f"SpO2 {v.o2_saturation}%")
    if v.blood_glucose is not None:
        parts.append(f"Glucose {v.blood_glucose} mg/dL")
    return ", ".join(parts)


def build_fact_cards(patient: Patient) -> List[Dict]:
    """Render the structured record as citeable fact cards."""
    now_str = _fmt_dt(datetime.now(timezone.utc))
    cards: List[Tuple[str, str]] = []

    age = _age(patient.date_of_birth)
    cards.append(("Patient Profile",
                  f"{patient.full_name}, {age if age is not None else '?'} year old {patient.gender or ''}, "
                  f"MRN {patient.mrn}, blood group {patient.blood_group or 'not recorded'}. "
                  f"Status {patient.status.value if patient.status else 'ADMITTED'} in "
                  f"{patient.ward or 'general ward'}, room {patient.room_number or 'TBD'}, admitted "
                  f"{_fmt_dt(patient.admission_date)}. Primary diagnosis: "
                  f"{patient.primary_diagnosis or 'under evaluation'}."))

    cards.append(("Allergies",
                  f"Documented drug allergies: {patient.allergies or 'No known drug allergies recorded'}."))

    if patient.medical_history:
        cards.append(("Medical History", f"Past medical history: {patient.medical_history}"))

    if patient.emergency_contact:
        cards.append(("Emergency Contact", f"Emergency contact: {patient.emergency_contact}."))

    vitals = list(patient.vital_signs or [])  # relationship is ordered newest first
    if vitals:
        latest = vitals[0]
        text = f"Latest vital signs recorded {_fmt_dt(latest.recorded_at)}: {_vital_line(latest)}."
        if latest.notes:
            text += f" Nursing note: {latest.notes}"
        if len(vitals) > 1:
            first = vitals[-1]
            text += (f" Earliest set on file ({_fmt_dt(first.recorded_at)}): {_vital_line(first)}. "
                     f"{len(vitals)} observation sets in total.")
        cards.append(("Latest Vital Signs", text))

    open_tasks = [t for t in (patient.care_tasks or [])
                  if t.status in (TaskStatus.PENDING, TaskStatus.IN_PROGRESS)]
    if open_tasks:
        lines = [f"{t.priority.value}, {t.title} (due {_fmt_dt(t.due_time)}, {t.status.value.replace('_', ' ').lower()})"
                 for t in sorted(open_tasks, key=lambda t: t.due_time or datetime.max)[:6]]
        cards.append(("Open Care Tasks",
                      f"{len(open_tasks)} open care task(s): " + "; ".join(lines) + "."))
    else:
        cards.append(("Open Care Tasks", "No open care tasks for this patient."))

    notes = list(patient.clinical_notes or [])
    if notes:
        listed = "; ".join(f"{n.title} ({n.note_type.value}, {_fmt_dt(n.created_at)})" for n in notes[:8])
        cards.append(("Notes on File", f"{len(notes)} clinical note(s) on file: {listed}."))

    out = []
    for section, body in cards:
        out.append({
            "note_id": 0,
            "patient_id": patient.id,
            "note_title": RECORD_TITLE,
            "note_type": RECORD_TYPE,
            "section": section,
            "author_name": "Structured record",
            "date_recorded": now_str,
            "chunk_text": f"[{RECORD_TYPE}: {RECORD_TITLE} | {section}]\n{body}",
            "body": body,
        })
    return out


class FactMatcher:
    """Scores fact cards against a question: embedding cosine + keyword trigger."""

    KEYWORD_BONUS = 0.35
    ACCEPT = 0.52

    def __init__(self):
        self._cache: Dict[Tuple, np.ndarray] = {}
        self._lock = threading.Lock()

    def _vectors(self, encoder, cards: List[Dict]) -> np.ndarray:
        key = tuple(c["chunk_text"] for c in cards)
        with self._lock:
            hit = self._cache.get(key)
        if hit is not None:
            return hit
        vecs = encoder([c["chunk_text"] for c in cards])
        with self._lock:
            if len(self._cache) > 512:
                self._cache.clear()
            self._cache[key] = vecs
        return vecs

    def match(self, encoder, query_vec: np.ndarray, question: str,
              cards: List[Dict], limit: int = 2) -> List[Tuple[Dict, float]]:
        if not cards:
            return []
        vecs = self._vectors(encoder, cards)
        sims = vecs @ query_vec
        q = f" {question.lower()} "
        scored = []
        for card, sim in zip(cards, sims):
            triggered = any(t in q for t in FACT_TRIGGERS.get(card["section"], ()))
            score = float(sim) + (self.KEYWORD_BONUS if triggered else 0.0)
            if triggered or score >= self.ACCEPT:
                scored.append((card, round(score, 4)))
        scored.sort(key=lambda x: -x[1])
        return scored[:limit]


fact_matcher = FactMatcher()
