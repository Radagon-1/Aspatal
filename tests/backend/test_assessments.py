"""
Phase 6.1 correction C + §7: Assessment API (18-22 in the Phase 6.1 test
list) -- creation, retrieval, idempotency, unknown-patient handling, and
authorization, matching the offline-safe Patient -> Assessment -> Referral
sequence.
"""
from conftest import actor_headers, idem_key


# 18. create assessment
def test_create_assessment(client, worker, patient):
    resp = client.post(
        "/api/assessments",
        json={
            "patient_id": patient.id,
            "chief_complaint": "chest pain",
            "recommendation": "referral",
        },
        headers={**actor_headers(worker), "Idempotency-Key": idem_key()},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["patient_id"] == patient.id
    assert data["created_by"] == worker.id
    assert data["recommendation"] == "referral"


# 19. get assessment
def test_get_assessment(client, worker, patient):
    create_resp = client.post(
        "/api/assessments",
        json={"patient_id": patient.id, "chief_complaint": "fever", "recommendation": "local_care"},
        headers={**actor_headers(worker), "Idempotency-Key": idem_key()},
    )
    assessment_id = create_resp.json()["id"]

    resp = client.get(f"/api/assessments/{assessment_id}", headers=actor_headers(worker))
    assert resp.status_code == 200
    assert resp.json()["id"] == assessment_id


# 20. assessment unknown patient -> 404
def test_create_assessment_unknown_patient_returns_404(client, worker):
    resp = client.post(
        "/api/assessments",
        json={"patient_id": "does-not-exist", "chief_complaint": "x", "recommendation": "local_care"},
        headers={**actor_headers(worker), "Idempotency-Key": idem_key()},
    )
    assert resp.status_code == 404


def test_get_unknown_assessment_returns_404(client, worker):
    resp = client.get("/api/assessments/does-not-exist", headers=actor_headers(worker))
    assert resp.status_code == 404


# 21. assessment idempotent retry
def test_assessment_idempotent_retry_does_not_duplicate(client, worker, patient, db_session):
    key = idem_key()
    body = {"patient_id": patient.id, "chief_complaint": "fever", "recommendation": "local_care"}
    headers = {**actor_headers(worker), "Idempotency-Key": key}

    first = client.post("/api/assessments", json=body, headers=headers)
    assert first.status_code == 201
    second = client.post("/api/assessments", json=body, headers=headers)
    assert second.status_code == 201
    assert first.json() == second.json()

    from app.models import Assessment

    assert db_session.query(Assessment).count() == 1


# 22. assessment remains linked to patient
def test_assessment_remains_linked_to_patient(client, worker, patient, db_session):
    resp = client.post(
        "/api/assessments",
        json={"patient_id": patient.id, "chief_complaint": "cough", "recommendation": "local_care"},
        headers={**actor_headers(worker), "Idempotency-Key": idem_key()},
    )
    assessment_id = resp.json()["id"]

    from app.models import Assessment

    assessment = db_session.get(Assessment, assessment_id)
    assert assessment.patient_id == patient.id
    assert assessment.patient.id == patient.id


# unauthorized/unassigned mutation is rejected
def test_unassigned_user_cannot_create_assessment(client, unassigned, patient):
    resp = client.post(
        "/api/assessments",
        json={"patient_id": patient.id, "chief_complaint": "x", "recommendation": "local_care"},
        headers={**actor_headers(unassigned), "Idempotency-Key": idem_key()},
    )
    assert resp.status_code == 403
