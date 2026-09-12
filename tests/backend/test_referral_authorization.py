"""
Tests 19-21 (+12, 13 from Phase 6.1's list): facility-ownership and role
authorization on referral mutation, exercised via the explicit action
endpoints.
"""
from conftest import actor_headers, idem_key


def _create_referral(client, worker, patient_id, facility_id):
    resp = client.post(
        "/api/referrals",
        json={"patient_id": patient_id, "assigned_facility_id": facility_id, "reason": "test"},
        headers={**actor_headers(worker), "Idempotency-Key": idem_key()},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _acknowledge(client, actor, referral_id):
    return client.post(
        f"/api/referrals/{referral_id}/acknowledge",
        json={},
        headers={**actor_headers(actor), "Idempotency-Key": idem_key()},
    )


# 19 / 12. wrong facility cannot transition referral
def test_wrong_facility_cannot_acknowledge(client, worker, facility, other_facility_user, patient):
    referral_id = _create_referral(client, worker, patient.id, facility.id)
    resp = _acknowledge(client, other_facility_user, referral_id)
    assert resp.status_code == 403, resp.text


# 20. assigned facility can transition referral
def test_assigned_facility_can_acknowledge(client, worker, facility, facility_user, patient):
    referral_id = _create_referral(client, worker, patient.id, facility.id)
    resp = _acknowledge(client, facility_user, referral_id)
    assert resp.status_code == 200, resp.text


# 21 / 13. unassigned user cannot mutate workflow
def test_unassigned_user_cannot_create_patient(client, unassigned):
    resp = client.post(
        "/api/patients",
        json={"full_name": "X", "approximate_age": 20},
        headers={**actor_headers(unassigned), "Idempotency-Key": idem_key()},
    )
    assert resp.status_code == 403, resp.text


def test_unassigned_user_cannot_create_referral(client, unassigned, facility, patient):
    resp = client.post(
        "/api/referrals",
        json={"patient_id": patient.id, "assigned_facility_id": facility.id, "reason": "x"},
        headers={**actor_headers(unassigned), "Idempotency-Key": idem_key()},
    )
    assert resp.status_code == 403, resp.text


def test_unassigned_user_cannot_acknowledge(client, worker, facility, facility_user, unassigned, patient):
    referral_id = _create_referral(client, worker, patient.id, facility.id)
    resp = _acknowledge(client, unassigned, referral_id)
    assert resp.status_code == 403, resp.text
