from fastapi import APIRouter
from app.api.auth import router as auth_router
from app.api.patients import router as patients_router
from app.api.vitals import router as vitals_router
from app.api.notes import router as notes_router
from app.api.tasks import router as tasks_router
from app.api.staff import router as staff_router
from app.api.rag import router as rag_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(patients_router)
api_router.include_router(vitals_router)
api_router.include_router(notes_router)
api_router.include_router(tasks_router)
api_router.include_router(staff_router)
api_router.include_router(rag_router)
