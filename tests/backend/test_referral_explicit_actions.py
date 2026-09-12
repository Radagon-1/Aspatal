"""
Phase 6.1 §11 items 2-6: decline, cancel (from both valid origin states),
and no-show -- the explicit action endpoints not already exercised as part
of the main successful-journey test in test_referral_journey.py.
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


# 2. decline endpoint
def test_decline_from_assigned(client, worker, facility_user, facility, patient):
    referral_id = _create_referral(client, worker, patient.id, facility.id)
    resp = client.post(
        f"/api/referrals/{referral_id}/decline",
        json={"reason": "no capacity this week"},
        headers={**actor_headers(facility_user), "Idempotency-Key": idem_key()},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "DECLINED"
    assert data["closure_reason"] == "declined"


def test_decline_without_reason_rejected(client, worker, facility_user, facility, patient):
    referral_id = _create_referral(client, worker, patient.id, facility.id)
    resp = client.post(
        f"/api/referrals/{referral_id}/decline",
        json={},
        headers={**actor_headers(facility_user), "Idempotency-Key": idem_key()},
    )
    assert resp.status_code == 400, resp.text


# 3. cancel from ASSIGNED
def test_cancel_from_assigned(client, worker, facility, patient):
    referral_id = _create_referral(client, worker, patient.id, facility.id)
    resp = client.post(
        f"/api/referrals/{referral_id}/cancel",
        json={"reason": "patient recovered"},
        headers={**actor_headers(worker), "Idempotency-Key": idem_key()},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "CANCELLED"
    assert data["closure_reason"] == "cancelled"


# 4. cancel from CONFIRMED
def test_cancel_from_confirmed(client, worker, facility_user, facility, patient):
    referral_id = _create_referral(client, worker, patient.id, facility.id)
    _acknowledge(client, facility_user, referral_id)
    resp = client.post(
        f"/api/referrals/{referral_id}/cancel",
        json={"reason": "duplicate referral"},
        headers={**actor_headers(worker), "Idempotency-Key": idem_key()},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "CANCELLED"


def test_cancel_by_non_creator_worker_rejected(client, worker, facility, patient, db_session):
    from app.models.enums import UserRole
    from app.models import User
    import uuid

    other_worker = User(firebase_uid=f"uid-{uuid.uuid4()}", email="other@example.com", role=UserRole.WORKER)
    db_session.add(other_worker)
    db_session.commit()

    referral_id = _create_referral(client, worker, patient.id, facility.id)
    resp = client.post(
        f"/api/referrals/{referral_id}/cancel",
        json={"reason": "not my referral"},
        headers={**actor_headers(other_worker), "Idempotency-Key": idem_key()},
    )
    assert resp.status_code == 403, resp.text


# 6. no-show endpoint
def test_no_show_from_confirmed(client, worker, facility_user, facility, patient):
    referral_id = _create_referral(client, worker, patient.id, facility.id)
    _acknowledge(client, facility_user, referral_id)
    resp = client.post(
        f"/api/referrals/{referral_id}/no-show",
        json={},
        headers={**actor_headers(facility_user), "Idempotency-Key": idem_key()},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "NO_SHOW"
    assert data["closure_reason"] == "no_show"
