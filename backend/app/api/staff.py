from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.rbac import require_admin
from app.core.security import get_password_hash
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.task import CareTask, TaskStatus
from app.models.note import ClinicalNote
from app.schemas.user import UserCreate, UserUpdate, UserOut
from app.services.vector_store import vector_store

router = APIRouter(prefix="/staff", tags=["Staff Management (Admin)"])

@router.get("", response_model=List[UserOut])
def list_staff(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    List all staff accounts.
    Available to: Admin only.
    """
    return db.query(User).order_by(User.role.asc(), User.full_name.asc()).all()

@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_staff_member(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Register a new hospital staff member.
    Available to: Admin only.
    """
    existing = db.query(User).filter(User.email == user_in.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Staff account with email '{user_in.email}' already exists."
        )

    user = User(
        email=user_in.email.lower(),
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        department=user_in.department,
        is_active=user_in.is_active if user_in.is_active is not None else True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.put("/{user_id}", response_model=UserOut)
def update_staff_member(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Update staff member role, department, or activation state.
    Available to: Admin only.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Staff user with ID {user_id} not found."
        )

    # Protect from deactivating oneself
    if user.id == current_user.id and user_in.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate their own account."
        )

    if user_in.full_name is not None:
        user.full_name = user_in.full_name
    if user_in.role is not None:
        user.role = user_in.role
    if user_in.department is not None:
        user.department = user_in.department
    if user_in.is_active is not None:
        user.is_active = user_in.is_active
    if user_in.password:
        user.hashed_password = get_password_hash(user_in.password)

    db.commit()
    db.refresh(user)
    return user

@router.get("/system-stats")
def get_system_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Get system health, patient counts, pending tasks, and vector store stats.
    Available to: Admin only.
    """
    total_patients = db.query(Patient).count()
    active_staff = db.query(User).filter(User.is_active == True).count()
    total_notes = db.query(ClinicalNote).count()
    pending_tasks = db.query(CareTask).filter(CareTask.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS])).count()
    
    vector_stats = vector_store.get_index_stats()

    return {
        "total_patients": total_patients,
        "active_staff": active_staff,
        "total_clinical_notes": total_notes,
        "pending_care_tasks": pending_tasks,
        "vector_engine": vector_stats,
        "system_status": "ONLINE",
        "rbac_enforcement": "ACTIVE"
    }
