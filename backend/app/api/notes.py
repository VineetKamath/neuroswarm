from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.rbac import require_any_authenticated, require_doctor_or_admin, require_clinical_staff
from app.db.session import get_db
from app.models.patient import Patient
from app.models.note import ClinicalNote
from app.models.user import User
from app.schemas.note import NoteCreate, NoteUpdate, NoteOut
from app.services.vector_store import vector_store

router = APIRouter(prefix="/notes", tags=["Clinical Notes"])

@router.post("", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_clinical_note(
    note_in: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_clinical_staff)
):
    """
    Create a new clinical note (SOAP, Progress, Admission, Consult, etc.).
    Automatically triggers incremental FAISS vector re-indexing for this patient.
    Available to: Doctor, Nurse, Admin.
    """
    patient = db.query(Patient).filter(Patient.id == note_in.patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {note_in.patient_id} not found."
        )

    note = ClinicalNote(
        **note_in.model_dump(),
        author_id=current_user.id
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    # Synchronize Vector Store for strict patient-scoped retrieval
    all_patient_notes = db.query(ClinicalNote).filter(ClinicalNote.patient_id == patient.id).all()
    vector_store.index_patient_notes(patient.id, all_patient_notes)

    return NoteOut(
        id=note.id,
        patient_id=note.patient_id,
        title=note.title,
        note_type=note.note_type,
        chief_complaint=note.chief_complaint,
        subjective=note.subjective,
        objective=note.objective,
        assessment=note.assessment,
        plan=note.plan,
        content=note.content,
        author_id=note.author_id,
        author_name=current_user.full_name,
        author_role=current_user.role.value,
        created_at=note.created_at,
        updated_at=note.updated_at
    )

@router.put("/{note_id}", response_model=NoteOut)
def update_clinical_note(
    note_id: int,
    note_in: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor_or_admin)
):
    """
    Edit an existing clinical note and synchronize vector embeddings.
    Available to: Doctor, Admin.
    """
    note = db.query(ClinicalNote).filter(ClinicalNote.id == note_id).first()
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Clinical Note with ID {note_id} not found."
        )

    update_data = note_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(note, field, val)

    db.commit()
    db.refresh(note)

    # Synchronize Vector Store
    all_patient_notes = db.query(ClinicalNote).filter(ClinicalNote.patient_id == note.patient_id).all()
    vector_store.index_patient_notes(note.patient_id, all_patient_notes)

    author_name = note.author.full_name if note.author else "Medical Staff"
    author_role = note.author.role.value if note.author else "UNKNOWN"

    return NoteOut(
        id=note.id,
        patient_id=note.patient_id,
        title=note.title,
        note_type=note.note_type,
        chief_complaint=note.chief_complaint,
        subjective=note.subjective,
        objective=note.objective,
        assessment=note.assessment,
        plan=note.plan,
        content=note.content,
        author_id=note.author_id,
        author_name=author_name,
        author_role=author_role,
        created_at=note.created_at,
        updated_at=note.updated_at
    )

@router.get("/patient/{patient_id}", response_model=List[NoteOut])
def get_patient_notes(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_authenticated)
):
    """
    Retrieve all clinical notes for a patient in reverse chronological order.
    Available to: Admin, Doctor, Nurse.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found."
        )

    notes = db.query(ClinicalNote).filter(ClinicalNote.patient_id == patient_id).order_by(ClinicalNote.created_at.desc()).all()
    
    return [
        NoteOut(
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
        )
        for n in notes
    ]
