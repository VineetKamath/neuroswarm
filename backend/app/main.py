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
from app.bio.registry import bio_registry
from app.api import api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("neuroswarm")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables
    logger.info("Initializing database schema...")
    Base.metadata.create_all(bind=engine)
    
    # Trained optimizers must load BEFORE indexing: the evolved dimension mask
    # determines the vector space the indices are built in.
    logger.info("Loading bio-inspired artifacts...")
    bio_registry.load_all()

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
    
    logger.info("Shutting down NeuroSwarm server...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "Bio-inspired clinical intelligence. Retrieval, triage and data-quality "
        "decisions are tuned by Genetic Algorithms, Particle Swarm Optimization, "
        "an Artificial Immune System and Ant Colony Optimization. No language model "
        "is used anywhere in the response path."
    ),
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
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "llm_in_pipeline": False,
        "vector_engine": vector_store.get_index_stats(),
        "bio_inspired": bio_registry.status()["algorithms"],
    }
