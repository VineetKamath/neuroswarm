import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve paths relative to the backend package, NOT the process CWD.
# This lets the app be launched from the repo root or from backend/ identically.
BACKEND_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_DB_PATH = DATA_DIR / "neuroswarm.db"


class Settings(BaseSettings):
    PROJECT_NAME: str = "NeuroSwarm — Bio-Inspired Clinical Intelligence"
    PROJECT_SHORT_NAME: str = "NeuroSwarm"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "neuroswarm-bio-inspired-jwt-signing-key-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12  # 12 hours

    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH.as_posix()}")

    # ---- Retrieval engine -------------------------------------------------
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    EMBEDDING_DIM: int = 384

    # Cosine cutoff below which the assistant refuses rather than guessing.
    SIMILARITY_THRESHOLD: float = float(os.getenv("SIMILARITY_THRESHOLD", "0.30"))
    # Candidate pool pulled from FAISS before bio-inspired re-ranking narrows it.
    CANDIDATE_POOL_K: int = 20
    TOP_K_NOTES: int = 5

    # ---- Bio-inspired subsystem ------------------------------------------
    BIO_ARTIFACT_DIR: Path = DATA_DIR / "bio"
    # Master switch: when False the pipeline runs the plain single-signal baseline.
    BIO_RANKING_ENABLED: bool = True
    BIO_TASK_GA_ENABLED: bool = True
    BIO_AIS_ENABLED: bool = True
    BIO_COMPRESSION_ENABLED: bool = True
    BIO_ACO_ENABLED: bool = True

    CORS_ORIGINS: List[str] = [
        "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000",
    ]

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")


settings = Settings()
settings.BIO_ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
