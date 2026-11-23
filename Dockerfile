# NeuroSwarm: one container with the FastAPI backend and the built React app.
# Built for Hugging Face Spaces (Docker SDK, port 7860) but runs anywhere:
#   docker build -t neuroswarm . && docker run -p 7860:7860 neuroswarm

# ---- 1. build the frontend -------------------------------------------------
FROM node:20-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- 2. backend + static files ---------------------------------------------
FROM python:3.11-slim

# Spaces run the container as user 1000; give it a home and writable dirs.
RUN useradd -m -u 1000 user
ENV HOME=/home/user \
    HF_HOME=/home/user/.cache/huggingface \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    SERVE_FRONTEND=1 \
    FRONTEND_DIST=/app/frontend/dist
WORKDIR /app

# CPU-only PyTorch first: the default wheel pulls ~2 GB of CUDA libraries.
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch
COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt

COPY --chown=user backend/ backend/
COPY --from=web --chown=user /web/dist frontend/dist

USER user
# Download the embedding model at build time so the first request is fast.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

EXPOSE 7860
CMD ["python", "backend/run.py", "--host", "0.0.0.0", "--port", "7860"]
