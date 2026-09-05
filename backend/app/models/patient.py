import enum
from datetime import datetime, date, timezone
from sqlalchemy import Column, Integer, String, Text, Date, DateTime, Enum
from sqlalchemy.orm import relationship
from app.db.base import Base

class PatientStatus(str, enum.Enum):
    ADMITTED = "ADMITTED"
    CRITICAL = "CRITICAL"
    STABLE = "STABLE"
    DISCHARGED = "DISCHARGED"

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    mrn = Column(String(50), unique=True, index=True, nullable=False) # Medical Record Number
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(Date, nullable=False)
    gender = Column(String(20), nullable=False)
    blood_group = Column(String(10), nullable=True)
    
    # Hospitalization info
    ward = Column(String(100), nullable=True)
    room_number = Column(String(50), nullable=True)
    admission_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    status = Column(Enum(PatientStatus), default=PatientStatus.ADMITTED, nullable=False)
    
    # Clinical Background
    primary_diagnosis = Column(String(255), nullable=True)
    allergies = Column(Text, nullable=True)  # JSON string or comma-separated list
    medical_history = Column(Text, nullable=True)
    emergency_contact = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    clinical_notes = relationship("ClinicalNote", back_populates="patient", cascade="all, delete-orphan", order_by="desc(ClinicalNote.created_at)")
    vital_signs = relationship("VitalSign", back_populates="patient", cascade="all, delete-orphan", order_by="desc(VitalSign.recorded_at)")
    care_tasks = relationship("CareTask", back_populates="patient", cascade="all, delete-orphan", order_by="desc(CareTask.due_time)")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
