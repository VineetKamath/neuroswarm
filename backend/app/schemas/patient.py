from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel
from app.models.patient import PatientStatus
from app.schemas.vital import VitalOut
from app.schemas.note import NoteOut
from app.schemas.task import TaskOut

class PatientBase(BaseModel):
    mrn: str
    first_name: str
    last_name: str
    date_of_birth: date
    gender: str
    blood_group: Optional[str] = None
    ward: Optional[str] = None
    room_number: Optional[str] = None
    status: PatientStatus = PatientStatus.ADMITTED
    primary_diagnosis: Optional[str] = None
    allergies: Optional[str] = None
    medical_history: Optional[str] = None
    emergency_contact: Optional[str] = None

class PatientCreate(PatientBase):
    pass

class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    ward: Optional[str] = None
    room_number: Optional[str] = None
    status: Optional[PatientStatus] = None
    primary_diagnosis: Optional[str] = None
    allergies: Optional[str] = None
    medical_history: Optional[str] = None
    emergency_contact: Optional[str] = None

class PatientListOut(PatientBase):
    id: int
    admission_date: datetime
    created_at: datetime
    updated_at: datetime
    latest_vitals: Optional[VitalOut] = None
    pending_tasks_count: Optional[int] = 0

    class Config:
        from_attributes = True

class PatientDetailOut(PatientBase):
    id: int
    admission_date: datetime
    created_at: datetime
    updated_at: datetime
    vital_signs: List[VitalOut] = []
    clinical_notes: List[NoteOut] = []
    care_tasks: List[TaskOut] = []

    class Config:
        from_attributes = True
