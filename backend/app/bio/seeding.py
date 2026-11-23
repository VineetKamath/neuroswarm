"""
Generates the extended clinical cohort and writes the labeled benchmarks that
every bio-inspired optimizer trains against.
"""
from __future__ import annotations

import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Sequence

from app.bio.corpus import (
    CONDITIONS, FEMALE_FIRST_NAMES, LAST_NAMES, MALE_FIRST_NAMES, STABLE_CONTEXT_KEYS,
    TASK_TEMPLATES, _build_context, _fill, _pick, corrupt_vitals, expert_task_score,
    indian_phone,
)
from app.core.config import settings
from app.models.note import ClinicalNote, NoteType
from app.models.patient import Patient, PatientStatus
from app.models.task import CareTask, TaskPriority, TaskStatus
from app.models.user import User, UserRole
from app.models.vital import VitalSign

BENCH_DIR = settings.BIO_ARTIFACT_DIR.parent / "benchmarks"

NOTE_SEQUENCE = [
    (NoteType.ADMISSION, "Admission History & Physical"),
    (NoteType.PROGRESS, "Progress Note: Day {n}"),
    (NoteType.SOAP, "SOAP Review: Day {n}"),
    (NoteType.CONSULT, "Specialty Consultation"),
    (NoteType.PROCEDURE, "Procedure Record"),
    (NoteType.DISCHARGE, "Discharge Summary"),
]


def _sample_vitals(cond, rng: random.Random) -> Dict[str, float]:
    out = {}
    for name, (lo, hi) in cond.vitals_profile.items():
        v = rng.uniform(lo, hi)
        out[name] = round(v, 1) if name in ("temp_celsius", "o2_saturation", "blood_glucose") else int(v)
    return out


def generate_cohort(
    db,
    staff: Dict[str, List[User]],
    n_patients: int = 34,
    seed: int = 2026,
    now: Optional[datetime] = None,
) -> Dict:
    """Create synthetic patients with notes, vitals and tasks.

    Returns the labeled benchmark payloads (retrieval / tasks / vitals).
    """
    rng = random.Random(seed)
    now = now or datetime.now(timezone.utc)
    doctors = staff["doctors"]
    nurses = staff["nurses"]

    retrieval_labels: List[Dict] = []
    vitals_labels: List[Dict] = []
    task_rows: List[Dict] = []

    for idx in range(n_patients):
        cond = CONDITIONS[idx % len(CONDITIONS)]
        age = rng.randint(31, 88)
        sex = _pick(rng, ["male", "female"])
        first = _pick(rng, MALE_FIRST_NAMES if sex == "male" else FEMALE_FIRST_NAMES)
        last = _pick(rng, LAST_NAMES)
        admitted_days_ago = rng.randint(1, 21)
        ctx = _build_context(cond, rng, age, sex)

        status = _pick(rng, [PatientStatus.CRITICAL, PatientStatus.ADMITTED,
                             PatientStatus.ADMITTED, PatientStatus.STABLE])
        patient = Patient(
            mrn=f"NS-{4000 + idx}",
            first_name=first, last_name=last,
            date_of_birth=(now - timedelta(days=age * 365 + rng.randint(0, 364))).date(),
            gender="Male" if sex == "male" else "Female",
            blood_group=_pick(rng, ["A+", "A-", "B+", "O+", "O-", "AB+"]),
            ward=cond.ward,
            room_number=f"{cond.ward[:3].upper()}-{rng.randint(101, 428)}",
            admission_date=now - timedelta(days=admitted_days_ago),
            status=status,
            primary_diagnosis=_fill(cond.diagnosis, rng, ctx),
            allergies=_pick(rng, ["No known drug allergies", "No known drug allergies",
                                  "Penicillin (rash)", "Sulfa drugs (anaphylaxis)",
                                  "Iodinated contrast (urticaria)", "Codeine (nausea)",
                                  "Diclofenac (angioedema)", "Cotrimoxazole (skin rash)"]),
            medical_history=f"Background of {_pick(rng, ['hypertension', 'type 2 diabetes', 'chronic kidney disease', 'atrial fibrillation', 'COPD', 'ischaemic heart disease', 'hypothyroidism', 'treated pulmonary TB in childhood'])}. "
                            f"{_pick(rng, ['Ex-smoker.', 'Never smoked.', 'Current smoker.'])}",
            emergency_contact=(f"{_pick(rng, FEMALE_FIRST_NAMES if sex == 'male' else MALE_FIRST_NAMES)} {last} "
                               f"({_pick(rng, ['Spouse', 'Son', 'Daughter', 'Sibling'])}) - {indian_phone(rng)}"),
        )
        db.add(patient)
        db.flush()

        author = _pick(rng, doctors)
        nurse = _pick(rng, nurses)

        # ---- clinical notes ------------------------------------------
        n_notes = rng.randint(3, 5)
        answer_note_id: Optional[int] = None
        for j in range(n_notes):
            ntype, title_tpl = NOTE_SEQUENCE[j % len(NOTE_SEQUENCE)]
            if j == 0:
                nctx = ctx
            else:
                fresh = _build_context(cond, rng, age, sex)
                nctx = {k: (ctx[k] if k in STABLE_CONTEXT_KEYS or not isinstance(v, (int, float))
                            else v) for k, v in fresh.items()}
            created = now - timedelta(days=max(0, admitted_days_ago - j),
                                      hours=rng.randint(0, 20))
            note = ClinicalNote(
                patient_id=patient.id,
                author_id=author.id,
                note_type=ntype,
                title=title_tpl.format(n=j + 1),
                chief_complaint=(_fill(cond.complaint, rng, nctx) if j == 0 else
                                 f"Hospital day {j + 1} review. " + _fill(cond.complaint, rng, nctx)),
                subjective=_fill(cond.subjective, rng, nctx),
                objective=_fill(cond.objective, rng, nctx),
                assessment=_fill(cond.assessment, rng, nctx),
                plan=_fill(cond.plan, rng, nctx),
                content=(f"{_fill(cond.diagnosis, rng, ctx)}. "
                         f"{_fill(cond.assessment, rng, nctx)} "
                         f"Management: {_fill(cond.plan, rng, nctx)}"),
                created_at=created,
            )
            db.add(note)
            db.flush()
            # The admission note is the canonical source for this patient's
            # benchmark questions, it carries the full SOAP breakdown.
            if j == 0:
                answer_note_id = note.id

        # ---- labeled retrieval queries -------------------------------
        for question, section in cond.questions:
            retrieval_labels.append({
                "patient_id": patient.id,
                "question": question,
                "relevant_note_ids": [answer_note_id],
                "gold_section": section,
                "condition": cond.name,
            })

        # ---- vitals (clean series + planted errors) -------------------
        n_vitals = rng.randint(5, 9)
        for k in range(n_vitals):
            clean = _sample_vitals(cond, rng)
            recorded_at = now - timedelta(days=rng.randint(0, admitted_days_ago),
                                          hours=rng.randint(0, 23))
            plant_error = rng.random() < 0.12
            if plant_error:
                corrupted, ctype, desc = corrupt_vitals(clean, rng)
                values, label, note_txt = corrupted, ctype, f"[QA] {desc}"
            else:
                values, label, note_txt = clean, "clean", _pick(rng, [
                    "Routine observation round.", "Patient settled and comfortable.",
                    "Post-medication observation.", "Pre-mobilisation baseline.",
                    "Handover observation set."])

            db.add(VitalSign(
                patient_id=patient.id, recorded_by_id=nurse.id,
                heart_rate=int(values["heart_rate"]),
                bp_systolic=int(values["bp_systolic"]),
                bp_diastolic=int(values["bp_diastolic"]),
                resp_rate=int(values["resp_rate"]),
                temp_celsius=float(values["temp_celsius"]),
                o2_saturation=float(values["o2_saturation"]),
                blood_glucose=float(values["blood_glucose"]),
                notes=note_txt, recorded_at=recorded_at,
            ))
            vitals_labels.append({
                "patient_id": patient.id,
                "values": {k2: float(v2) for k2, v2 in values.items()},
                "is_error": plant_error,
                "corruption_type": label,
            })

        # ---- care tasks ----------------------------------------------
        n_tasks = rng.randint(3, 6)
        for _ in range(n_tasks):
            title, desc, category, severity = _pick(rng, TASK_TEMPLATES)
            priority = _pick(rng, [TaskPriority.STAT, TaskPriority.HIGH, TaskPriority.HIGH,
                                   TaskPriority.MEDIUM, TaskPriority.MEDIUM, TaskPriority.LOW])
            tstatus = _pick(rng, [TaskStatus.PENDING, TaskStatus.PENDING,
                                  TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED])
            due_offset_h = rng.uniform(-30.0, 26.0)
            created_offset_h = due_offset_h - rng.uniform(2.0, 60.0)
            assigned = _pick(rng, nurses)

            task = CareTask(
                patient_id=patient.id, assigned_nurse_id=assigned.id,
                created_by_id=author.id, title=title, description=desc,
                priority=priority, status=tstatus,
                due_time=now + timedelta(hours=due_offset_h),
                created_at=now + timedelta(hours=created_offset_h),
                completed_at=(now - timedelta(hours=rng.uniform(0.5, 8)))
                             if tstatus == TaskStatus.COMPLETED else None,
            )
            db.add(task)
            db.flush()

            if tstatus in (TaskStatus.PENDING, TaskStatus.IN_PROGRESS):
                task_rows.append({
                    "task_id": task.id,
                    "priority": priority.value,
                    "acuity": status.value,
                    "category": category,
                    "severity": severity,
                    "overdue_hours": -due_offset_h,
                    "pending_hours": -created_offset_h,
                    "nurse_id": assigned.id,
                })

    db.commit()
    return {
        "retrieval": retrieval_labels,
        "vitals": vitals_labels,
        "task_rows": task_rows,
    }


def build_task_scenarios(task_rows: Sequence[Dict], nurse_loads: Dict[int, int],
                         scenario_size: int = 6, n_scenarios: int = 90,
                         seed: int = 5) -> List[Dict]:
    """Group tasks into triage scenarios, each with an expert-preferred order.

    Mirrors how preferences would actually be elicited: a clinician is shown a
    handful of concurrent tasks and asked to order them, not asked to write a
    scoring formula.
    """
    rng = random.Random(seed)
    rows = list(task_rows)
    if len(rows) < scenario_size:
        return []

    scenarios: List[Dict] = []
    for _ in range(n_scenarios):
        sample = rng.sample(rows, scenario_size)
        scored = []
        for r in sample:
            s = expert_task_score(
                severity=r["severity"], priority=r["priority"], acuity=r["acuity"],
                overdue_hours=r["overdue_hours"], pending_hours=r["pending_hours"],
            )
            scored.append((r, s))
        scored.sort(key=lambda x: x[1], reverse=True)
        scenarios.append({
            "expert_order": [r["task_id"] for r, _ in scored],
            "tasks": [{
                "task_id": r["task_id"], "priority": r["priority"], "acuity": r["acuity"],
                "category": r["category"], "overdue_hours": round(r["overdue_hours"], 3),
                "pending_hours": round(r["pending_hours"], 3),
                "nurse_open_tasks": nurse_loads.get(r["nurse_id"], 0),
            } for r, _ in scored],
        })
    return scenarios


def write_benchmarks(payload: Dict, out_dir: Optional[Path] = None) -> Path:
    d = Path(out_dir or BENCH_DIR)
    d.mkdir(parents=True, exist_ok=True)
    for name, data in payload.items():
        (d / f"{name}.json").write_text(
            json.dumps(data, indent=2, default=str), encoding="utf-8"
        )
    return d


def load_benchmark(name: str, out_dir: Optional[Path] = None) -> List[Dict]:
    p = Path(out_dir or BENCH_DIR) / f"{name}.json"
    if not p.exists():
        return []
    return json.loads(p.read_text(encoding="utf-8"))
