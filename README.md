# MediMind — AI-Powered Patient Record & Care Coordination Platform

MediMind is a full-stack, role-secured hospital care coordination system and electronic health record (EHR) platform. It provides centralized patient records and a per-patient isolated RAG (Retrieval-Augmented Generation) assistant powered by **Sentence-BERT**, **FAISS**, and **Groq Llama 3.3 70B**.

---

## 🏥 Key Features & Technical Highlights

1. **Strict Role-Based Access Control (RBAC)**:
   - **Admin**: Full patient record management, staff account provisioning/deactivation, and vector store telemetry.
   - **Doctor**: Inpatient roster management, clinical/SOAP note documentation with automatic vector indexing, and grounded RAG assistant queries.
   - **Nurse**: Bedside checkup tasks queue (prioritized by STAT/High/Medium), quick vitals logging, task sign-off workflow, and RAG assistant access.
   - Enforced centrally via FastAPI dependency injection returning HTTP 403 Forbidden with clear messages.

2. **Per-Patient Grounded Clinical RAG**:
   - **HIPAA/PHI Data Isolation**: FAISS vector indices are strictly partitioned by `patient_id`. Queries for Patient A mathematically cannot retrieve notes from Patient B.
   - **Similarity Threshold Gate**: Cosine similarity cutoff (default `0.35`). Queries falling below this threshold immediately return *"No relevant information found in this patient's records"* without making an unnecessary or hallucination-prone LLM call.
   - **Clinical Transparency & Evidence**: Every answer cites exact source notes, timestamps, clinician authors, and vector similarity scores.
   - **Groq LLM Integration**: Generates grounded clinical answers with Llama 3.3 70B Versatile, with deterministic offline excerpt synthesis fallback when offline or without API key.

3. **Light Clinical UI Theme**:
   - High-contrast, clean aesthetic (Slate-50 background, Crisp white cards, Medical Blue & Teal accents).
   - Unified login with 1-click Demo Role Switcher (Admin, Doctor, Nurse).
   - Chronological vitals tables, SOAP notes with rich multi-field breakdown, and real-time care task kanban.

---

## 🚀 Quickstart Guide

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### 1. Backend Setup

```bash
cd backend

# Activate the virtual environment
.\venv\Scripts\activate

# Install requirements (already installed in venv)
pip install -r requirements.txt

# Run database & FAISS vector seed script (populates 5 staff accounts & 4 clinical patients)
python seed.py

# Start the FastAPI server (running on http://localhost:8000)
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend

# Install packages
npm install

# Start the Vite development server (running on http://localhost:5173)
npm run dev
```

---

## 👥 Demo Staff Credentials

| Role | Email | Password | Assigned Unit |
|---|---|---|---|
| **Admin** | `admin@medimind.org` | `password123` | Hospital Administration |
| **Doctor** | `dr.chen@medimind.org` | `password123` | Cardiology & Critical Care |
| **Doctor** | `dr.patel@medimind.org` | `password123` | Internal Medicine & Pulmonology |
| **Nurse** | `nurse.sarah@medimind.org` | `password123` | Cardiology & Step-Down |
| **Nurse** | `nurse.james@medimind.org` | `password123` | Pulmonology & General Ward |

*(You can also use the 1-click role buttons on the login screen to switch instantaneously).*

---

## 🧪 Running Automated Tests

```bash
# Run pytest test suite covering Auth, RBAC 403 enforcement, Patient vector isolation, and Similarity threshold
pytest -v
```

---

## 🏛️ Technical Architecture Summary for Interviews

> **MediMind Architecture Summary**:
> MediMind implements a layered clinical architecture separating role-secured RESTful services from an isolated vector retrieval engine. Role-Based Access Control is enforced at the gateway layer using FastAPI dependency injection to safeguard PHI across Admin, Physician, and Nursing roles. Clinical records and unstructured SOAP notes are embedded via Sentence-BERT (`all-MiniLM-L6-v2`) and indexed into per-patient partitioned FAISS vector stores, mathematically preventing cross-patient data leakage. The clinical RAG pipeline incorporates a pre-generation cosine similarity threshold that rejects out-of-domain or undocumented queries before invoking Groq's Llama 3.3 70B model, eliminating hallucinations while providing verifiable note citations with similarity metrics directly to clinicians.
