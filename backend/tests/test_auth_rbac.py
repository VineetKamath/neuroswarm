import pytest
from fastapi.testclient import TestClient
from app.main import app

def test_health():
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "vector_engine" in data

def test_login_and_roles():
    with TestClient(app) as client:
        # Admin login
        res_admin = client.post("/api/auth/login", json={"email": "admin@neuroswarm.health", "password": "password123"})
        assert res_admin.status_code == 200
        admin_data = res_admin.json()
        assert admin_data["user"]["role"] == "ADMIN"

        # Doctor login
        res_doc = client.post("/api/auth/login", json={"email": "dr.chen@neuroswarm.health", "password": "password123"})
        assert res_doc.status_code == 200
        doc_data = res_doc.json()
        assert doc_data["user"]["role"] == "DOCTOR"

        # Nurse login
        res_nurse = client.post("/api/auth/login", json={"email": "nurse.sarah@neuroswarm.health", "password": "password123"})
        assert res_nurse.status_code == 200
        nurse_data = res_nurse.json()
        assert nurse_data["user"]["role"] == "NURSE"

        # Invalid login
        res_bad = client.post("/api/auth/login", json={"email": "admin@neuroswarm.health", "password": "wrongpassword"})
        assert res_bad.status_code == 401

def test_rbac_403_enforcement():
    with TestClient(app) as client:
        # Login as nurse
        res_nurse = client.post("/api/auth/login", json={"email": "nurse.sarah@neuroswarm.health", "password": "password123"})
        nurse_token = res_nurse.json()["access_token"]
        nurse_headers = {"Authorization": f"Bearer {nurse_token}"}

        # Nurse tries to access Admin staff endpoint -> MUST receive 403
        res_staff = client.get("/api/staff", headers=nurse_headers)
        assert res_staff.status_code == 403
        assert "Access denied" in res_staff.json()["detail"]

        # Nurse tries to delete a patient -> MUST receive 403
        res_del = client.delete("/api/patients/1", headers=nurse_headers)
        assert res_del.status_code == 403

def test_unauthenticated_401():
    with TestClient(app) as client:
        # No token -> MUST receive 401
        res = client.get("/api/patients")
        assert res.status_code == 401
