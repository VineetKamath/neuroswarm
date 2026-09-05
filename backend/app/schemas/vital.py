from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class VitalBase(BaseModel):
    heart_rate: Optional[int] = None
    bp_systolic: Optional[int] = None
    bp_diastolic: Optional[int] = None
    resp_rate: Optional[int] = None
    temp_celsius: Optional[float] = None
    o2_saturation: Optional[float] = None
    blood_glucose: Optional[float] = None
    notes: Optional[str] = None

class VitalCreate(VitalBase):
    patient_id: int

class VitalOut(VitalBase):
    id: int
    patient_id: int
    recorded_by_id: Optional[int] = None
    recorded_by_name: Optional[str] = None
    recorded_at: datetime

    class Config:
        from_attributes = True
