from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.rbac import require_any_authenticated, require_clinical_staff
from app.db.session import get_db
from app.models.patient import Patient
from app.models.vital import VitalSign
from app.models.user import User
from app.schemas.vital import VitalCreate, VitalOut

router = APIRouter(prefix="/vitals", tags=["Vitals"])

@router.post("", response_model=VitalOut, status_code=status.HTTP_201_CREATED)
def record_vital_signs(
    vital_in: VitalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_clinical_staff)
):
    """
    Log a set of vital signs for a patient.
    Available to: Nurse, Doctor.
    """
    patient = db.query(Patient).filter(Patient.id == vital_in.patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {vital_in.patient_id} not found."
        )

    vital = VitalSign(
        **vital_in.model_dump(),
        recorded_by_id=current_user.id
    )
    db.add(vital)
    db.commit()
    db.refresh(vital)

    return VitalOut(
        id=vital.id,
        patient_id=vital.patient_id,
        heart_rate=vital.heart_rate,
        bp_systolic=vital.bp_systolic,
        bp_diastolic=vital.bp_diastolic,
        resp_rate=vital.resp_rate,
        temp_celsius=vital.temp_celsius,
        o2_saturation=vital.o2_saturation,
        blood_glucose=vital.blood_glucose,
        notes=vital.notes,
        recorded_by_id=vital.recorded_by_id,
        recorded_by_name=current_user.full_name,
        recorded_at=vital.recorded_at
    )

@router.get("/patient/{patient_id}", response_model=List[VitalOut])
def get_patient_vitals_history(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_authenticated)
):
    """
    Get chronological vital signs history for charts and trend visualizers.
    Available to: Admin, Doctor, Nurse.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found."
        )

    vitals = db.query(VitalSign).filter(VitalSign.patient_id == patient_id).order_by(VitalSign.recorded_at.desc()).all()
    
    return [
        VitalOut(
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
        )
        for v in vitals
    ]
