"""
Fix E: when a client supplies its own entity UUID on a create endpoint, and
that same entity was already created successfully under a DIFFERENT
operation key, the endpoint must return the existing entity rather than
fail solely because the primary key already exists (or worse, duplicate
it). Applies to POST /api/patients, /api/assessments, /api/referrals.

Covers the five required scenarios from the task, using Patient as the
primary example and Referral for the event-count-specific scenario 5.
"""
import uuid

from conftest import actor_headers, idem_key


def test_patient_first_create_with_entity_uuid_succeeds(client, worker):
    entity_id = str(uuid.uuid4())
    resp = client.post(
        "/api/patients",
        json={"id": entity_id, "full_name": "Ramesh Kumar", "approximate_age": 45},
        headers={**actor_headers(worker), "Idempotency-Key": idem_key()},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["id"] == entity_id


def test_patient_retry_same_entity_same_key_replays(client, worker, db_session):
    entity_id = str(uuid.uuid4())
    key = idem_key()
    body = {"id": entity_id, "full_name": "Ramesh Kumar", "approximate_age": 45}
    headers = {**actor_headers(worker), "Idempotency-Key": key}

    first = client.post("/api/patients", json=body, headers=headers)
    second = client.post("/api/patients", json=body, headers=headers)
    assert first.status_code == second.status_code == 201
    assert first.json() == second.json()

    from app.models import Patient

    assert db_session.query(Patient).filter_by(id=entity_id).count() == 1


def test_patient_same_entity_different_operation_key_returns_existing_no_duplicate(
    client, worker, db_session
):
    entity_id = str(uuid.uuid4())
    body = {"id": entity_id, "full_name": "Ramesh Kumar", "approximate_age": 45}

    first = client.post(
        "/api/patients", json=body, headers={**actor_headers(worker), "Idempotency-Key": idem_key()}
    )
    assert first.status_code == 201

    # Scenario 3: SAME entity UUID, DIFFERENT operation key.
    second = client.post(
        "/api/patients", json=body, headers={**actor_headers(worker), "Idempotency-Key": idem_key()}
    )
    assert second.status_code == 201, second.text
    assert second.json()["id"] == entity_id
    assert second.json() == first.json()

    from app.models import Patient

    assert db_session.query(Patient).filter_by(id=entity_id).count() == 1


def test_patient_same_operation_key_cannot_target_different_entity(client, worker):
    key = idem_key()
    entity_a = str(uuid.uuid4())
    entity_b = str(uuid.uuid4())

    resp_a = client.post(
        "/api/patients",
        json={"id": entity_a, "full_name": "Patient A", "approximate_age": 30},
        headers={**actor_headers(worker), "Idempotency-Key": key},
    )
    assert resp_a.status_code == 201

    # Scenario 4: SAME operation key, DIFFERENT entity UUID -> 409.
    resp_b = client.post(
        "/api/patients",
        json={"id": entity_b, "full_name": "Patient B", "approximate_age": 40},
        headers={**actor_headers(worker), "Idempotency-Key": key},
    )
    assert resp_b.status_code == 409, resp_b.text


def test_assessment_same_entity_different_operation_key_returns_existing(client, worker, patient, db_session):
    entity_id = str(uuid.uuid4())
    body = {
        "id": entity_id,
        "patient_id": patient.id,
        "chief_complaint": "fever",
        "recommendation": "local_care",
    }

    first = client.post(
        "/api/assessments", json=body, headers={**actor_headers(worker), "Idempotency-Key": idem_key()}
    )
    assert first.status_code == 201

    second = client.post(
        "/api/assessments", json=body, headers={**actor_headers(worker), "Idempotency-Key": idem_key()}
    )
    assert second.status_code == 201
    assert second.json()["id"] == entity_id

    from app.models import Assessment

    assert db_session.query(Assessment).filter_by(id=entity_id).count() == 1


# Scenario 5: event-producing referral creation does not create a second
# REFERRAL_ASSIGNED event when the same entity is submitted under a
# different operation key.
def test_referral_same_entity_different_operation_key_no_duplicate_event(
    client, worker, facility, patient, db_session
):
    entity_id = str(uuid.uuid4())
    body = {"id": entity_id, "patient_id": patient.id, "assigned_facility_id": facility.id, "reason": "test"}

    first = client.post(
        "/api/referrals", json=body, headers={**actor_headers(worker), "Idempotency-Key": idem_key()}
    )
    assert first.status_code == 201

    second = client.post(
        "/api/referrals", json=body, headers={**actor_headers(worker), "Idempotency-Key": idem_key()}
    )
    assert second.status_code == 201
    assert second.json()["id"] == entity_id
    assert second.json()["status"] == "ASSIGNED"

    from app.models import Referral, ReferralEvent

    assert db_session.query(Referral).filter_by(id=entity_id).count() == 1
    events = db_session.query(ReferralEvent).filter_by(referral_id=entity_id).all()
    event_types = [e.event_type.value for e in events]
    assert event_types.count("REFERRAL_ASSIGNED") == 1
