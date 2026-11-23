"""
Synthetic clinical corpus + labeled ground truth.

Every bio-inspired optimizer here is trained against measurable ground truth,
which the four hand-authored demo patients cannot supply on their own. This
module generates a larger, clinically coherent cohort and, crucially,
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
    ConditionTemplate(
        name="Dengue Fever",
        diagnosis="Dengue Fever with Warning Signs and Thrombocytopenia",
        ward="General Medicine",
        complaint="High-grade fever with severe body ache, retro-orbital pain and rash for {d} days.",
        subjective="{age}yo {sex} from a dengue-endemic locality reports {d} days of high-grade fever "
                   "with chills, severe myalgia, headache behind the eyes and {dengue_sx}.",
        objective="Temp {temp}°C, HR {hr} bpm, BP {sbp}/{dbp} mmHg. Petechial rash over forearms, "
                  "tourniquet test positive. Platelet count {plt_d} x10^9/L, haematocrit {hct}%, "
                  "WBC {wbc_d} x10^9/L. NS1 antigen {ns1}, Dengue IgM {igm}. SGOT {sgot} U/L.",
        assessment="Dengue fever with warning signs ({warning}). Thrombocytopenia with platelets "
                   "{plt_d} x10^9/L and haematocrit {hct}%. No evidence of shock at present.",
        plan="1. IV Ringer lactate {fluid_d}mL/kg/hr, titrate to urine output and haematocrit.\n"
             "2. Paracetamol 650mg QID for fever; strictly avoid NSAIDs and aspirin because of bleeding risk.\n"
             "3. Platelet count and haematocrit every 12 hours; transfuse only if bleeding or below 10 x10^9/L.\n"
             "4. Monitor for warning signs: abdominal pain, mucosal bleed, rising haematocrit.",
        medications=["Ringer lactate", "Paracetamol", "Oral rehydration solution", "Pantoprazole"],
        organism_or_marker="NS1 antigen",
        vitals_profile={"heart_rate": (88, 120), "bp_systolic": (96, 128), "bp_diastolic": (58, 82),
                        "resp_rate": (18, 26), "temp_celsius": (37.8, 39.8),
                        "o2_saturation": (94, 99), "blood_glucose": (86, 140)},
        questions=[
            ("What is the latest platelet count?", "Objective / Vitals / Labs"),
            ("Was the NS1 antigen positive?", "Objective / Vitals / Labs"),
            ("What fluids are being given and at what rate?", "Plan & Orders"),
            ("Which warning signs of dengue are present?", "Assessment & Diagnosis"),
            ("Why should NSAIDs be avoided for this patient?", "Plan & Orders"),
        ],
    ),
    ConditionTemplate(
        name="Pulmonary Tuberculosis",
        diagnosis="Pulmonary Tuberculosis, sputum AFB {afb}, rifampicin {rif}",
        ward="Pulmonology",
        complaint="Cough for more than {weeks} weeks with evening fever, night sweats and weight loss.",
        subjective="{age}yo {sex} reports productive cough for {weeks} weeks, evening rise of "
                   "temperature, drenching night sweats and loss of {wt_loss}kg weight. "
                   "{tb_contact}.",
        objective="Temp {temp}°C, HR {hr} bpm, RR {rr}/min, SpO2 {spo2}% on {o2}. BMI {bmi} kg/m2. "
                  "Coarse crepitations over the {tb_zone}. Chest X-ray: {cxr_tb}. "
                  "Sputum AFB smear {afb}. CBNAAT: MTB detected, rifampicin {rif}. "
                  "HIV non-reactive. ESR {esr} mm/hr.",
        assessment="Microbiologically confirmed pulmonary tuberculosis, new case, rifampicin {rif}. "
                   "Weight band {wband} kg for dosing. Notified under NTEP.",
        plan="1. Start fixed-dose combination HRZE ({fdc} tablets daily) for the 2-month intensive phase.\n"
             "2. Pyridoxine 10mg daily to prevent isoniazid neuropathy.\n"
             "3. Baseline LFT and visual acuity; repeat LFT at 2 weeks.\n"
             "4. Airborne isolation, cough hygiene counselling and household contact screening.",
        medications=["Isoniazid", "Rifampicin", "Pyrazinamide", "Ethambutol"],
        organism_or_marker="CBNAAT",
        vitals_profile={"heart_rate": (84, 112), "bp_systolic": (98, 128), "bp_diastolic": (60, 82),
                        "resp_rate": (18, 26), "temp_celsius": (37.2, 38.6),
                        "o2_saturation": (90, 97), "blood_glucose": (80, 130)},
        questions=[
            ("What did the CBNAAT test show?", "Objective / Vitals / Labs"),
            ("Which anti-tubercular drugs were started?", "Plan & Orders"),
            ("What did the chest X-ray show?", "Objective / Vitals / Labs"),
            ("How much weight has the patient lost?", "Subjective History"),
            ("Is there rifampicin resistance?", "Assessment & Diagnosis"),
        ],
    ),
    ConditionTemplate(
        name="Acute STEMI",
        diagnosis="Acute {stemi_wall} Wall ST-Elevation Myocardial Infarction",
        ward="Cardiology",
        complaint="Crushing central chest pain radiating to the left arm with sweating for {hrs_pain} hours.",
        subjective="{age}yo {sex} with {risk} describes sudden retrosternal chest pain at rest, "
                   "radiating to the left arm and jaw, with profuse sweating and nausea for {hrs_pain} hours.",
        objective="BP {sbp}/{dbp} mmHg, HR {hr} bpm, SpO2 {spo2}%. ECG: ST elevation in {leads}. "
                  "hs-Troponin I {trop} ng/L. Echo: regional wall motion abnormality, LVEF {lvef}%. "
                  "Coronary angiography: {culprit}.",
        assessment="Acute {stemi_wall} wall STEMI, Killip class {killip}. Culprit lesion {culprit}. "
                   "Door-to-balloon time {dtb} minutes.",
        plan="1. Primary PCI performed with drug-eluting stent to the culprit vessel.\n"
             "2. Dual antiplatelet therapy: Aspirin 75mg daily plus Ticagrelor 90mg BID for 12 months.\n"
             "3. Atorvastatin 80mg nightly, Metoprolol {metop}mg daily, Ramipril 2.5mg daily.\n"
             "4. Continuous cardiac monitoring for 48 hours; cardiac rehabilitation referral.",
        medications=["Aspirin", "Ticagrelor", "Atorvastatin", "Metoprolol", "Ramipril"],
        organism_or_marker="Troponin",
        vitals_profile={"heart_rate": (58, 104), "bp_systolic": (100, 158), "bp_diastolic": (60, 96),
                        "resp_rate": (16, 24), "temp_celsius": (36.2, 37.3),
                        "o2_saturation": (92, 99), "blood_glucose": (110, 220)},
        questions=[
            ("What did the ECG show?", "Objective / Vitals / Labs"),
            ("What was the troponin level?", "Objective / Vitals / Labs"),
            ("Which antiplatelet drugs were prescribed?", "Plan & Orders"),
            ("What was the culprit vessel on angiography?", "Assessment & Diagnosis"),
            ("Describe the chest pain the patient reported.", "Subjective History"),
        ],
    ),
    ConditionTemplate(
        name="Enteric Fever",
        diagnosis="Enteric Fever (Typhoid), blood culture {typh_org}",
        ward="General Medicine",
        complaint="Step-ladder fever, abdominal discomfort and loss of appetite for {d} days.",
        subjective="{age}yo {sex} reports {d} days of gradually rising fever, dull abdominal pain, "
                   "{bowel} and generalised weakness. History of eating street food.",
        objective="Temp {temp}°C, HR {hr} bpm (relative bradycardia), BP {sbp}/{dbp} mmHg. Coated tongue, "
                  "tender hepatosplenomegaly. Blood culture: {typh_org}. Widal TO {widal}. "
                  "WBC {wbc_t} x10^9/L, platelets {plt} x10^9/L, SGPT {sgpt} U/L.",
        assessment="Culture-confirmed enteric fever caused by {typh_org}. No features of intestinal "
                   "perforation or encephalopathy.",
        plan="1. IV Ceftriaxone 2g once daily; switch to oral Azithromycin 500mg daily once afebrile for 48 hours.\n"
             "2. Paracetamol 650mg SOS for fever above 38.5°C.\n"
             "3. Soft, high-calorie diet and oral hydration; monitor for abdominal distension.\n"
             "4. Repeat CBC and LFT after 72 hours; stool culture before discharge.",
        medications=["Ceftriaxone", "Azithromycin", "Paracetamol"],
        organism_or_marker="Salmonella Typhi",
        vitals_profile={"heart_rate": (72, 100), "bp_systolic": (100, 130), "bp_diastolic": (60, 84),
                        "resp_rate": (16, 22), "temp_celsius": (38.0, 39.8),
                        "o2_saturation": (95, 99), "blood_glucose": (84, 130)},
        questions=[
            ("What organism grew in the blood culture?", "Objective / Vitals / Labs"),
            ("Which antibiotic was started for typhoid?", "Plan & Orders"),
            ("What was the Widal titre?", "Objective / Vitals / Labs"),
            ("What symptoms did the patient report?", "Subjective History"),
            ("When should the antibiotic be switched to oral?", "Plan & Orders"),
        ],
    ),
    ConditionTemplate(
        name="Falciparum Malaria",
        diagnosis="Plasmodium falciparum Malaria, {mal_sev}",
        ward="General Medicine",
        complaint="Intermittent fever with chills and rigors, vomiting and headache for {d} days.",
        subjective="{age}yo {sex} returned from {mal_place} two weeks ago and reports {d} days of "
                   "fever with chills and rigors every alternate day, vomiting and severe headache.",
        objective="Temp {temp}°C, HR {hr} bpm, BP {sbp}/{dbp} mmHg. Pallor and mild icterus, "
                  "splenomegaly. Peripheral smear: P. falciparum ring forms, parasitaemia {para}%. "
                  "RDT positive for Pf HRP-2. Hb {hb} g/dL, platelets {plt} x10^9/L, bilirubin {bili} mg/dL.",
        assessment="Plasmodium falciparum malaria with {para}% parasitaemia, {mal_sev}. "
                   "{mal_comp}.",
        plan="1. IV Artesunate 2.4mg/kg at 0, 12 and 24 hours, then once daily until oral intake possible.\n"
             "2. Complete course with oral Artemether-Lumefantrine for 3 days.\n"
             "3. Single low dose Primaquine 0.25mg/kg as gametocytocide after G6PD screening.\n"
             "4. Capillary glucose 4-hourly; repeat smear at 48 hours to confirm parasite clearance.",
        medications=["Artesunate", "Artemether-Lumefantrine", "Primaquine", "Paracetamol"],
        organism_or_marker="Plasmodium falciparum",
        vitals_profile={"heart_rate": (90, 124), "bp_systolic": (94, 126), "bp_diastolic": (56, 80),
                        "resp_rate": (18, 28), "temp_celsius": (37.8, 40.0),
                        "o2_saturation": (93, 99), "blood_glucose": (68, 130)},
        questions=[
            ("What was the parasite count on the smear?", "Objective / Vitals / Labs"),
            ("Which antimalarial was started?", "Plan & Orders"),
            ("Is this severe malaria?", "Assessment & Diagnosis"),
            ("Where did the patient travel recently?", "Subjective History"),
            ("What was the haemoglobin and platelet count?", "Objective / Vitals / Labs"),
        ],
    ),
]

MALE_FIRST_NAMES = [
    "Aarav", "Arjun", "Rohan", "Karthik", "Siddharth", "Rahul", "Vikram", "Aditya", "Pranav",
    "Harish", "Suresh", "Ramesh", "Mahesh", "Ganesh", "Venkatesh", "Manoj", "Anil", "Sanjay",
    "Rajiv", "Nikhil", "Varun", "Abhishek", "Deepak", "Prakash", "Srinivas", "Imran", "Farhan",
    "Gurpreet", "Naveen", "Kiran", "Lokesh", "Tejas", "Yash", "Joseph", "Sameer", "Vinod",
    "Ravi", "Ashok", "Gopal", "Mukesh",
]
FEMALE_FIRST_NAMES = [
    "Ananya", "Priya", "Kavya", "Meera", "Lakshmi", "Sneha", "Pooja", "Divya", "Aishwarya",
    "Nandini", "Shreya", "Radha", "Sunita", "Geeta", "Anjali", "Deepika", "Pallavi", "Revathi",
    "Shalini", "Bhavana", "Sowmya", "Fatima", "Ayesha", "Simran", "Asha", "Vidya", "Rekha",
    "Usha", "Kamala", "Harini", "Madhuri", "Swati", "Neha", "Parvathi", "Zoya", "Jyothi",
]
LAST_NAMES = [
    "Sharma", "Verma", "Iyer", "Iyengar", "Reddy", "Rao", "Nair", "Menon", "Pillai", "Patel",
    "Shah", "Desai", "Joshi", "Kulkarni", "Deshpande", "Gowda", "Hegde", "Shetty", "Kamath",
    "Bhat", "Mukherjee", "Banerjee", "Chatterjee", "Das", "Ghosh", "Singh", "Gupta", "Agarwal",
    "Mishra", "Pandey", "Tiwari", "Yadav", "Naidu", "Chowdhury", "Khan", "Siddiqui", "Qureshi",
    "Fernandes", "Dsouza", "Krishnan", "Subramanian", "Venkataraman", "Sinha", "Saxena", "Bose",
]
# Kept for any external import that still expects a single list.
FIRST_NAMES = MALE_FIRST_NAMES + FEMALE_FIRST_NAMES


def indian_phone(rng) -> str:
    return f"+91 {rng.choice([98, 99, 97, 94, 90, 88, 70])}{rng.randint(100, 999)} {rng.randint(10000, 99999)}"


STABLE_CONTEXT_KEYS = {"age", "sex", "d", "ef", "stage", "gold", "py", "curb",
                       "weeks", "wt_loss", "hrs_pain", "lvef", "dtb", "bmi"}


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
        # dengue
        "dengue_sx": _pick(rng, ["persistent vomiting", "abdominal pain", "gum bleeding",
                                 "extreme lethargy", "decreased oral intake"]),
        "plt_d": rng.randint(18, 92), "hct": rng.randint(41, 52),
        "wbc_d": round(rng.uniform(2.1, 4.2), 1),
        "ns1": _pick(rng, ["positive", "positive", "negative (day 6, IgM-driven diagnosis)"]),
        "igm": _pick(rng, ["positive", "equivocal", "negative"]),
        "sgot": rng.randint(68, 340), "fluid_d": _pick(rng, [3, 5, 7]),
        "warning": _pick(rng, ["persistent vomiting and abdominal pain",
                               "mucosal bleeding from gums",
                               "rising haematocrit with falling platelets",
                               "lethargy and restlessness"]),
        # tuberculosis
        "weeks": rng.randint(3, 10), "wt_loss": rng.randint(3, 11),
        "tb_contact": _pick(rng, ["Father was treated for TB two years ago",
                                  "No known TB contact", "Works in a crowded textile unit",
                                  "Neighbour currently on anti-TB treatment"]),
        "bmi": round(rng.uniform(15.2, 20.8), 1),
        "tb_zone": _pick(rng, ["right upper zone", "left upper zone", "bilateral upper zones"]),
        "cxr_tb": _pick(rng, ["right upper lobe cavitation with fibro-nodular infiltrates",
                              "bilateral upper zone infiltrates with a 3cm cavity",
                              "left upper lobe consolidation with hilar lymphadenopathy"]),
        "afb": _pick(rng, ["positive (2+)", "positive (1+)", "positive (scanty)"]),
        "rif": _pick(rng, ["sensitive", "sensitive", "sensitive", "resistance not detected"]),
        "esr": rng.randint(42, 110), "wband": _pick(rng, ["30-39", "40-54", "55-69"]),
        "fdc": _pick(rng, [2, 3, 4]),
        # STEMI
        "stemi_wall": _pick(rng, ["Anterior", "Inferior", "Lateral", "Anterolateral"]),
        "hrs_pain": rng.randint(1, 8),
        "risk": _pick(rng, ["type 2 diabetes and smoking", "hypertension and dyslipidaemia",
                            "a strong family history of coronary disease", "no prior cardiac history"]),
        "leads": _pick(rng, ["V1-V4", "II, III and aVF", "I, aVL, V5-V6", "V1-V6 and aVL"]),
        "trop": rng.randint(1800, 48000), "lvef": rng.randint(30, 52),
        "culprit": _pick(rng, ["99% proximal LAD occlusion", "total occlusion of the mid RCA",
                               "90% stenosis of the proximal LCx", "thrombotic occlusion of the mid LAD"]),
        "killip": _pick(rng, ["I", "I", "II", "III"]), "dtb": rng.randint(48, 110),
        # typhoid
        "bowel": _pick(rng, ["constipation", "loose stools", "alternating constipation and diarrhoea"]),
        "typh_org": _pick(rng, ["Salmonella Typhi", "Salmonella Typhi", "Salmonella Paratyphi A"]),
        "widal": _pick(rng, ["1:160", "1:320", "1:80"]), "wbc_t": round(rng.uniform(3.2, 6.0), 1),
        "sgpt": rng.randint(54, 180),
        # malaria
        "mal_place": _pick(rng, ["Odisha", "Jharkhand", "Chhattisgarh", "north-east India",
                                 "a construction site in Mangaluru"]),
        "para": round(rng.uniform(0.8, 6.5), 1), "hb": round(rng.uniform(7.2, 11.8), 1),
        "bili": round(rng.uniform(1.2, 4.6), 1),
        "mal_sev": _pick(rng, ["uncomplicated", "severe", "severe"]),
        "mal_comp": _pick(rng, ["No cerebral involvement or renal failure",
                                "Jaundice and thrombocytopenia present",
                                "Hypoglycaemia on admission, corrected with dextrose"]),
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
    a higher-priority one. The GA never sees this function, it only sees the
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
        desc = "Diastolic pressure exceeds systolic, physiologically impossible combination."

    else:  # copy_forward, or a fallback when the chosen field was absent
        ctype = "copy_forward"
        v["blood_glucose"] = 512.0
        v["heart_rate"] = 61.0
        desc = "Glucose value appears carried forward from an unrelated diabetic record."

    return v, ctype, desc
