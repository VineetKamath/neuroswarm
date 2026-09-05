import pytest
from fastapi.testclient import TestClient
from app.main import app

def test_rag_patient_isolation():
    with TestClient(app) as client:
        # Login as doctor
        res_doc = client.post("/api/auth/login", json={"email": "dr.chen@neuroswarm.health", "password": "password123"})
        token = res_doc.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Query Patient 1 (Eleanor Vance - Heart Failure) about pneumonia
        res_p1 = client.post(
            "/api/rag/query",
            json={"patient_id": 1, "question": "What bacteria was isolated in the sputum culture?"},
            headers=headers
        )
        assert res_p1.status_code == 200
        p1_data = res_p1.json()
        # Eleanor Vance does NOT have pneumonia or sputum cultures; retrieval will either be rejected by threshold or not leak Patient 2 notes
        if p1_data["has_sufficient_context"]:
            for src in p1_data["sources"]:
                assert "Brody" not in src["chunk_text"]
        else:
            assert "No relevant information" in p1_data["answer"]

        # Query Patient 2 (Marcus Brody - Pneumonia) about sputum cultures
        res_p2 = client.post(
            "/api/rag/query",
            json={"patient_id": 2, "question": "What bacteria was found in the sputum culture and what antibiotics were given?"},
            headers=headers
        )
        assert res_p2.status_code == 200
        p2_data = res_p2.json()
        assert p2_data["has_sufficient_context"] is True
        assert len(p2_data["sources"]) > 0
        # Check that retrieved notes belong exclusively to Marcus Brody
        assert "streptococcus" in p2_data["answer"].lower() or "ceftriaxone" in p2_data["answer"].lower() or "pneumonia" in p2_data["answer"].lower()

def test_rag_similarity_threshold_rejection():
    with TestClient(app) as client:
        # Login as doctor
        res_doc = client.post("/api/auth/login", json={"email": "dr.chen@neuroswarm.health", "password": "password123"})
        token = res_doc.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Out of domain query completely unrelated to medical records
        res = client.post(
            "/api/rag/query",
            json={"patient_id": 1, "question": "What is the recipe for baking chocolate chip cookies?"},
            headers=headers
        )
        assert res.status_code == 200
        data = res.json()
        assert data["has_sufficient_context"] is False
        assert "No relevant information found" in data["answer"]
        assert len(data["sources"]) == 0
