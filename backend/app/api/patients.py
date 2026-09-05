from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.rbac import (
    require_any_authenticated,
    require_doctor_or_admin,
    require_admin,
    get_current_user
)
from app.db.session import get_db
from app.models.patient import Patient, PatientStatus
from app.models.user import User, UserRole
from app.models.task import CareTask, TaskStatus
from app.models.vital import VitalSign
from app.schemas.patient import PatientCreate, PatientUpdate, PatientListOut, PatientDetailOut
from app.schemas.vital import VitalOut
from app.schemas.note import NoteOut
from app.schemas.task import TaskOut

router = APIRouter(prefix="/patients", tags=["Patients"])

@router.get("", response_model=List[PatientListOut])
def list_patients(
    search: Optional[str] = Query(None, description="Search by name, MRN, or diagnosis"),
    ward: Optional[str] = Query(None, description="Filter by ward"),
    status: Optional[PatientStatus] = Query(None, description="Filter by patient status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_authenticated)
):
    """
    List all patients with optional search and filtering.
    Available to: Admin, Doctor, Nurse.
    """
    query = db.query(Patient)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Patient.first_name.ilike(search_pattern)) |
            (Patient.last_name.ilike(search_pattern)) |
            (Patient.mrn.ilike(search_pattern)) |
            (Patient.primary_diagnosis.ilike(search_pattern))
        )
    
    if ward:
        query = query.filter(Patient.ward == ward)
        
    if status:
        query = query.filter(Patient.status == status)

    patients = query.order_by(Patient.last_name.asc()).all()
    
    results = []
    for p in patients:
        latest_vital = db.query(VitalSign).filter(VitalSign.patient_id == p.id).order_by(VitalSign.recorded_at.desc()).first()
        pending_tasks = db.query(CareTask).filter(
            CareTask.patient_id == p.id,
            CareTask.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS])
        ).count()
        
        latest_vital_out = None
        if latest_vital:
            latest_vital_out = VitalOut(
                id=latest_vital.id,
                patient_id=latest_vital.patient_id,
                heart_rate=latest_vital.heart_rate,
                bp_systolic=latest_vital.bp_systolic,
                bp_diastolic=latest_vital.bp_diastolic,
                resp_rate=latest_vital.resp_rate,
                temp_celsius=latest_vital.temp_celsius,
                o2_saturation=latest_vital.o2_saturation,
                blood_glucose=latest_vital.blood_glucose,
                notes=latest_vital.notes,
                recorded_by_id=latest_vital.recorded_by_id,
                recorded_by_name=latest_vital.recorder.full_name if latest_vital.recorder else None,
                recorded_at=latest_vital.recorded_at
            )
            
        p_dict = {
            "id": p.id,
            "mrn": p.mrn,
            "first_name": p.first_name,
            "last_name": p.last_name,
            "date_of_birth": p.date_of_birth,
            "gender": p.gender,
            "blood_group": p.blood_group,
            "ward": p.ward,
            "room_number": p.room_number,
            "status": p.status,
            "primary_diagnosis": p.primary_diagnosis,
            "allergies": p.allergies,
            "medical_history": p.medical_history,
            "emergency_contact": p.emergency_contact,
            "admission_date": p.admission_date,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
            "latest_vitals": latest_vital_out,
            "pending_tasks_count": pending_tasks
        }
        results.append(PatientListOut(**p_dict))
        
    return results

@router.get("/{patient_id}", response_model=PatientDetailOut)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_authenticated)
):
    """
    Get full patient record with chronological vitals, clinical notes, and active care tasks.
    Available to: Admin, Doctor, Nurse.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found."
        )

    # Convert notes to schema with author details
    notes_out = []
    for n in patient.clinical_notes:
        notes_out.append(NoteOut(
            id=n.id,
            patient_id=n.patient_id,
            title=n.title,
            note_type=n.note_type,
            chief_complaint=n.chief_complaint,
            subjective=n.subjective,
            objective=n.objective,
            assessment=n.assessment,
            plan=n.plan,
            content=n.content,
            author_id=n.author_id,
            author_name=n.author.full_name if n.author else "Medical Staff",
            author_role=n.author.role.value if n.author else "UNKNOWN",
            created_at=n.created_at,
            updated_at=n.updated_at
        ))

    vitals_out = []
    for v in patient.vital_signs:
        vitals_out.append(VitalOut(
            id=v.id,
            patient_id=v.patient_id,
            heart_rate=v.heart_rate,
            bp_systolic=v.bp_systolic,
            bp_diastolic=v.bp_diastolic,
            resp_rate=v.resp_rate,
            temp_celsius=v.temp_celsius,
            o2_saturation=v.o2_saturation,
            blood_glucose=v.blood_glucose,
            notes=v.notes,
            recorded_by_id=v.recorded_by_id,
            recorded_by_name=v.recorder.full_name if v.recorder else None,
            recorded_at=v.recorded_at
        ))

    tasks_out = []
    for t in patient.care_tasks:
        tasks_out.append(TaskOut(
            id=t.id,
            patient_id=t.patient_id,
            patient_name=patient.full_name,
            patient_room=patient.room_number,
            title=t.title,
            description=t.description,
            priority=t.priority,
            status=t.status,
            assigned_nurse_id=t.assigned_nurse_id,
            assigned_nurse_name=t.assigned_nurse.full_name if t.assigned_nurse else None,
            created_by_id=t.created_by_id,
            created_by_name=t.created_by.full_name if t.created_by else None,
            due_time=t.due_time,
            completed_at=t.completed_at,
            completion_notes=t.completion_notes,
            created_at=t.created_at,
            updated_at=t.updated_at
        ))

    return PatientDetailOut(
        id=patient.id,
        mrn=patient.mrn,
        first_name=patient.first_name,
        last_name=patient.last_name,
        date_of_birth=patient.date_of_birth,
        gender=patient.gender,
        blood_group=patient.blood_group,
        ward=patient.ward,
        room_number=patient.room_number,
        status=patient.status,
        primary_diagnosis=patient.primary_diagnosis,
        allergies=patient.allergies,
        medical_history=patient.medical_history,
        emergency_contact=patient.emergency_contact,
        admission_date=patient.admission_date,
        created_at=patient.created_at,
        updated_at=patient.updated_at,
        vital_signs=vitals_out,
        clinical_notes=notes_out,
        care_tasks=tasks_out
    )

@router.post("", response_model=PatientDetailOut, status_code=status.HTTP_201_CREATED)
def create_patient(
    patient_in: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor_or_admin)
):
    """
    Create a new patient record.
    Available to: Doctor, Admin.
    """
    existing = db.query(Patient).filter(Patient.mrn == patient_in.mrn).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Patient with MRN '{patient_in.mrn}' already exists."
        )

    patient = Patient(**patient_in.model_dump())
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient

@router.put("/{patient_id}", response_model=PatientDetailOut)
def update_patient(
    patient_id: int,
    patient_in: PatientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor_or_admin)
):
    """
    Update patient demographics, ward, diagnosis, or status.
    Available to: Doctor, Admin.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found."
        )

    update_data = patient_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(patient, field, val)

    db.commit()
    db.refresh(patient)
    return patient

@router.delete("/{patient_id}", status_code=status.HTTP_200_OK)
def delete_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Delete patient record and associated data.
    Available to: Admin only.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found."
        )
    
    db.delete(patient)
    db.commit()
    return {"message": f"Patient '{patient.full_name}' (MRN: {patient.mrn}) successfully deleted."}
