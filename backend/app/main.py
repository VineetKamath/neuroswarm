import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.models.patient import Patient
from app.models.note import ClinicalNote
from app.services.vector_store import vector_store
from app.api import api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("medimind")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables
    logger.info("Initializing database schema...")
    Base.metadata.create_all(bind=engine)
    
    # Warm up Sentence-BERT and load initial FAISS vector store
    logger.info("Pre-warming vector indices for all patients...")
    db = SessionLocal()
    try:
        patients = db.query(Patient).all()
        for p in patients:
            notes = db.query(ClinicalNote).filter(ClinicalNote.patient_id == p.id).all()
            vector_store.index_patient_notes(p.id, notes)
        logger.info(f"Vector Store successfully initialized for {len(patients)} patients.")
    except Exception as e:
        logger.warning(f"Note index initialization notice: {e}")
    finally:
        db.close()
        
    yield
    
    logger.info("Shutting down MediMind server...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="MediMind Clinical Records & Grounded AI Care Coordination Assistant",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows Vite dev and production frontends
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "vector_engine": vector_store.get_index_stats()
    }
