import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship
from app.db.base import Base

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    DOCTOR = "DOCTOR"
    NURSE = "NURSE"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.NURSE)
    department = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    clinical_notes = relationship("ClinicalNote", back_populates="author")
    vitals_recorded = relationship("VitalSign", back_populates="recorder")
    assigned_tasks = relationship("CareTask", foreign_keys="CareTask.assigned_nurse_id", back_populates="assigned_nurse")
    created_tasks = relationship("CareTask", foreign_keys="CareTask.created_by_id", back_populates="created_by")
