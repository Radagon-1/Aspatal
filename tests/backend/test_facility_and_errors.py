"""
Tests 28-29: facility service-name filtering, and unknown-ID error
responses.
"""
from conftest import actor_headers, idem_key


# 28. facility filtering by service works
def test_facility_filtering_by_service(client, worker, facility, other_facility):
    # `facility` fixture offers General OPD + X-Ray; `other_facility` offers
    # only General OPD (see conftest.py factories).
    resp = client.get("/api/facilities", params={"service_name": "X-Ray"}, headers=actor_headers(worker))
    assert resp.status_code == 200
    names = [f["name"] for f in resp.json()]
    assert facility.name in names
    assert other_facility.name not in names


def test_facility_filtering_by_active(client, worker, facility, db_session):
    from app.models import Facility

    inactive = Facility(name="Closed Facility", type="PHC", active=False)
    db_session.add(inactive)
    db_session.commit()

    resp = client.get("/api/facilities", params={"active": True}, headers=actor_headers(worker))
    names = [f["name"] for f in resp.json()]
    assert facility.name in names
    assert "Closed Facility" not in names


# 29. unknown patient/facility/referral returns appropriate error
def test_unknown_patient_returns_404(client, worker):
    resp = client.get("/api/patients/does-not-exist", headers=actor_headers(worker))
    assert resp.status_code == 404


def test_unknown_facility_returns_404(client, worker):
    resp = client.get("/api/facilities/does-not-exist", headers=actor_headers(worker))
    assert resp.status_code == 404


def test_unknown_referral_returns_404(client, worker):
    resp = client.get("/api/referrals/does-not-exist", headers=actor_headers(worker))
    assert resp.status_code == 404


def test_create_referral_with_unknown_patient_returns_404(client, worker, facility):
    resp = client.post(
        "/api/referrals",
        json={"patient_id": "does-not-exist", "assigned_facility_id": facility.id, "reason": "x"},
        headers={**actor_headers(worker), "Idempotency-Key": idem_key()},
    )
    assert resp.status_code == 404


def test_create_referral_with_unknown_facility_returns_404(client, worker, patient):
    resp = client.post(
        "/api/referrals",
        json={"patient_id": patient.id, "assigned_facility_id": "does-not-exist", "reason": "x"},
        headers={**actor_headers(worker), "Idempotency-Key": idem_key()},
    )
    assert resp.status_code == 404
