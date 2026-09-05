import logging
import threading
import time
from typing import Any, Dict, List, Optional, Sequence, Tuple

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

from app.bio.routing import partition_key
from app.core.config import settings

logger = logging.getLogger(__name__)


class PatientVectorStore:
    """
    Per-patient isolated vector indices over Sentence-BERT embeddings.

    Design justification
    --------------------
    1. Patient-scoped isolation: indices are partitioned by patient_id, so a
       query for Patient A cannot retrieve vectors belonging to Patient B.
       The guarantee is structural, not a post-hoc filter.
    2. Section-aware chunking: SOAP notes are split per section so retrieval
       can resolve to "the Plan of the admission note" rather than a whole
       document, which is also what makes ACO partition routing meaningful.
    3. Cosine via inner product: embeddings are L2-normalized, so
       IndexFlatIP yields exact cosine similarity in [-1, 1].
    4. Evolved subspace (optional): when the binary GA has selected a
       dimension mask, vectors are projected and renormalized before indexing,
       and queries are projected identically. Renormalizing inside the
       subspace is what keeps the scores true cosines.
    """

    _instance: Optional["PatientVectorStore"] = None

    def __init__(self):
        self._patient_stores: Dict[int, Dict[str, Any]] = {}
        self._embedder: Optional[SentenceTransformer] = None
        self._lock = threading.RLock()
        self.embedding_dim = settings.EMBEDDING_DIM
        self.last_search_ms: float = 0.0
        self.last_encode_ms: float = 0.0

    @classmethod
    def get_instance(cls) -> "PatientVectorStore":
        if cls._instance is None:
            cls._instance = PatientVectorStore()
        return cls._instance

    # ---- model -----------------------------------------------------------
    @property
    def embedder(self) -> SentenceTransformer:
        if self._embedder is None:
            logger.info("Loading SentenceTransformer model: %s", settings.EMBEDDING_MODEL)
            self._embedder = SentenceTransformer(settings.EMBEDDING_MODEL)
        return self._embedder

    @property
    def _projector(self):
        """Resolved lazily to avoid a circular import at module load."""
        from app.bio.registry import bio_registry
        return bio_registry.projector

    @property
    def active_dim(self) -> int:
        p = self._projector
        return p.out_dim if p else self.embedding_dim

    def encode(self, texts: Sequence[str], apply_projection: bool = True) -> np.ndarray:
        t0 = time.perf_counter()
        vecs = self.embedder.encode(list(texts), convert_to_numpy=True, normalize_embeddings=True)
        self.last_encode_ms = (time.perf_counter() - t0) * 1000.0
        vecs = np.asarray(vecs, dtype=np.float32)
        if apply_projection:
            p = self._projector
            if p:
                vecs = p.project(vecs).astype(np.float32)
        return vecs

    # ---- chunking --------------------------------------------------------
    def _chunk_note(self, note: Any) -> List[Dict[str, Any]]:
        chunks: List[Dict[str, Any]] = []
        author_name = (note.author.full_name
                       if (getattr(note, "author", None) and note.author) else "Medical Staff")
        date_str = (note.created_at.strftime("%Y-%m-%d %H:%M")
                    if hasattr(note.created_at, "strftime") else str(note.created_at))
        note_type = note.note_type.value if hasattr(note.note_type, "value") else str(note.note_type)

        base_meta = {
            "note_id": note.id,
            "patient_id": note.patient_id,
            "note_title": note.title,
            "note_type": note_type,
            "author_name": author_name,
            "date_recorded": date_str,
        }

        soap_sections = [
            ("Chief Complaint", getattr(note, "chief_complaint", None)),
            ("Subjective History", getattr(note, "subjective", None)),
            ("Objective / Vitals / Labs", getattr(note, "objective", None)),
            ("Assessment & Diagnosis", getattr(note, "assessment", None)),
            ("Plan & Orders", getattr(note, "plan", None)),
        ]

        for sec_name, sec_val in soap_sections:
            if sec_val and len(sec_val.strip()) > 10:
                meta = dict(base_meta)
                meta["chunk_text"] = f"[{note_type}: {note.title} | {sec_name}]\n{sec_val.strip()}"
                meta["section"] = sec_name
                meta["partition"] = partition_key(note_type, sec_name)
                chunks.append(meta)

        full_content = getattr(note, "content", "") or ""
        if len(full_content.strip()) > 20:
            paragraphs = [p.strip() for p in full_content.split("\n\n") if len(p.strip()) > 15]
            if not paragraphs:
                paragraphs = [full_content.strip()]
            for i, para in enumerate(paragraphs):
                meta = dict(base_meta)
                meta["chunk_text"] = (f"[{note_type}: {note.title} "
                                      f"(Recorded {date_str} by {author_name})]\n{para}")
                meta["section"] = f"Narrative Part {i + 1}"
                meta["partition"] = partition_key(note_type, "Narrative")
                chunks.append(meta)

        return chunks

    # ---- indexing --------------------------------------------------------
    def index_patient_notes(self, patient_id: int, notes: List[Any]) -> int:
        all_chunks: List[Dict[str, Any]] = []
        for note in notes:
            all_chunks.extend(self._chunk_note(note))

        dim = self.active_dim
        with self._lock:
            if not all_chunks:
                self._patient_stores[patient_id] = {
                    "index": faiss.IndexFlatIP(dim), "metadata": [], "dim": dim,
                }
                return 0

            embeddings = self.encode([c["chunk_text"] for c in all_chunks])
            index = faiss.IndexFlatIP(embeddings.shape[1])
            index.add(embeddings.astype(np.float32))

            self._patient_stores[patient_id] = {
                "index": index,
                "metadata": all_chunks,
                "dim": int(embeddings.shape[1]),
                "vectors": embeddings.astype(np.float32),
            }
        logger.info("Indexed %d chunks for patient_id=%s (dim=%d)",
                    len(all_chunks), patient_id, embeddings.shape[1])
        return len(all_chunks)

    def add_or_update_note(self, note: Any, db_patient_notes: List[Any]) -> None:
        self.index_patient_notes(note.patient_id, db_patient_notes)

    def reindex_all(self, db) -> int:
        """Rebuild every patient index — required after the dimension mask changes."""
        from app.models.note import ClinicalNote
        from app.models.patient import Patient

        with self._lock:
            self._patient_stores.clear()
        total = 0
        for p in db.query(Patient).all():
            notes = db.query(ClinicalNote).filter(ClinicalNote.patient_id == p.id).all()
            total += self.index_patient_notes(p.id, notes)
        return total

    def _ensure_indexed(self, patient_id: int, db: Optional[Any]) -> bool:
        if patient_id in self._patient_stores:
            return True
        if db is None:
            return False
        from app.models.note import ClinicalNote
        notes = db.query(ClinicalNote).filter(ClinicalNote.patient_id == patient_id).all()
        self.index_patient_notes(patient_id, notes)
        return True

    # ---- search ----------------------------------------------------------
    def search_patient_notes(
        self,
        patient_id: int,
        query: str,
        top_k: int = 5,
        db: Optional[Any] = None,
        restrict_partitions: Optional[Sequence[str]] = None,
    ) -> List[Tuple[Dict[str, Any], float]]:
        """Vector search scoped strictly to one patient.

        `restrict_partitions` narrows the scan to the partitions chosen by the
        ant-colony router; when None the full patient index is scanned.
        """
        if not self._ensure_indexed(patient_id, db):
            return []

        store = self._patient_stores[patient_id]
        metadata: List[Dict[str, Any]] = store["metadata"]
        if not metadata or store["index"].ntotal == 0:
            return []

        query_vec = self.encode([query]).astype(np.float32)
        t0 = time.perf_counter()

        if restrict_partitions:
            allowed = set(restrict_partitions)
            idxs = [i for i, m in enumerate(metadata) if m.get("partition") in allowed]
            if not idxs:
                idxs = list(range(len(metadata)))       # never return nothing on a routing miss
            vectors = store["vectors"][idxs]
            scores = (vectors @ query_vec[0])
            order = np.argsort(-scores)[:top_k]
            results = [(metadata[idxs[int(o)]], float(scores[int(o)])) for o in order]
            self.last_search_ms = (time.perf_counter() - t0) * 1000.0
            return results

        actual_k = min(top_k, store["index"].ntotal)
        scores, indices = store["index"].search(query_vec, actual_k)
        self.last_search_ms = (time.perf_counter() - t0) * 1000.0

        return [
            (metadata[idx], float(score))
            for score, idx in zip(scores[0], indices[0])
            if 0 <= idx < len(metadata)
        ]

    # ---- introspection ---------------------------------------------------
    def get_patient_vectors(self, patient_id: int) -> Optional[np.ndarray]:
        store = self._patient_stores.get(patient_id)
        return store.get("vectors") if store else None

    def get_patient_metadata(self, patient_id: int) -> List[Dict[str, Any]]:
        store = self._patient_stores.get(patient_id)
        return store["metadata"] if store else []

    def partition_sizes(self) -> Dict[str, int]:
        """Chunk count per (note_type :: section) partition — the ACO cost model."""
        sizes: Dict[str, int] = {}
        for store in self._patient_stores.values():
            for m in store["metadata"]:
                key = m.get("partition") or partition_key(m.get("note_type", ""), m.get("section", ""))
                sizes[key] = sizes.get(key, 0) + 1
        return sizes

    def get_index_stats(self) -> Dict[str, Any]:
        total_chunks = sum(s["index"].ntotal for s in self._patient_stores.values())
        p = self._projector
        return {
            "total_indexed_patients": len(self._patient_stores),
            "total_indexed_chunks": total_chunks,
            "embedding_model": settings.EMBEDDING_MODEL,
            "native_dim": self.embedding_dim,
            "active_dim": self.active_dim,
            "compression_active": bool(p),
            "partitions": len(self.partition_sizes()),
            "last_search_ms": round(self.last_search_ms, 4),
            "last_encode_ms": round(self.last_encode_ms, 4),
        }


vector_store = PatientVectorStore.get_instance()
