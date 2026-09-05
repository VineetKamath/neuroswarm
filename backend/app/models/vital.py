from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base

class VitalSign(Base):
    __tablename__ = "vital_signs"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    heart_rate = Column(Integer, nullable=True)          # bpm
    bp_systolic = Column(Integer, nullable=True)         # mmHg
    bp_diastolic = Column(Integer, nullable=True)        # mmHg
    resp_rate = Column(Integer, nullable=True)           # breaths/min
    temp_celsius = Column(Float, nullable=True)          # °C
    o2_saturation = Column(Float, nullable=True)         # %
    blood_glucose = Column(Float, nullable=True)         # mg/dL
    
    notes = Column(String(500), nullable=True)
    recorded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    # Relationships
    patient = relationship("Patient", back_populates="vital_signs")
    recorder = relationship("User", back_populates="vitals_recorded")
