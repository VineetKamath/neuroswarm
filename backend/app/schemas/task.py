from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.task import TaskPriority, TaskStatus

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    status: TaskStatus = TaskStatus.PENDING
    due_time: Optional[datetime] = None
    completion_notes: Optional[str] = None

class TaskCreate(TaskBase):
    patient_id: int
    assigned_nurse_id: Optional[int] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    assigned_nurse_id: Optional[int] = None
    due_time: Optional[datetime] = None
    completion_notes: Optional[str] = None

class TaskOut(TaskBase):
    # Populated by the GA-evolved prioritization policy on list endpoints.
    urgency_score: Optional[float] = None
    task_category: Optional[str] = None
    overdue_hours: Optional[float] = None
    prioritized_by_ga: bool = False

    id: int
    patient_id: int
    patient_name: Optional[str] = None
    patient_room: Optional[str] = None
    assigned_nurse_id: Optional[int] = None
    assigned_nurse_name: Optional[str] = None
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
