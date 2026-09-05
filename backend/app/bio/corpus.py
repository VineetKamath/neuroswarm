"""
Synthetic clinical corpus + labeled ground truth.

Every bio-inspired optimizer here is trained against measurable ground truth,
which the four hand-authored demo patients cannot supply on their own. This
module generates a larger, clinically coherent cohort and — crucially —
records the labels *while generating*, so the benchmark is exact rather than
guessed after the fact:

  * retrieval  : each generated question is emitted alongside the note id that
                 was written to answer it  -> nDCG / Recall / MRR ground truth
  * tasks      : each scenario carries an expert ordering derived from an
                 explicit triage rubric    -> pairwise-preference ground truth
  * vitals     : each planted error is emitted with its corruption type
                 -> TPR / FPR ground truth for the immune system

The generator is seeded, so the corpus and its labels are reproducible.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Sequence, Tuple

# --------------------------------------------------------------------------
# Clinical condition templates
# --------------------------------------------------------------------------
@dataclass
class ConditionTemplate:
    name: str
    diagnosis: str
    ward: str
    complaint: str
    subjective: str
    objective: str
    assessment: str
    plan: str
    medications: List[str]
    organism_or_marker: str
    vitals_profile: Dict[str, Tuple[float, float]]
    questions: List[Tuple[str, str]] = field(default_factory=list)  # (question, section it answers)


CONDITIONS: List[ConditionTemplate] = [
    ConditionTemplate(
        name="Acute Heart Failure",
        diagnosis="Acute Decompensated Heart Failure (HFrEF)",
        ward="Cardiology",
        complaint="Progressive dyspnea on exertion, orthopnea, and bilateral leg swelling over {d} days.",
        subjective="{age}yo {sex} with known HFrEF (EF {ef}%) reports worsening breathlessness, "
                   "sleeping on {pillows} pillows, and {wt}kg weight gain this week. Denies chest pain.",
        objective="BP {sbp}/{dbp} mmHg, HR {hr} bpm, SpO2 {spo2}% on {o2}. JVP elevated at 12cm. "
                  "Bibasilar crackles to mid-zones. Pitting edema {edema}+ bilaterally. "
                  "NT-proBNP {bnp} pg/mL, Creatinine {cr} mg/dL, Sodium {na} mEq/L.",
        assessment="Acute decompensated heart failure, likely precipitated by {trigger}. "
                   "Volume overloaded. Renal function {renal}.",
        plan="1. IV Furosemide {furo}mg BID with strict intake/output.\n"
             "2. Continue Sacubitril/Valsartan {entresto} BID and Metoprolol succinate {metop}mg daily.\n"
             "3. Fluid restriction 1.5L/day, daily standing weights.\n"
             "4. Repeat BNP and renal panel in 48 hours.",
        medications=["Furosemide", "Sacubitril/Valsartan", "Metoprolol succinate", "Spironolactone"],
        organism_or_marker="NT-proBNP",
        vitals_profile={"heart_rate": (78, 108), "bp_systolic": (98, 138), "bp_diastolic": (58, 86),
                        "resp_rate": (18, 26), "temp_celsius": (36.2, 37.1),
                        "o2_saturation": (88, 95), "blood_glucose": (88, 145)},
        questions=[
            ("What diuretic and dose is this patient receiving?", "Plan & Orders"),
            ("What was the NT-proBNP result?", "Objective / Vitals / Labs"),
            ("Why did this patient decompensate?", "Assessment & Diagnosis"),
            ("What symptoms did the patient report on admission?", "Subjective History"),
            ("What is the fluid restriction order?", "Plan & Orders"),
        ],
    ),
    ConditionTemplate(
        name="Community Acquired Pneumonia",
        diagnosis="Community-Acquired Pneumonia, {severity} severity",
        ward="Pulmonology",
        complaint="Productive cough with {sputum} sputum, fever, and pleuritic chest pain for {d} days.",
        subjective="{age}yo {sex} presenting with {d} days of fever to {tmax}°C, rigors, and "
                   "productive cough. Reports decreased appetite and generalized malaise.",
        objective="Temp {temp}°C, HR {hr} bpm, RR {rr}/min, SpO2 {spo2}% on {o2}. "
                  "Bronchial breathing and dullness at the {lobe}. WBC {wbc} x10^9/L with "
                  "neutrophilia. CRP {crp} mg/L. Chest X-ray: {lobe} consolidation. "
                  "Sputum culture: {organism}.",
        assessment="Community-acquired pneumonia with {lobe} consolidation. CURB-65 score {curb}. "
                   "Causative organism {organism}.",
        plan="1. IV {abx1} {abx1dose} daily plus oral {abx2} {abx2dose} BID.\n"
             "2. Supplemental oxygen titrated to SpO2 > 92%.\n"
             "3. Chest physiotherapy and incentive spirometry every 2 hours.\n"
             "4. Repeat chest imaging in 48-72 hours if no clinical improvement.",
        medications=["Ceftriaxone", "Azithromycin", "Amoxicillin-clavulanate", "Doxycycline"],
        organism_or_marker="Streptococcus pneumoniae",
        vitals_profile={"heart_rate": (88, 118), "bp_systolic": (100, 136), "bp_diastolic": (60, 84),
                        "resp_rate": (20, 30), "temp_celsius": (37.6, 39.4),
                        "o2_saturation": (86, 94), "blood_glucose": (90, 150)},
        questions=[
            ("What organism was isolated in the sputum culture?", "Objective / Vitals / Labs"),
            ("Which antibiotics were prescribed and at what dose?", "Plan & Orders"),
            ("What was the white cell count?", "Objective / Vitals / Labs"),
            ("What is the CURB-65 severity score?", "Assessment & Diagnosis"),
            ("What respiratory symptoms did the patient describe?", "Subjective History"),
        ],
    ),
    ConditionTemplate(
        name="Diabetic Ketoacidosis",
        diagnosis="Diabetic Ketoacidosis (Type 1 Diabetes Mellitus)",
        ward="Internal Medicine",
        complaint="Polyuria, polydipsia, vomiting, and abdominal pain for {d} days.",
        subjective="{age}yo {sex} with Type 1 diabetes reports missing insulin doses for {d} days "
                   "due to {reason}. Describes nausea, vomiting, and severe thirst.",
        objective="BP {sbp}/{dbp} mmHg, HR {hr} bpm, RR {rr}/min (Kussmaul), Temp {temp}°C. "
                  "Capillary glucose {glu} mg/dL. ABG: pH {ph}, bicarbonate {hco3} mEq/L, "
                  "anion gap {gap}. Serum ketones strongly positive. Potassium {k} mEq/L.",
        assessment="Diabetic ketoacidosis with anion gap of {gap} and pH {ph}. "
                   "Precipitant: {reason}. Potassium {kstate}.",
        plan="1. IV insulin infusion at {ins} units/hr after initial fluid resuscitation.\n"
             "2. Normal saline {fluid}mL bolus then 250mL/hr, transition to D5-half-normal "
             "when glucose < 250 mg/dL.\n"
             "3. Replace potassium to maintain 4.0-5.0 mEq/L; hourly capillary glucose.\n"
             "4. Hourly neurological observations; monitor for cerebral edema.",
        medications=["Insulin infusion", "Normal saline", "Potassium chloride", "Insulin glargine"],
        organism_or_marker="Serum ketones",
        vitals_profile={"heart_rate": (96, 126), "bp_systolic": (88, 122), "bp_diastolic": (52, 78),
                        "resp_rate": (22, 34), "temp_celsius": (36.0, 37.4),
                        "o2_saturation": (94, 100), "blood_glucose": (290, 520)},
        questions=[
            ("What was the arterial pH and bicarbonate?", "Objective / Vitals / Labs"),
            ("What insulin regimen was started?", "Plan & Orders"),
            ("What precipitated this episode of ketoacidosis?", "Assessment & Diagnosis"),
            ("What was the potassium replacement plan?", "Plan & Orders"),
            ("What symptoms brought this patient in?", "Subjective History"),
        ],
    ),
    ConditionTemplate(
        name="Acute Ischemic Stroke",
        diagnosis="Acute Ischemic Stroke, {territory} territory",
        ward="Neurology",
        complaint="Sudden onset {deficit} noticed {d} hours before arrival.",
        subjective="{age}yo {sex} last known well {d} hours prior. Family witnessed abrupt "
                   "onset of {deficit}. No preceding headache or seizure activity.",
        objective="BP {sbp}/{dbp} mmHg, HR {hr} bpm, glucose {glu} mg/dL. NIHSS {nihss}. "
                  "CT head: no haemorrhage, early ischemic changes in the {territory} territory. "
                  "CT angiography: {occlusion}. Platelets {plt} x10^9/L, INR {inr}.",
        assessment="Acute ischemic stroke in the {territory} territory, NIHSS {nihss}. "
                   "{thrombo}. Mechanism likely {mechanism}.",
        plan="1. {treatment}.\n"
             "2. Permissive hypertension; do not lower BP below 185/110 if thrombolysed.\n"
             "3. Neurological observations every 15 minutes for 2 hours, then hourly.\n"
             "4. Nil by mouth until formal swallow assessment; start Atorvastatin 80mg nightly.",
        medications=["Alteplase", "Aspirin", "Atorvastatin", "Clopidogrel"],
        organism_or_marker="NIHSS",
        vitals_profile={"heart_rate": (62, 96), "bp_systolic": (138, 190), "bp_diastolic": (76, 108),
                        "resp_rate": (14, 20), "temp_celsius": (36.2, 37.3),
                        "o2_saturation": (93, 99), "blood_glucose": (92, 190)},
        questions=[
            ("What was the NIHSS score on arrival?", "Objective / Vitals / Labs"),
            ("Was thrombolysis given and with what agent?", "Plan & Orders"),
            ("What did the CT angiography show?", "Objective / Vitals / Labs"),
            ("What is the likely stroke mechanism?", "Assessment & Diagnosis"),
            ("What neurological deficit did the family witness?", "Subjective History"),
        ],
    ),
    ConditionTemplate(
        name="Acute Kidney Injury",
        diagnosis="Acute Kidney Injury, KDIGO Stage {stage}",
        ward="Internal Medicine",
        complaint="Reduced urine output and ankle swelling over {d} days.",
        subjective="{age}yo {sex} reports passing minimal urine for {d} days following "
                   "{cause}. Reports nausea and increasing fatigue.",
        objective="BP {sbp}/{dbp} mmHg, HR {hr} bpm. Creatinine {cr} mg/dL (baseline {base} mg/dL), "
                  "eGFR {egfr} mL/min/1.73m2, Potassium {k} mEq/L, Urea {urea} mg/dL. "
                  "Urine output {uo} mL over 24 hours. Renal ultrasound: {us}.",
        assessment="AKI KDIGO stage {stage}, {aetiology} aetiology secondary to {cause}. "
                   "Hyperkalaemia {kstate}.",
        plan="1. Hold all nephrotoxic agents including NSAIDs and ACE inhibitors.\n"
             "2. Careful fluid resuscitation {fluid}mL/hr with hourly urine output charting.\n"
             "3. Treat hyperkalaemia with calcium gluconate and insulin-dextrose if K+ > 6.0.\n"
             "4. Daily renal panel; nephrology review if no improvement in 48 hours.",
        medications=["Calcium gluconate", "Insulin-dextrose", "Sodium bicarbonate", "Furosemide"],
        organism_or_marker="Creatinine",
        vitals_profile={"heart_rate": (68, 100), "bp_systolic": (96, 158), "bp_diastolic": (58, 96),
                        "resp_rate": (16, 24), "temp_celsius": (36.1, 37.2),
                        "o2_saturation": (93, 99), "blood_glucose": (88, 160)},
        questions=[
            ("What is the current creatinine and baseline?", "Objective / Vitals / Labs"),
            ("What KDIGO stage is this kidney injury?", "Assessment & Diagnosis"),
            ("Which medications were held?", "Plan & Orders"),
            ("What caused this acute kidney injury?", "Assessment & Diagnosis"),
            ("What did the renal ultrasound show?", "Objective / Vitals / Labs"),
        ],
    ),
    ConditionTemplate(
        name="COPD Exacerbation",
        diagnosis="Acute Exacerbation of COPD (GOLD {gold})",
        ward="Pulmonology",
        complaint="Increased breathlessness, wheeze, and change in sputum colour for {d} days.",
        subjective="{age}yo {sex} ex-smoker ({py} pack-years) with known COPD reports worsening "
                   "dyspnea, now breathless at rest, with {sputum} sputum.",
        objective="RR {rr}/min, SpO2 {spo2}% on {o2}, HR {hr} bpm, Temp {temp}°C. "
                  "Widespread polyphonic wheeze with prolonged expiratory phase. "
                  "ABG: pH {ph}, pCO2 {pco2} mmHg, pO2 {po2} mmHg, bicarbonate {hco3} mEq/L.",
        assessment="Acute infective exacerbation of COPD with {resp_failure}. "
                   "GOLD stage {gold}. Anthonisen type {anth}.",
        plan="1. Nebulised Salbutamol {salb}mg and Ipratropium 500mcg every 4-6 hours.\n"
             "2. Oral Prednisolone {pred}mg daily for 5 days.\n"
             "3. Oral {abx} for 5 days given purulent sputum.\n"
             "4. Controlled oxygen via Venturi mask targeting SpO2 88-92%.",
        medications=["Salbutamol", "Ipratropium", "Prednisolone", "Doxycycline"],
        organism_or_marker="pCO2",
        vitals_profile={"heart_rate": (86, 120), "bp_systolic": (104, 148), "bp_diastolic": (62, 90),
                        "resp_rate": (22, 32), "temp_celsius": (36.4, 38.4),
                        "o2_saturation": (84, 92), "blood_glucose": (94, 172)},
        questions=[
            ("What were the arterial blood gas results?", "Objective / Vitals / Labs"),
            ("What nebuliser doses were prescribed?", "Plan & Orders"),
            ("What is the target oxygen saturation range?", "Plan & Orders"),
            ("What GOLD stage and Anthonisen type is documented?", "Assessment & Diagnosis"),
            ("How long has the patient been breathless?", "Subjective History"),
        ],
    ),
]

FIRST_NAMES = ["Aaron", "Beatrice", "Caleb", "Delia", "Ezra", "Farah", "Gideon", "Hana", "Isaac",
               "Juno", "Kwame", "Lucia", "Mateo", "Nadia", "Omar", "Priya", "Quentin", "Rosa",
               "Samir", "Tessa", "Ulric", "Vera", "Wren", "Xiomara", "Yusuf", "Zara", "Alina",
               "Bruno", "Cora", "Dmitri", "Elena", "Felix", "Greta", "Hugo", "Iris", "Jonas"]
LAST_NAMES = ["Almeida", "Bergstrom", "Castellanos", "Dubois", "Eriksen", "Fontaine", "Gallagher",
              "Haruki", "Ibarra", "Jansen", "Kowalski", "Lindqvist", "Moreau", "Nakamura",
              "Okonkwo", "Petrov", "Quintero", "Rasmussen", "Silva", "Tanaka", "Ueda", "Volkov",
              "Wexler", "Yamamoto", "Zielinski", "Achebe", "Bianchi", "Cardoso"]


def _pick(rng: random.Random, seq: Sequence):
    return seq[rng.randrange(len(seq))]


def _fill(template: str, rng: random.Random, ctx: Dict) -> str:
    """Fill a template, tolerating placeholders a given condition does not define."""
    out = template
    for key, val in ctx.items():
        out = out.replace("{" + key + "}", str(val))
    return out


def _build_context(cond: ConditionTemplate, rng: random.Random, age: int, sex: str) -> Dict:
    vp = cond.vitals_profile
    def r(name, nd=0):
        lo, hi = vp[name]
        v = rng.uniform(lo, hi)
        return round(v, nd) if nd else int(v)

    return {
        "d": rng.randint(2, 9), "age": age, "sex": sex,
        "ef": rng.randint(22, 38), "pillows": rng.randint(2, 4),
        "wt": round(rng.uniform(2.0, 6.5), 1),
        "sbp": r("bp_systolic"), "dbp": r("bp_diastolic"), "hr": r("heart_rate"),
        "rr": r("resp_rate"), "spo2": r("o2_saturation"),
        "temp": r("temp_celsius", 1), "tmax": round(rng.uniform(38.2, 39.8), 1),
        "glu": r("blood_glucose"),
        "o2": _pick(rng, ["room air", "2L nasal cannula", "4L nasal cannula", "28% Venturi"]),
        "bnp": rng.randint(1800, 9400), "cr": round(rng.uniform(0.9, 3.4), 2),
        "base": round(rng.uniform(0.7, 1.3), 2), "na": rng.randint(128, 141),
        "egfr": rng.randint(14, 62), "urea": rng.randint(38, 122),
        "uo": rng.randint(110, 620), "k": round(rng.uniform(3.2, 6.4), 1),
        "edema": rng.randint(1, 3),
        "trigger": _pick(rng, ["dietary sodium indiscretion", "medication non-adherence",
                               "new atrial fibrillation", "an intercurrent respiratory infection"]),
        "renal": _pick(rng, ["stable", "mildly impaired", "acutely worsened"]),
        "furo": _pick(rng, [40, 60, 80, 120]), "entresto": _pick(rng, ["24/26mg", "49/51mg", "97/103mg"]),
        "metop": _pick(rng, [25, 50, 100]),
        "sputum": _pick(rng, ["rust-coloured", "green purulent", "yellow purulent", "blood-streaked"]),
        "lobe": _pick(rng, ["right lower lobe", "left lower lobe", "right middle lobe", "left upper lobe"]),
        "wbc": round(rng.uniform(12.4, 24.8), 1), "crp": rng.randint(88, 320),
        "organism": _pick(rng, ["Streptococcus pneumoniae", "Haemophilus influenzae",
                                "Klebsiella pneumoniae", "Moraxella catarrhalis",
                                "Mycoplasma pneumoniae"]),
        "curb": rng.randint(1, 4), "severity": _pick(rng, ["moderate", "high", "low"]),
        "abx1": _pick(rng, ["Ceftriaxone", "Co-amoxiclav", "Piperacillin-tazobactam"]),
        "abx1dose": _pick(rng, ["1g", "2g", "4.5g"]),
        "abx2": _pick(rng, ["Azithromycin", "Clarithromycin", "Doxycycline"]),
        "abx2dose": _pick(rng, ["500mg", "250mg", "100mg"]),
        "abx": _pick(rng, ["Doxycycline 100mg BID", "Amoxicillin 500mg TDS", "Co-amoxiclav 625mg TDS"]),
        "reason": _pick(rng, ["insulin pump failure", "running out of prescription",
                              "an intercurrent gastroenteritis", "financial difficulty accessing insulin"]),
        "ph": round(rng.uniform(7.02, 7.31), 2), "hco3": rng.randint(6, 19),
        "gap": rng.randint(18, 34), "ins": round(rng.uniform(3.0, 8.0), 1),
        "fluid": _pick(rng, [500, 1000, 1500]),
        "kstate": _pick(rng, ["within range", "mildly elevated", "requiring urgent correction"]),
        "deficit": _pick(rng, ["right-sided hemiparesis and expressive dysphasia",
                               "left facial droop with arm weakness",
                               "sudden visual field loss and unsteady gait",
                               "dense left hemiplegia and neglect"]),
        "nihss": rng.randint(4, 21),
        "territory": _pick(rng, ["left middle cerebral artery", "right middle cerebral artery",
                                 "posterior circulation", "left anterior cerebral artery"]),
        "occlusion": _pick(rng, ["proximal M1 occlusion", "M2 branch occlusion",
                                 "no large vessel occlusion", "basilar artery stenosis"]),
        "plt": rng.randint(140, 380), "inr": round(rng.uniform(0.9, 1.3), 1),
        "thrombo": _pick(rng, ["Within thrombolysis window", "Outside thrombolysis window",
                               "Thrombectomy candidate"]),
        "mechanism": _pick(rng, ["cardioembolic", "large artery atherosclerosis",
                                 "small vessel disease", "cryptogenic"]),
        "treatment": _pick(rng, ["IV Alteplase 0.9mg/kg administered, 10% as bolus",
                                 "Mechanical thrombectomy performed",
                                 "Aspirin 300mg loading dose given, no thrombolysis"]),
        "stage": rng.randint(1, 3),
        "cause": _pick(rng, ["severe gastroenteritis with dehydration", "NSAID use",
                             "contrast administration", "sepsis"]),
        "aetiology": _pick(rng, ["pre-renal", "intrinsic renal", "post-renal"]),
        "us": _pick(rng, ["normal sized kidneys, no hydronephrosis",
                          "bilateral hydronephrosis", "echogenic kidneys suggesting chronic disease"]),
        "gold": _pick(rng, ["II", "III", "IV"]), "py": rng.randint(20, 60),
        "pco2": rng.randint(44, 82), "po2": rng.randint(48, 72),
        "resp_failure": _pick(rng, ["type 2 respiratory failure", "compensated hypercapnia",
                                    "type 1 respiratory failure"]),
        "anth": _pick(rng, ["I", "II"]), "salb": _pick(rng, [2.5, 5.0]),
        "pred": _pick(rng, [30, 40]),
    }


# --------------------------------------------------------------------------
# Care task templates with an explicit triage rubric
# --------------------------------------------------------------------------
TASK_TEMPLATES: List[Tuple[str, str, str, int]] = [
    # (title, description, category, clinical_severity 1-5 used by the expert rubric)
    ("Administer IV antibiotic dose", "Give the scheduled intravenous antibiotic and document the time.", "medication", 5),
    ("Administer insulin per sliding scale", "Check capillary glucose and administer insulin per protocol.", "medication", 5),
    ("Administer scheduled analgesia", "Give prescribed pain medication and reassess score in 30 minutes.", "medication", 4),
    ("Record full set of vital signs", "Document HR, BP, RR, temperature and oxygen saturation.", "vitals", 4),
    ("Continuous telemetry review", "Review cardiac telemetry strip and escalate any new arrhythmia.", "vitals", 5),
    ("Draw morning blood panel", "Collect samples for renal panel and full blood count.", "labs", 3),
    ("Collect sputum specimen for culture", "Obtain a deep sputum sample before the next antibiotic dose.", "labs", 4),
    ("Perform neurological assessment", "Complete GCS and limb power assessment; escalate any decline.", "assessment", 5),
    ("Assess wound dressing site", "Inspect the surgical site for erythema, discharge or dehiscence.", "assessment", 3),
    ("Complete pain score assessment", "Document pain score using the numeric rating scale.", "assessment", 3),
    ("Assist patient with ambulation", "Mobilise the patient to the corridor and back with assistance.", "mobility", 2),
    ("Reposition patient to prevent pressure injury", "Turn and reposition; inspect pressure areas.", "mobility", 3),
    ("Provide assisted bed bath", "Complete personal hygiene care and change linen.", "hygiene", 1),
    ("Perform oral care", "Complete oral hygiene protocol for the ventilated patient.", "hygiene", 2),
    ("Change peripheral IV dressing", "Replace the cannula dressing and document site condition.", "hygiene", 2),
]


def expert_task_score(severity: int, priority: str, acuity: str,
                      overdue_hours: float, pending_hours: float) -> float:
    """The clinical triage rubric standing in for expert elicitation.

    This encodes how an experienced charge nurse actually triages: patient
    acuity and overdue status can promote a nominally lower-priority task above
    a higher-priority one. The GA never sees this function — it only sees the
    *orderings* it produces, exactly as it would only see a clinician's
    pairwise judgements. Recovering this policy from orderings alone is the
    learning problem.
    """
    p = {"STAT": 3.0, "HIGH": 2.1, "MEDIUM": 1.2, "LOW": 0.5}.get(priority, 1.2)
    a = {"CRITICAL": 1.9, "ADMITTED": 1.1, "STABLE": 0.7, "DISCHARGED": 0.25}.get(acuity, 1.0)
    overdue_boost = 1.0 + max(0.0, min(1.6, overdue_hours / 6.0))
    staleness = 1.0 + min(0.45, pending_hours / 90.0)
    return p * a * overdue_boost * staleness * (0.55 + 0.13 * severity)


# --------------------------------------------------------------------------
# Vitals corruption (planted errors for immune-system evaluation)
# --------------------------------------------------------------------------
CORRUPTION_TYPES = [
    "digit_transposition",   # 120 -> 210
    "decimal_shift",         # 37.0 -> 370 / 3.7
    "unit_confusion",        # °F recorded in a °C field
    "missing_digit",         # 98 -> 8
    "physiologic_impossible",# internally contradictory combination
    "copy_forward",          # a value copied from another patient's context
]


def corrupt_vitals(clean: Dict[str, Optional[float]], rng: random.Random) -> Tuple[Dict, str, str]:
    """Return (corrupted_reading, corruption_type, human_description)."""
    v = dict(clean)
    ctype = _pick(rng, CORRUPTION_TYPES)

    if ctype == "digit_transposition" and v.get("bp_systolic"):
        s = str(int(v["bp_systolic"]))
        if len(s) >= 2:
            swapped = s[1] + s[0] + s[2:]
            v["bp_systolic"] = float(int(swapped))
        desc = "Systolic blood pressure digits transposed during transcription."

    elif ctype == "decimal_shift" and v.get("temp_celsius"):
        v["temp_celsius"] = float(v["temp_celsius"]) * 10.0
        desc = "Temperature decimal point omitted."

    elif ctype == "unit_confusion" and v.get("temp_celsius"):
        v["temp_celsius"] = round(float(v["temp_celsius"]) * 9 / 5 + 32, 1)
        desc = "Temperature recorded in Fahrenheit into a Celsius field."

    elif ctype == "missing_digit" and v.get("o2_saturation"):
        v["o2_saturation"] = float(str(int(v["o2_saturation"]))[-1])
        desc = "Leading digit dropped from oxygen saturation."

    elif ctype == "physiologic_impossible":
        # Individually plausible numbers that cannot co-occur: a bradycardic,
        # hypotensive patient recorded with a high-normal saturation and
        # a diastolic exceeding the systolic.
        v["bp_systolic"], v["bp_diastolic"] = 88.0, 96.0
        v["heart_rate"] = 44.0
        desc = "Diastolic pressure exceeds systolic — physiologically impossible combination."

    else:  # copy_forward, or a fallback when the chosen field was absent
        ctype = "copy_forward"
        v["blood_glucose"] = 512.0
        v["heart_rate"] = 61.0
        desc = "Glucose value appears carried forward from an unrelated diabetic record."

    return v, ctype, desc
