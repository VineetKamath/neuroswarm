import os
from typing import List, Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "MediMind EHR & AI Assistant"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "medimind-super-secret-jwt-key-2026-production-ready"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12  # 12 hours
    
    # Database: fallback to sqlite if postgresql is not reachable or configured
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./backend/data/medimind.db")
    
    # AI & Vector Engine Settings
    GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    
    # RAG Retrieval Threshold: Similarity cutoff below which the assistant refuses to hallucinate
    SIMILARITY_THRESHOLD: float = float(os.getenv("SIMILARITY_THRESHOLD", "0.35"))
    TOP_K_NOTES: int = 5
    
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
