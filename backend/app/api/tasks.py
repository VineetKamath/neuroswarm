from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.rbac import require_any_authenticated, require_clinical_staff, require_doctor_or_admin
from app.db.session import get_db
from app.models.patient import Patient
from app.models.task import CareTask, TaskStatus, TaskPriority
from app.models.user import User, UserRole
from app.schemas.task import TaskCreate, TaskUpdate, TaskOut

router = APIRouter(prefix="/tasks", tags=["Care Coordination & Tasks"])

@router.get("", response_model=List[TaskOut])
def list_tasks(
    nurse_id: Optional[int] = Query(None, description="Filter by assigned nurse"),
    patient_id: Optional[int] = Query(None, description="Filter by patient"),
    status: Optional[TaskStatus] = Query(None, description="Filter by task status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_authenticated)
):
    """
    List daily checkup and care tasks.
    Available to: Admin, Doctor, Nurse.
    """
    query = db.query(CareTask)
    
    if nurse_id:
        query = query.filter(CareTask.assigned_nurse_id == nurse_id)
    if patient_id:
        query = query.filter(CareTask.patient_id == patient_id)
    if status:
        query = query.filter(CareTask.status == status)

    tasks = query.order_by(CareTask.due_time.asc(), CareTask.priority.desc()).all()
    
    results = []
    for t in tasks:
        results.append(TaskOut(
            id=t.id,
            patient_id=t.patient_id,
            patient_name=t.patient.full_name if t.patient else "Unknown",
            patient_room=t.patient.room_number if t.patient else None,
            title=t.title,
            description=t.description,
            priority=t.priority,
            status=t.status,
            assigned_nurse_id=t.assigned_nurse_id,
            assigned_nurse_name=t.assigned_nurse.full_name if t.assigned_nurse else None,
            created_by_id=t.created_by_id,
            created_by_name=t.created_by.full_name if t.created_by else None,
            due_time=t.due_time,
            completed_at=t.completed_at,
            completion_notes=t.completion_notes,
            created_at=t.created_at,
            updated_at=t.updated_at
        ))
    return results

@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    task_in: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_clinical_staff)
):
    """
    Assign a new checkup or clinical care task for a patient.
    Available to: Nurse, Doctor.
    """
    patient = db.query(Patient).filter(Patient.id == task_in.patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {task_in.patient_id} not found."
        )

    task = CareTask(
        **task_in.model_dump(),
        created_by_id=current_user.id
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    return TaskOut(
        id=task.id,
        patient_id=task.patient_id,
        patient_name=patient.full_name,
        patient_room=patient.room_number,
        title=task.title,
        description=task.description,
        priority=task.priority,
        status=task.status,
        assigned_nurse_id=task.assigned_nurse_id,
        assigned_nurse_name=task.assigned_nurse.full_name if task.assigned_nurse else None,
        created_by_id=task.created_by_id,
        created_by_name=current_user.full_name,
        due_time=task.due_time,
        completed_at=task.completed_at,
        completion_notes=task.completion_notes,
        created_at=task.created_at,
        updated_at=task.updated_at
    )

@router.patch("/{task_id}/status", response_model=TaskOut)
def update_task_status(
    task_id: int,
    status_update: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_authenticated)
):
    """
    Update task status (e.g. mark IN_PROGRESS, mark COMPLETED with notes).
    Available to: Nurse, Doctor, Admin.
    """
    task = db.query(CareTask).filter(CareTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found."
        )

    if status_update.status is not None:
        task.status = status_update.status
        if status_update.status == TaskStatus.COMPLETED and not task.completed_at:
            task.completed_at = datetime.now(timezone.utc)
        elif status_update.status != TaskStatus.COMPLETED:
            task.completed_at = None

    if status_update.completion_notes is not None:
        task.completion_notes = status_update.completion_notes

    if status_update.assigned_nurse_id is not None:
        task.assigned_nurse_id = status_update.assigned_nurse_id

    if status_update.priority is not None:
        task.priority = status_update.priority

    db.commit()
    db.refresh(task)

    return TaskOut(
        id=task.id,
        patient_id=task.patient_id,
        patient_name=task.patient.full_name if task.patient else "Unknown",
        patient_room=task.patient.room_number if task.patient else None,
        title=task.title,
        description=task.description,
        priority=task.priority,
        status=task.status,
        assigned_nurse_id=task.assigned_nurse_id,
        assigned_nurse_name=task.assigned_nurse.full_name if task.assigned_nurse else None,
        created_by_id=task.created_by_id,
        created_by_name=task.created_by.full_name if task.created_by else None,
        due_time=task.due_time,
        completed_at=task.completed_at,
        completion_notes=task.completion_notes,
        created_at=task.created_at,
        updated_at=task.updated_at
    )
