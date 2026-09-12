"""
Tests 22-23 (Phase 6) + Phase 6.1 correction A tests 14-17 + Phase 6.2
target-binding regression test: retrying a mutating request with the same
Idempotency-Key must not duplicate the domain effect, a key must be bound
to the endpoint it was first used on, AND -- Phase 6.2's fix -- a key must
also be bound to the specific TARGET ENTITY it was first used against.
Reusing a key against the same endpoint template but a different entity
(e.g. a different referral) must be rejected, not silently replay the
first entity's stored response for the second.
"""
from conftest import actor_headers, idem_key


def _create_referral_body(patient_id, facility_id):
    return {"patient_id": patient_id, "assigned_facility_id": facility_id, "reason": "test"}


# 23. idempotent referral creation does not duplicate referral
def test_idempotent_referral_creation_does_not_duplicate(client, worker, facility, patient, db_session):
    key = idem_key()
    body = _create_referral_body(patient.id, facility.id)
    headers = {**actor_headers(worker), "Idempotency-Key": key}

    first = client.post("/api/referrals", json=body, headers=headers)
    assert first.status_code == 201
    second = client.post("/api/referrals", json=body, headers=headers)
    assert second.status_code == 201
    assert first.json() == second.json()

    from app.models import Referral

    assert db_session.query(Referral).count() == 1


# 22. idempotent retry does not duplicate event (14. same key + same endpoint replays)
def test_idempotent_acknowledge_retry_does_not_duplicate_event(
    client, worker, facility, facility_user, patient, db_session
):
    referral_id = client.post(
        "/api/referrals",
        json=_create_referral_body(patient.id, facility.id),
        headers={**actor_headers(worker), "Idempotency-Key": idem_key()},
    ).json()["id"]

    key = idem_key()
    headers = {**actor_headers(facility_user), "Idempotency-Key": key}

    first = client.post(f"/api/referrals/{referral_id}/acknowledge", json={}, headers=headers)
    assert first.status_code == 200
    second = client.post(f"/api/referrals/{referral_id}/acknowledge", json={}, headers=headers)
    assert second.status_code == 200
    assert first.json() == second.json()

    from app.models import ReferralEvent

    events = db_session.query(ReferralEvent).filter_by(referral_id=referral_id).all()
    event_types = [e.event_type.value for e in events]
    assert event_types.count("REFERRAL_CONFIRMED") == 1


# 15. same key + different endpoint returns 409
def test_same_key_different_endpoint_returns_409(client, worker, facility, patient):
    key = idem_key()
    headers = {**actor_headers(worker), "Idempotency-Key": key}

    patient_resp = client.post(
        "/api/patients",
        json={"full_name": "Another Patient", "approximate_age": 50},
        headers=headers,
    )
    assert patient_resp.status_code == 201

    referral_resp = client.post(
        "/api/referrals",
        json=_create_referral_body(patient.id, facility.id),
        headers=headers,  # SAME Idempotency-Key, different endpoint
    )
    assert referral_resp.status_code == 409, referral_resp.text


# 16, 17. cross-endpoint reuse performs no second domain mutation and
# appends no unexpected ReferralEvent
def test_cross_endpoint_key_reuse_creates_no_second_entity_or_event(
    client, worker, facility, facility_user, patient, db_session
):
    key = idem_key()

    referral_id = client.post(
        "/api/referrals",
        json=_create_referral_body(patient.id, facility.id),
        headers={**actor_headers(worker), "Idempotency-Key": key},
    ).json()["id"]

    from app.models import Referral, ReferralEvent

    referral_count_before = db_session.query(Referral).count()
    event_count_before = db_session.query(ReferralEvent).count()

    # Reuse the SAME key against a completely different endpoint/referral action.
    conflict = client.post(
        f"/api/referrals/{referral_id}/acknowledge",
        json={},
        headers={**actor_headers(facility_user), "Idempotency-Key": key},
    )
    assert conflict.status_code == 409, conflict.text

    assert db_session.query(Referral).count() == referral_count_before
    assert db_session.query(ReferralEvent).count() == event_count_before


# Phase 6.2 regression test: the exact bug reported -- same key, same
# endpoint TEMPLATE, but a DIFFERENT target referral. Must be rejected, not
# replayed as though it were a legitimate retry.
def test_same_key_same_endpoint_different_referral_returns_409(
    client, worker, facility, facility_user, patient, db_session
):
    from app.models import Referral, ReferralEvent

    referral_a_id = client.post(
        "/api/referrals",
        json=_create_referral_body(patient.id, facility.id),
        headers={**actor_headers(worker), "Idempotency-Key": idem_key()},
    ).json()["id"]
    referral_b_id = client.post(
        "/api/referrals",
        json=_create_referral_body(patient.id, facility.id),
        headers={**actor_headers(worker), "Idempotency-Key": idem_key()},
    ).json()["id"]
    assert referral_a_id != referral_b_id

    key = idem_key()

    resp_a = client.post(
        f"/api/referrals/{referral_a_id}/acknowledge",
        json={},
        headers={**actor_headers(facility_user), "Idempotency-Key": key},
    )
    assert resp_a.status_code == 200, resp_a.text
    assert resp_a.json()["id"] == referral_a_id
    assert resp_a.json()["status"] == "CONFIRMED"

    # SAME key, SAME endpoint template, DIFFERENT referral.
    resp_b = client.post(
        f"/api/referrals/{referral_b_id}/acknowledge",
        json={},
        headers={**actor_headers(facility_user), "Idempotency-Key": key},
    )
    assert resp_b.status_code == 409, resp_b.text
    # The rejected response must not be (or contain) Referral A's payload.
    assert resp_b.json().get("id") != referral_a_id
    assert "status" not in resp_b.json()

    referral_a = db_session.get(Referral, referral_a_id)
    referral_b = db_session.get(Referral, referral_b_id)
    assert referral_a.status.value == "CONFIRMED"
    assert referral_b.status.value == "ASSIGNED"

    events_a = [
        e.event_type.value
        for e in db_session.query(ReferralEvent).filter_by(referral_id=referral_a_id).all()
    ]
    events_b = [
        e.event_type.value
        for e in db_session.query(ReferralEvent).filter_by(referral_id=referral_b_id).all()
    ]
    assert events_a == ["REFERRAL_ASSIGNED", "REFERRAL_CONFIRMED"]
    assert events_b == ["REFERRAL_ASSIGNED"]
    assert events_a.count("REFERRAL_CONFIRMED") == 1
