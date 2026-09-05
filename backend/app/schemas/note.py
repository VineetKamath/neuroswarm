from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.note import NoteType

class NoteBase(BaseModel):
    title: str
    note_type: NoteType = NoteType.PROGRESS
    chief_complaint: Optional[str] = None
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    content: str

class NoteCreate(NoteBase):
    patient_id: int

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    note_type: Optional[NoteType] = None
    chief_complaint: Optional[str] = None
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    content: Optional[str] = None

class NoteOut(NoteBase):
    id: int
    patient_id: int
    author_id: Optional[int] = None
    author_name: Optional[str] = None
    author_role: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
