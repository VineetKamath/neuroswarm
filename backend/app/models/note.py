import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base

class NoteType(str, enum.Enum):
    PROGRESS = "PROGRESS"
    ADMISSION = "ADMISSION"
    DISCHARGE = "DISCHARGE"
    CONSULT = "CONSULT"
    SOAP = "SOAP"
    PROCEDURE = "PROCEDURE"

class ClinicalNote(Base):
    __tablename__ = "clinical_notes"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    note_type = Column(Enum(NoteType), default=NoteType.PROGRESS, nullable=False)
    title = Column(String(255), nullable=False)
    
    # SOAP / Clinical Structure
    chief_complaint = Column(Text, nullable=True)
    subjective = Column(Text, nullable=True)
    objective = Column(Text, nullable=True)
    assessment = Column(Text, nullable=True)
    plan = Column(Text, nullable=True)
    
    # Unstructured / Combined clinical narrative for embedding
    content = Column(Text, nullable=False)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    patient = relationship("Patient", back_populates="clinical_notes")
    author = relationship("User", back_populates="clinical_notes")
