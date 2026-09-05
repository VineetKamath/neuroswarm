import logging
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
from app.core.config import settings

logger = logging.getLogger(__name__)

class PatientVectorStore:
    """
    Manages per-patient isolated vector indices using FAISS and Sentence-BERT.

    Design Justification:
    ---------------------
    1. Patient-Scoped Isolation: By partitioning FAISS indices per patient_id (or strict
       in-memory patient partitions), cross-patient data leakage is physically and mathematically
       prevented. Medical queries for Patient A can never retrieve vectors from Patient B,
       satisfying clinical privacy (HIPAA) and patient safety standards.
    2. Dynamic Chunking: Clinical notes often contain SOAP sections (Subjective, Objective,
       Assessment, Plan). Chunking preserves section-level semantic fidelity for focused retrieval.
    3. Normalization & Cosine Similarity: Sentence-BERT embeddings are L2-normalized, allowing
       faiss.IndexFlatIP (inner product) to compute exact cosine similarity in the [-1.0, 1.0] range.
    """
    _instance = None
    _embedder = None

    def __init__(self):
        # Dictionary of patient_id -> {'index': faiss.IndexFlatIP, 'metadata': List[Dict]}
        self._patient_stores: Dict[int, Dict[str, Any]] = {}
        self.embedding_dim = 384  # all-MiniLM-L6-v2 dimension

    @classmethod
    def get_instance(cls) -> "PatientVectorStore":
        if cls._instance is None:
            cls._instance = PatientVectorStore()
        return cls._instance

    @property
    def embedder(self) -> SentenceTransformer:
        if self._embedder is None:
            logger.info(f"Loading SentenceTransformer model: {settings.EMBEDDING_MODEL}")
            self._embedder = SentenceTransformer(settings.EMBEDDING_MODEL)
        return self._embedder

    def _chunk_note(self, note: Any) -> List[Dict[str, Any]]:
        """
        Splits a clinical note into meaningful semantic chunks.
        Includes structured SOAP components if present, plus narrative blocks.
        """
        chunks = []
        author_name = note.author.full_name if (getattr(note, 'author', None) and note.author) else "Medical Staff"
        date_str = note.created_at.strftime("%Y-%m-%d %H:%M") if hasattr(note.created_at, 'strftime') else str(note.created_at)

        base_meta = {
            "note_id": note.id,
            "patient_id": note.patient_id,
            "note_title": note.title,
            "note_type": note.note_type.value if hasattr(note.note_type, 'value') else str(note.note_type),
            "author_name": author_name,
            "date_recorded": date_str,
        }

        # If note has distinct SOAP fields, index each substantive section
        soap_sections = [
            ("Chief Complaint", getattr(note, "chief_complaint", None)),
            ("Subjective History", getattr(note, "subjective", None)),
            ("Objective / Vitals / Labs", getattr(note, "objective", None)),
            ("Assessment & Diagnosis", getattr(note, "assessment", None)),
            ("Plan & Orders", getattr(note, "plan", None)),
        ]

        added_sections = 0
        for sec_name, sec_val in soap_sections:
            if sec_val and len(sec_val.strip()) > 10:
                chunk_text = f"[{base_meta['note_type']}: {note.title} | {sec_name}]\n{sec_val.strip()}"
                chunk_meta = dict(base_meta)
                chunk_meta["chunk_text"] = chunk_text
                chunk_meta["section"] = sec_name
                chunks.append(chunk_meta)
                added_sections += 1

        # Also chunk the main/full content if provided or if SOAP wasn't broken down
        full_content = getattr(note, "content", "")
        if full_content and len(full_content.strip()) > 20:
            # If length is long (> 600 chars), chunk into paragraphs; otherwise single chunk
            paragraphs = [p.strip() for p in full_content.split("\n\n") if len(p.strip()) > 15]
            if not paragraphs:
                paragraphs = [full_content.strip()]

            for i, p in enumerate(paragraphs):
                chunk_text = f"[{base_meta['note_type']}: {note.title} (Recorded {date_str} by {author_name})]\n{p}"
                chunk_meta = dict(base_meta)
                chunk_meta["chunk_text"] = chunk_text
                chunk_meta["section"] = f"Narrative Part {i+1}"
                chunks.append(chunk_meta)

        return chunks

    def index_patient_notes(self, patient_id: int, notes: List[Any]) -> int:
        """
        Indexes or re-indexes all clinical notes belonging to a specific patient.
        Replaces any existing vector store for this patient.
        """
        all_chunks = []
        for note in notes:
            all_chunks.extend(self._chunk_note(note))

        if not all_chunks:
            # Create empty index
            index = faiss.IndexFlatIP(self.embedding_dim)
            self._patient_stores[patient_id] = {"index": index, "metadata": []}
            return 0

        # Extract texts and compute normalized embeddings for Cosine Similarity
        texts = [chunk["chunk_text"] for chunk in all_chunks]
        embeddings = self.embedder.encode(texts, convert_to_numpy=True, normalize_embeddings=True)

        index = faiss.IndexFlatIP(self.embedding_dim)
        index.add(embeddings.astype(np.float32))

        self._patient_stores[patient_id] = {
            "index": index,
            "metadata": all_chunks
        }
        logger.info(f"Indexed {len(all_chunks)} chunks for patient_id={patient_id}")
        return len(all_chunks)

    def add_or_update_note(self, note: Any, db_patient_notes: List[Any]) -> None:
        """
        Refreshes the patient's vector store with their latest notes.
        """
        self.index_patient_notes(note.patient_id, db_patient_notes)

    def search_patient_notes(
        self, patient_id: int, query: str, top_k: int = 5, db: Optional[Any] = None
    ) -> List[Tuple[Dict[str, Any], float]]:
        """
        Performs vector search strictly scoped to the specified patient_id.
        Returns a list of (metadata_dict, cosine_similarity_score).
        """
        if patient_id not in self._patient_stores:
            if db is not None:
                from app.models.note import ClinicalNote
                notes = db.query(ClinicalNote).filter(ClinicalNote.patient_id == patient_id).all()
                self.index_patient_notes(patient_id, notes)
            else:
                return []

        store = self._patient_stores[patient_id]
        index: faiss.IndexFlatIP = store["index"]
        metadata: List[Dict[str, Any]] = store["metadata"]

        if index.ntotal == 0 or len(metadata) == 0:
            return []

        # Encode search query with L2 normalization
        query_vec = self.embedder.encode([query], convert_to_numpy=True, normalize_embeddings=True)
        query_vec = query_vec.astype(np.float32)

        actual_k = min(top_k, index.ntotal)
        scores, indices = index.search(query_vec, actual_k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0 and idx < len(metadata):
                results.append((metadata[idx], float(score)))

        return results

    def get_index_stats(self) -> Dict[str, Any]:
        """Telemetry on indexed patients and chunk counts."""
        total_patients = len(self._patient_stores)
        total_chunks = sum(store["index"].ntotal for store in self._patient_stores.values())
        return {
            "total_indexed_patients": total_patients,
            "total_indexed_chunks": total_chunks,
            "embedding_model": settings.EMBEDDING_MODEL,
            "embedding_dim": self.embedding_dim
        }

vector_store = PatientVectorStore.get_instance()
