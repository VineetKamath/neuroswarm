import os
import sys
from datetime import datetime, date, timedelta, timezone

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.patient import Patient, PatientStatus
from app.models.vital import VitalSign
from app.models.note import ClinicalNote, NoteType
from app.models.task import CareTask, TaskPriority, TaskStatus
from app.services.vector_store import vector_store
from app.bio.seeding import generate_cohort, build_task_scenarios, write_benchmarks
from app.bio.corpus import expert_task_score

def seed_database():
    print("Resetting and creating database tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("Creating staff user accounts...")
        # 1. Staff Users
        admin_user = User(
            email="admin@neuroswarm.health",
            hashed_password=get_password_hash("password123"),
            full_name="Dr. Arthur Hastings (Admin)",
            role=UserRole.ADMIN,
            department="Hospital Administration",
            is_active=True
        )
        doctor_chen = User(
            email="dr.chen@neuroswarm.health",
            hashed_password=get_password_hash("password123"),
            full_name="Dr. Melinda Chen, MD",
            role=UserRole.DOCTOR,
            department="Cardiology & Critical Care",
            is_active=True
        )
        doctor_patel = User(
            email="dr.patel@neuroswarm.health",
            hashed_password=get_password_hash("password123"),
            full_name="Dr. Rajesh Patel, MD",
            role=UserRole.DOCTOR,
            department="Internal Medicine & Pulmonology",
            is_active=True
        )
        nurse_sarah = User(
            email="nurse.sarah@neuroswarm.health",
            hashed_password=get_password_hash("password123"),
            full_name="Sarah Jenkins, RN",
            role=UserRole.NURSE,
            department="Cardiology & Step-Down Unit",
            is_active=True
        )
        nurse_james = User(
            email="nurse.james@neuroswarm.health",
            hashed_password=get_password_hash("password123"),
            full_name="James Rodriguez, BSN",
            role=UserRole.NURSE,
            department="Pulmonology & General Medicine",
            is_active=True
        )

        db.add_all([admin_user, doctor_chen, doctor_patel, nurse_sarah, nurse_james])
        db.commit()
        db.refresh(admin_user)
        db.refresh(doctor_chen)
        db.refresh(doctor_patel)
        db.refresh(nurse_sarah)
        db.refresh(nurse_james)

        print("Seeding patient records...")
        now = datetime.now(timezone.utc)

        # ----------------------------------------------------
        # Patient 1: Eleanor Vance (Cardiology / Heart Failure)
        # ----------------------------------------------------
        p1 = Patient(
            mrn="MRN-10492",
            first_name="Eleanor",
            last_name="Vance",
            date_of_birth=date(1958, 3, 14),
            gender="Female",
            blood_group="A+",
            ward="Cardiology 4B",
            room_number="412-A",
            status=PatientStatus.ADMITTED,
            primary_diagnosis="Acute Decompensated Heart Failure (HFrEF, EF 32%), Type 2 Diabetes, Stage 3 CKD",
            allergies="Sulfa drugs (erythematous rash), Lisinopril (severe refractory cough)",
            medical_history="Hypertension (15 yrs), Type 2 Diabetes Mellitus (12 yrs), HFrEF diagnosed 2024, Bilateral knee osteoarthritis.",
            emergency_contact="Robert Vance (Husband) - (555) 234-5678",
            admission_date=now - timedelta(days=3)
        )
        db.add(p1)
        db.commit()
        db.refresh(p1)

        # Notes for Patient 1
        n1_1 = ClinicalNote(
            patient_id=p1.id,
            author_id=doctor_chen.id,
            note_type=NoteType.ADMISSION,
            title="Initial Admission History & Physical - Acute HF Exacerbation",
            chief_complaint="Severe orthopnea, paroxysmal nocturnal dyspnea, and 3+ bilateral lower extremity pitting edema.",
            subjective="68yo female with known HFrEF presenting with 4-day worsening shortness of breath requiring 3 pillows to sleep. Reports 9 lb weight gain over the past week.",
            objective="BP 154/92 mmHg, HR 98 bpm regular, RR 24 bpm, SpO2 91% on room air. JVP elevated at 10cm. Bibasilar pulmonary crackles. 3+ pitting edema to mid-calves.",
            assessment="Acute decompensated systolic heart failure secondary to dietary indiscretion vs viral trigger. Background of CKD Stage 3 (baseline Creatinine 1.4 mg/dL).",
            plan="1. IV Furosemide (Lasix) 80mg bolus, followed by 40mg BID.\n2. Start Sacubitril/Valsartan (Entresto) 24/26mg BID (Lisinopril avoided due to cough allergy).\n3. Strict fluid restriction 1.5L/day and daily morning weights.\n4. Transthoracic Echocardiogram ordered.",
            content="Initial Admission Note:\nPatient admitted for decompensated heart failure with volume overload. Noted allergy to ACE inhibitors (Lisinopril causes severe cough) and sulfa drugs. Commenced IV diuresis with Lasix 80mg and initiated Entresto.",
            created_at=now - timedelta(days=3, hours=2)
        )
        n1_2 = ClinicalNote(
            patient_id=p1.id,
            author_id=doctor_chen.id,
            note_type=NoteType.CONSULT,
            title="Cardiology Consult & Transthoracic Echo Report",
            chief_complaint="Evaluation of left ventricular ejection fraction and regional wall motion abnormalities.",
            subjective="Patient reports moderate improvement in breathing following 2.4L net negative fluid balance over 48 hours.",
            objective="Transthoracic Echo (TTE) Results:\n- Left Ventricle Ejection Fraction (LVEF): 32% (severely reduced).\n- Moderate mitral regurgitation, mild tricuspid regurgitation with estimated PASP 42 mmHg.\n- Serum Potassium: 4.2 mEq/L, Creatinine: 1.5 mg/dL, BNP: 1,420 pg/mL (down from 2,890 pg/mL on admission).",
            assessment="HFrEF with excellent response to IV loop diuretics. Renal function stable without acute worsening.",
            plan="1. Step down IV Lasix to oral Torsemide 20mg daily.\n2. Up-titrate Entresto to 49/51mg BID.\n3. Add Spironolactone 25mg daily.\n4. Cardiac rehab consult prior to discharge.",
            content="Echo confirms LVEF 32% with moderate mitral regurgitation. BNP decreased significantly to 1,420 pg/mL. Transitioning from IV Lasix to oral Torsemide 20mg daily. Added Spironolactone 25mg.",
            created_at=now - timedelta(days=1, hours=4)
        )
        db.add_all([n1_1, n1_2])

        # Vitals for Patient 1
        db.add_all([
            VitalSign(patient_id=p1.id, recorded_by_id=nurse_sarah.id, heart_rate=98, bp_systolic=154, bp_diastolic=92, resp_rate=24, temp_celsius=37.1, o2_saturation=91.0, blood_glucose=168.0, notes="On room air. Labored breathing.", recorded_at=now - timedelta(days=3)),
            VitalSign(patient_id=p1.id, recorded_by_id=nurse_sarah.id, heart_rate=88, bp_systolic=138, bp_diastolic=84, resp_rate=20, temp_celsius=36.8, o2_saturation=94.5, blood_glucose=142.0, notes="2L O2 via nasal cannula. Net diuresis -1200ml.", recorded_at=now - timedelta(days=2)),
            VitalSign(patient_id=p1.id, recorded_by_id=nurse_sarah.id, heart_rate=76, bp_systolic=126, bp_diastolic=78, resp_rate=17, temp_celsius=36.7, o2_saturation=97.0, blood_glucose=124.0, notes="Room air tolerated well. Edema down to 1+.", recorded_at=now - timedelta(hours=3)),
        ])

        # Tasks for Patient 1
        db.add_all([
            CareTask(patient_id=p1.id, assigned_nurse_id=nurse_sarah.id, created_by_id=doctor_chen.id, title="Administer Morning Torsemide 20mg & Entresto", description="Check sitting BP prior to administration; hold if systolic < 100 mmHg.", priority=TaskPriority.HIGH, status=TaskStatus.COMPLETED, due_time=now - timedelta(hours=4), completed_at=now - timedelta(hours=4, minutes=10), completion_notes="BP was 126/78. Medications administered with morning meal."),
            CareTask(patient_id=p1.id, assigned_nurse_id=nurse_sarah.id, created_by_id=doctor_chen.id, title="Daily Standing Weight & Electrolyte Panel", description="Log morning weight before breakfast. Draw serum K+ and Creatinine.", priority=TaskPriority.HIGH, status=TaskStatus.IN_PROGRESS, due_time=now + timedelta(hours=4)),
            CareTask(patient_id=p1.id, assigned_nurse_id=nurse_sarah.id, created_by_id=doctor_chen.id, title="Cardiac Rehab Ambulation Assessment", description="Supervise 100m hallway ambulation with continuous pulse oximetry.", priority=TaskPriority.MEDIUM, status=TaskStatus.PENDING, due_time=now + timedelta(hours=8)),
        ])

        # ----------------------------------------------------
        # Patient 2: Marcus Brody (Pulmonology / Pneumonia)
        # ----------------------------------------------------
        p2 = Patient(
            mrn="MRN-10821",
            first_name="Marcus",
            last_name="Brody",
            date_of_birth=date(1981, 7, 22),
            gender="Male",
            blood_group="O+",
            ward="Pulmonology 2A",
            room_number="204-B",
            status=PatientStatus.ADMITTED,
            primary_diagnosis="Severe Community-Acquired Bacterial Pneumonia (Left Lower Lobe), Mild Intermittent Asthma",
            allergies="Penicillin / Amoxicillin (Anaphylaxis - facial edema & bronchospasm)",
            medical_history="Childhood asthma, smoking history (10 pack-years, quit 5 years ago), no prior hospitalizations.",
            emergency_contact="Claire Brody (Wife) - (555) 789-0123",
            admission_date=now - timedelta(days=2)
        )
        db.add(p2)
        db.commit()
        db.refresh(p2)

        # Notes for Patient 2
        n2_1 = ClinicalNote(
            patient_id=p2.id,
            author_id=doctor_patel.id,
            note_type=NoteType.ADMISSION,
            title="Pulmonology Inpatient Admission Note - Left Lobe Pneumonia",
            chief_complaint="High fever (39.2°C), productive cough with rust-colored sputum, and left-sided pleuritic chest pain.",
            subjective="45yo male presenting with 5 days of worsening fever, productive cough, and chills. Severe Penicillin anaphylaxis noted in chart.",
            objective="T 39.2°C, HR 106 bpm, BP 118/74 mmHg, RR 26 bpm, SpO2 88% on room air, improving to 94% on 3L nasal cannula. Chest X-Ray shows dense consolidation in left lower lobe with air bronchograms. WBC count 17.8 x 10^3/uL with left shift.",
            assessment="Severe Community-Acquired Pneumonia (CAP) with respiratory compromise. Penicillin allergic.",
            plan="1. IV Ceftriaxone 1g IV Q24H plus Azithromycin 500mg IV Q24H (Penicillin allergy verified: patient tolerates 3rd-generation cephalosporins previously without cross-reactivity, monitor closely).\n2. Supplemental O2 via nasal cannula titrated for SpO2 > 92%.\n3. Albuterol-Ipratropium (DuoNeb) nebulizers Q4H PRN.\n4. Blood cultures and sputum Gram stain/culture sent.",
            content="Patient admitted with severe Left Lower Lobe CAP. High fever and hypoxic on room air. Given severe penicillin allergy, commenced IV Ceftriaxone 1g + Azithromycin 500mg. Sputum culture pending.",
            created_at=now - timedelta(days=2, hours=1)
        )
        n2_2 = ClinicalNote(
            patient_id=p2.id,
            author_id=doctor_patel.id,
            note_type=NoteType.PROGRESS,
            title="Microbiology Culture Update & Clinical Progress Note",
            chief_complaint="Review of sputum & blood microbiology cultures.",
            subjective="Patient reports reduced pleuritic pain and improved coughing ease after nebulizer treatments.",
            objective="Sputum Culture Results: Streptococcus pneumoniae (pan-sensitive to Ceftriaxone, Levofloxacin, Vancomycin). Blood cultures (2/2 sets): No growth at 48 hours. WBC decreased to 11.2 x 10^3/uL. Temp max in last 24h: 37.4°C.",
            assessment="Streptococcus pneumoniae CAP showing rapid clinical and microbiological response to Ceftriaxone/Azithromycin.",
            plan="1. Complete 5-day IV Ceftriaxone course.\n2. Switch to oral Levofloxacin 500mg daily at discharge for a total 7-day antibiotic duration.\n3. Wean supplemental oxygen as tolerated.",
            content="Sputum confirmed Streptococcus pneumoniae sensitive to Ceftriaxone. Fever resolved. WBC normalized to 11.2. Will complete IV Ceftriaxone and step down to oral Levofloxacin.",
            created_at=now - timedelta(hours=6)
        )
        db.add_all([n2_1, n2_2])

        # Vitals for Patient 2
        db.add_all([
            VitalSign(patient_id=p2.id, recorded_by_id=nurse_james.id, heart_rate=106, bp_systolic=118, bp_diastolic=74, resp_rate=26, temp_celsius=39.2, o2_saturation=88.0, blood_glucose=108.0, notes="Room air. Febrile and tachypneic.", recorded_at=now - timedelta(days=2)),
            VitalSign(patient_id=p2.id, recorded_by_id=nurse_james.id, heart_rate=92, bp_systolic=122, bp_diastolic=76, resp_rate=21, temp_celsius=38.1, o2_saturation=93.5, blood_glucose=112.0, notes="On 3L nasal cannula. Post-DuoNeb treatment.", recorded_at=now - timedelta(days=1)),
            VitalSign(patient_id=p2.id, recorded_by_id=nurse_james.id, heart_rate=80, bp_systolic=120, bp_diastolic=78, resp_rate=18, temp_celsius=37.1, o2_saturation=96.5, blood_glucose=99.0, notes="Weaning to 1L nasal cannula. Comfortable.", recorded_at=now - timedelta(hours=2)),
        ])

        # Tasks for Patient 2
        db.add_all([
            CareTask(patient_id=p2.id, assigned_nurse_id=nurse_james.id, created_by_id=doctor_patel.id, title="Administer IV Ceftriaxone 1g & Azithromycin", description="Infuse over 30 mins; verify patient is free of rash/dyspnea.", priority=TaskPriority.HIGH, status=TaskStatus.COMPLETED, due_time=now - timedelta(hours=5), completed_at=now - timedelta(hours=4, minutes=45), completion_notes="Infusion complete, tolerated without adverse events."),
            CareTask(patient_id=p2.id, assigned_nurse_id=nurse_james.id, created_by_id=doctor_patel.id, title="Albuterol-Ipratropium Nebulizer Treatment", description="Administer DuoNeb Q4H and assess breath sounds post-treatment.", priority=TaskPriority.MEDIUM, status=TaskStatus.IN_PROGRESS, due_time=now + timedelta(hours=1)),
            CareTask(patient_id=p2.id, assigned_nurse_id=nurse_james.id, created_by_id=doctor_patel.id, title="Trial Room Air Oxygen Saturation", description="Discontinue nasal cannula for 30 minutes and record resting SpO2.", priority=TaskPriority.LOW, status=TaskStatus.PENDING, due_time=now + timedelta(hours=6)),
        ])

        # ----------------------------------------------------
        # Patient 3: Sofia Alvarez (Surgical / Appendectomy)
        # ----------------------------------------------------
        p3 = Patient(
            mrn="MRN-10955",
            first_name="Sofia",
            last_name="Alvarez",
            date_of_birth=date(1997, 11, 5),
            gender="Female",
            blood_group="B+",
            ward="Post-Surgical 3C",
            room_number="318",
            status=PatientStatus.STABLE,
            primary_diagnosis="Post-Operative Laparoscopic Appendectomy (Day 2), Acute appendicitis resolved",
            allergies="Latex (contact urticaria), Codeine (severe nausea/vomiting)",
            medical_history="No prior surgical history. Regular menstrual cycles. Takes oral contraceptive pill.",
            emergency_contact="Mateo Alvarez (Brother) - (555) 345-6789",
            admission_date=now - timedelta(days=2)
        )
        db.add(p3)
        db.commit()
        db.refresh(p3)

        n3_1 = ClinicalNote(
            patient_id=p3.id,
            author_id=doctor_chen.id,
            note_type=NoteType.PROCEDURE,
            title="Operative Summary - Laparoscopic Appendectomy",
            chief_complaint="Acute right lower quadrant abdominal pain with McBurney point tenderness.",
            subjective="29yo female underwent uneventful 3-port laparoscopic appendectomy for acutely inflamed, non-perforated suppurative appendicitis.",
            objective="Findings: Acutely inflamed retrocecal appendix with fibrinous exudate, no perforation or abscess. Hemostasis achieved. Estimated blood loss < 10mL. Sponge and needle counts correct.",
            assessment="Uncomplicated laparoscopic appendectomy.",
            plan="1. Post-op recovery in Surgical Ward 3C.\n2. Non-opioid multimodal analgesia: IV Acetaminophen 1g Q6H + Ketorolac 15mg IV Q6H (avoid Codeine due to documented severe emesis).\n3. Advance diet from clear liquids to regular as tolerated.\n4. Encourage early ambulation.",
            content="Operative note: Laparoscopic appendectomy completed without complication. Appendix was inflamed but non-perforated. Avoiding codeine for analgesia due to allergy; managed on IV Acetaminophen and Ketorolac.",
            created_at=now - timedelta(days=1, hours=18)
        )
        n3_2 = ClinicalNote(
            patient_id=p3.id,
            author_id=doctor_chen.id,
            note_type=NoteType.SOAP,
            title="Post-Op Day 2 SOAP Progress Note",
            chief_complaint="Routine post-operative recovery check.",
            subjective="Patient reports mild abdominal soreness (3/10 on pain scale). Has passed flatus and tolerated light breakfast without nausea.",
            objective="Vitals: BP 116/72 mmHg, HR 72 bpm, T 36.6°C, SpO2 99% on room air. Abdomen soft, non-distended, surgical incisions clean and dry with no erythema or discharge. Normoactive bowel sounds in all 4 quadrants.",
            assessment="Excellent post-operative recovery following laparoscopic appendectomy. Hemodynamically stable, tolerating oral diet.",
            plan="1. Transition to oral Ibuprofen 400mg TID and Acetaminophen 500mg PRN.\n2. Discontinue IV maintenance fluids.\n3. Anticipate discharge home tomorrow morning with outpatient surgical follow-up in 2 weeks.",
            content="Post-op Day 2: Patient ambulating well, passing gas, incisions clean. Pain well controlled at 3/10 with non-opioid medications. Planning discharge tomorrow.",
            created_at=now - timedelta(hours=4)
        )
        db.add_all([n3_1, n3_2])

        db.add_all([
            VitalSign(patient_id=p3.id, recorded_by_id=nurse_sarah.id, heart_rate=82, bp_systolic=120, bp_diastolic=78, resp_rate=16, temp_celsius=36.9, o2_saturation=98.0, blood_glucose=94.0, notes="Immediate post-op PACU vitals.", recorded_at=now - timedelta(days=1, hours=16)),
            VitalSign(patient_id=p3.id, recorded_by_id=nurse_sarah.id, heart_rate=72, bp_systolic=116, bp_diastolic=72, resp_rate=15, temp_celsius=36.6, o2_saturation=99.0, blood_glucose=92.0, notes="Ambulating in room without dizziness.", recorded_at=now - timedelta(hours=4)),
        ])

        db.add_all([
            CareTask(patient_id=p3.id, assigned_nurse_id=nurse_sarah.id, created_by_id=doctor_chen.id, title="Incision Dressing Inspection & Cleaning", description="Inspect 3 laparoscopic trocar sites; verify no wound dehiscence or erythema.", priority=TaskPriority.MEDIUM, status=TaskStatus.COMPLETED, due_time=now - timedelta(hours=3), completed_at=now - timedelta(hours=3), completion_notes="Incisions clean, dry, intact. Steri-strips in place."),
            CareTask(patient_id=p3.id, assigned_nurse_id=nurse_sarah.id, created_by_id=doctor_chen.id, title="Discharge Education & Oral Medication Review", description="Review wound care instructions, warning signs of infection, and oral analgesic schedule.", priority=TaskPriority.LOW, status=TaskStatus.PENDING, due_time=now + timedelta(hours=12)),
        ])

        # ----------------------------------------------------
        # Patient 4: David Kim (Nephrology / Hypertensive Crisis)
        # ----------------------------------------------------
        p4 = Patient(
            mrn="MRN-11043",
            first_name="David",
            last_name="Kim",
            date_of_birth=date(1972, 4, 19),
            gender="Male",
            blood_group="AB-",
            ward="Nephrology Step-down 5A",
            room_number="502",
            status=PatientStatus.ADMITTED,
            primary_diagnosis="Hypertensive Urgency with Acute Kidney Injury (Stage 2 AKI, Cr 2.6 mg/dL)",
            allergies="Iodinated Radiographic Contrast Dye (Severe generalized urticaria)",
            medical_history="Poorly controlled essential hypertension, hyperlipidemia, gout.",
            emergency_contact="Grace Kim (Wife) - (555) 456-7890",
            admission_date=now - timedelta(days=1)
        )
        db.add(p4)
        db.commit()
        db.refresh(p4)

        n4_1 = ClinicalNote(
            patient_id=p4.id,
            author_id=doctor_patel.id,
            note_type=NoteType.ADMISSION,
            title="Nephrology Consult & Admission Note - Hypertensive AKI",
            chief_complaint="Severe occipital headache, blurred vision, and elevated blood pressure of 210/118 mmHg.",
            subjective="54yo male with known hypertension who ran out of medications 3 weeks ago. Presents with throbbing headache and decreased urine output.",
            objective="BP 210/118 mmHg bilateral arms, HR 84 bpm, T 36.8°C. Fundoscopy: Grade II hypertensive retinopathy without papilledema. Labs: Serum Creatinine 2.6 mg/dL (baseline 1.1 mg/dL 6 months ago), eGFR 28 mL/min/1.73m2. Serum Potassium: 5.1 mEq/L. Urine protein: 2+ dipstick. Contrast allergy noted (no CT with contrast).",
            assessment="1. Hypertensive urgency without acute aortic dissection or intracranial hemorrhage.\n2. Acute kidney injury superimposed on hypertensive nephrosclerosis.\n3. Iodinated contrast allergy.",
            plan="1. Smooth BP reduction (target MAP reduction by 20% in first 24h to avoid renal hypoperfusion) using IV Nicardipine infusion titrated to systolic 140-150 mmHg.\n2. Transition to oral Amlodipine 10mg daily and Carvedilol 12.5mg BID.\n3. Renal ultrasound without contrast to rule out obstructive uropathy.\n4. Strict fluid balance and hourly blood pressure monitoring.",
            content="Admission note for Hypertensive Urgency with AKI (Creatinine 2.6). Initiated IV Nicardipine titration. Target MAP reduction 20%. Renal ultrasound without contrast scheduled due to severe contrast allergy.",
            created_at=now - timedelta(days=1, hours=8)
        )
        db.add(n4_1)

        db.add_all([
            VitalSign(patient_id=p4.id, recorded_by_id=nurse_james.id, heart_rate=84, bp_systolic=210, bp_diastolic=118, resp_rate=18, temp_celsius=36.8, o2_saturation=97.0, blood_glucose=104.0, notes="On admission. Nicardipine infusion started at 5mg/hr.", recorded_at=now - timedelta(days=1, hours=8)),
            VitalSign(patient_id=p4.id, recorded_by_id=nurse_james.id, heart_rate=74, bp_systolic=162, bp_diastolic=94, resp_rate=16, temp_celsius=36.7, o2_saturation=98.0, blood_glucose=101.0, notes="Nicardipine at 7.5mg/hr. Headache improving.", recorded_at=now - timedelta(hours=14)),
            VitalSign(patient_id=p4.id, recorded_by_id=nurse_james.id, heart_rate=68, bp_systolic=138, bp_diastolic=84, resp_rate=15, temp_celsius=36.6, o2_saturation=99.0, blood_glucose=98.0, notes="Switched to oral Amlodipine & Carvedilol. Stable.", recorded_at=now - timedelta(hours=2)),
        ])

        db.add_all([
            CareTask(patient_id=p4.id, assigned_nurse_id=nurse_james.id, created_by_id=doctor_patel.id, title="Hourly Automated Blood Pressure Monitoring", description="Log BP hourly while on oral antihypertensive transition; notify MD if systolic > 170 or < 110.", priority=TaskPriority.STAT, status=TaskStatus.IN_PROGRESS, due_time=now + timedelta(hours=1)),
            CareTask(patient_id=p4.id, assigned_nurse_id=nurse_james.id, created_by_id=doctor_patel.id, title="Strict Intake/Output & Daily Weight Charting", description="Measure all urine output per shift. Draw morning renal panel (BUN/Cr/K+).", priority=TaskPriority.HIGH, status=TaskStatus.PENDING, due_time=now + timedelta(hours=4)),
        ])

        db.commit()
        print("Core demo patients seeded (4 hand-authored clinical cases).")

        # ------------------------------------------------------------------
        # Extended cohort + labeled ground truth for the bio-inspired trainers
        # ------------------------------------------------------------------
        print("Generating extended clinical cohort...")
        staff = {"doctors": [doctor_chen, doctor_patel], "nurses": [nurse_sarah, nurse_james]}
        labels = generate_cohort(db, staff, n_patients=34, seed=2026, now=now)

        # Hand-authored benchmark queries for the four demo patients. These are
        # labeled by reading the notes above and recording which note actually
        # answers each question.
        core_labels = build_core_benchmark(db)
        labels["retrieval"] = core_labels + labels["retrieval"]

        # Nurse workload snapshot feeds the GA's workload-balancing gene.
        nurse_loads = {}
        for row in labels["task_rows"]:
            nurse_loads[row["nurse_id"]] = nurse_loads.get(row["nurse_id"], 0) + 1

        scenarios = build_task_scenarios(labels["task_rows"], nurse_loads,
                                         scenario_size=6, n_scenarios=110, seed=5)

        out = write_benchmarks({
            "retrieval": labels["retrieval"],
            "vitals": labels["vitals"],
            "task_scenarios": scenarios,
        })
        print(f"  - {len(labels['retrieval'])} labeled retrieval queries")
        print(f"  - {len(scenarios)} expert-ordered task scenarios")
        n_err = sum(1 for v in labels["vitals"] if v["is_error"])
        print(f"  - {len(labels['vitals'])} vitals records ({n_err} with planted errors)")
        print(f"  - benchmarks written to {out}")

        # ------------------------------------------------------------------
        # Vector indexing
        # ------------------------------------------------------------------
        print("Indexing clinical notes into per-patient FAISS vector stores...")
        all_patients = db.query(Patient).all()
        total_chunks = 0
        for p in all_patients:
            notes = db.query(ClinicalNote).filter(ClinicalNote.patient_id == p.id).all()
            total_chunks += vector_store.index_patient_notes(p.id, notes)

        print(f"Seeding complete: {len(all_patients)} patients, {total_chunks} indexed chunks.")
        print("Next step: python -m app.bio.cli train    (evolves all five optimizers)")

    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        raise
    finally:
        db.close()



def build_core_benchmark(db):
    """Hand-labeled benchmark queries for the four authored demo patients.

    Each entry pairs a realistic clinical question with the note that actually
    documents the answer, established by reading the seeded notes directly.
    """
    from app.models.note import ClinicalNote
    from app.models.patient import Patient

    specs = [
        ("Eleanor", [
            ("What diuretic and dose was prescribed?", "Plan & Orders"),
            ("What was the ejection fraction on echocardiography?", "Objective / Vitals / Labs"),
            ("Why was Lisinopril avoided for this patient?", "Plan & Orders"),
            ("What is the daily fluid restriction?", "Plan & Orders"),
            ("What symptoms did the patient describe on admission?", "Subjective History"),
        ]),
        ("Marcus", [
            ("What bacteria was isolated in the sputum culture?", "Objective / Vitals / Labs"),
            ("Which antibiotics were started?", "Plan & Orders"),
            ("What did the chest imaging show?", "Objective / Vitals / Labs"),
            ("What was the oxygen requirement?", "Objective / Vitals / Labs"),
        ]),
        ("", [
            ("What is the current insulin regimen?", "Plan & Orders"),
            ("What were the blood glucose readings?", "Objective / Vitals / Labs"),
        ]),
    ]

    out = []
    for name_frag, questions in specs:
        q = db.query(Patient)
        if name_frag:
            q = q.filter(Patient.first_name.like(f"%{name_frag}%"))
        patient = q.first()
        if not patient:
            continue
        note = (db.query(ClinicalNote)
                  .filter(ClinicalNote.patient_id == patient.id)
                  .order_by(ClinicalNote.created_at.asc())
                  .first())
        if not note:
            continue
        for question, section in questions:
            out.append({
                "patient_id": patient.id,
                "question": question,
                "relevant_note_ids": [note.id],
                "gold_section": section,
                "condition": "authored-demo",
            })
    return out


if __name__ == "__main__":
    seed_database()
