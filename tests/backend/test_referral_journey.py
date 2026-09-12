"""
Tests 1-18: the full successful referral journey through the real HTTP
routers -- creation, every explicit action endpoint, events, and
timestamps. Phase 6.1 replaced the generic /transitions endpoint with
explicit per-action endpoints; these tests exercise those directly.
"""
from datetime import datetime, timedelta

from conftest import actor_headers, idem_key


def _create_patient(client, worker):
    resp = client.post(
        "/api/patients",
        json={"full_name": "Ramesh Kumar", "approximate_age": 45},
        headers={**actor_headers(worker), "Idempotency-Key": idem_key()},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _create_referral(client, worker, patient_id, facility_id, **extra):
    body = {
        "patient_id": patient_id,
        "assigned_facility_id": facility_id,
        "reason": "suspected fracture",
        **extra,
    }
    return client.post(
        "/api/referrals",
        json=body,
        headers={**actor_headers(worker), "Idempotency-Key": idem_key()},
    )


def _action(client, actor, referral_id, action, body=None):
    return client.post(
        f"/api/referrals/{referral_id}/{action}",
        json=body or {},
        headers={**actor_headers(actor), "Idempotency-Key": idem_key()},
    )


def _acknowledge(client, actor, referral_id):
    return _action(client, actor, referral_id, "acknowledge")


def _decline(client, actor, referral_id, reason="no capacity"):
    return _action(client, actor, referral_id, "decline", {"reason": reason})


def _arrive(client, actor, referral_id):
    return _action(client, actor, referral_id, "arrive")


def _close(client, actor, referral_id):
    return _action(client, actor, referral_id, "close")


def _consult(client, actor, referral_id, requires_followup, diagnosis="diag"):
    return client.post(
        f"/api/referrals/{referral_id}/consult",
        json={"diagnosis_summary": diagnosis, "requires_followup": requires_followup},
        headers={**actor_headers(actor), "Idempotency-Key": idem_key()},
    )


def _schedule_follow_up(client, actor, referral_id, due_date=None, instructions=None):
    due = due_date or (datetime.utcnow() + timedelta(days=7)).isoformat()
    body = {"due_date": due}
    if instructions is not None:
        body["instructions"] = instructions
    return client.post(
        f"/api/referrals/{referral_id}/follow-up",
        json=body,
        headers={**actor_headers(actor), "Idempotency-Key": idem_key()},
    )


def _complete_follow_up(client, actor, referral_id):
    return _action(client, actor, referral_id, "complete-follow-up")


# 1. create patient
def test_create_patient(client, worker):
    data = _create_patient(client, worker)
    assert data["full_name"] == "Ramesh Kumar"
    assert data["registered_by"] == worker.id


# 2, 3. create referral / starts in correct state
def test_create_referral_starts_assigned(client, worker, facility, patient):
    resp = _create_referral(client, worker, patient.id, facility.id)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["status"] == "ASSIGNED"
    assert data["patient_id"] == patient.id
    assert data["assigned_facility_id"] == facility.id
    assert data["created_by"] == worker.id


# 4. creation produces initial ReferralEvent
def test_referral_creation_produces_initial_event(client, worker, facility, patient):
    resp = _create_referral(client, worker, patient.id, facility.id)
    referral_id = resp.json()["id"]

    events_resp = client.get(f"/api/referrals/{referral_id}/events", headers=actor_headers(worker))
    assert events_resp.status_code == 200
    events = events_resp.json()
    assert len(events) == 1
    assert events[0]["event_type"] == "REFERRAL_ASSIGNED"
    assert events[0]["from_status"] is None
    assert events[0]["to_status"] == "ASSIGNED"
    assert events[0]["actor_user_id"] == worker.id


# 5. ASSIGNED -> CONFIRMED succeeds (acknowledge)
def test_acknowledge_succeeds(client, worker, facility_user, facility, patient):
    referral_id = _create_referral(client, worker, patient.id, facility.id).json()["id"]
    resp = _acknowledge(client, facility_user, referral_id)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "CONFIRMED"
    assert data["confirmed_at"] is not None


# 6. CONFIRMED -> ARRIVED succeeds (arrive)
def test_arrive_succeeds(client, worker, facility_user, facility, patient):
    referral_id = _create_referral(client, worker, patient.id, facility.id).json()["id"]
    _acknowledge(client, facility_user, referral_id)
    resp = _arrive(client, facility_user, referral_id)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "ARRIVED"
    assert data["arrived_at"] is not None


def _advance_to_arrived(client, worker, facility_user, facility, patient):
    referral_id = _create_referral(client, worker, patient.id, facility.id).json()["id"]
    _acknowledge(client, facility_user, referral_id)
    _arrive(client, facility_user, referral_id)
    return referral_id


# 7. ARRIVED -> CONSULTED succeeds (consult)
def test_consult_succeeds(client, worker, facility_user, facility, patient):
    referral_id = _advance_to_arrived(client, worker, facility_user, facility, patient)
    resp = _consult(client, facility_user, referral_id, True, diagnosis="Fracture confirmed")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "CONSULTED"
    assert data["consulted_at"] is not None


def _advance_to_consulted(client, worker, facility_user, facility, patient, requires_followup=True):
    referral_id = _advance_to_arrived(client, worker, facility_user, facility, patient)
    _consult(client, facility_user, referral_id, requires_followup)
    return referral_id


# 8. CONSULTED -> FOLLOW_UP succeeds (follow-up)
def test_schedule_follow_up_succeeds(client, worker, facility_user, facility, patient):
    referral_id = _advance_to_consulted(client, worker, facility_user, facility, patient, True)
    resp = _schedule_follow_up(client, facility_user, referral_id, instructions="Return in a week")
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "FOLLOW_UP"


# 9. FOLLOW_UP -> CLOSED succeeds (complete-follow-up)
def test_complete_follow_up_succeeds(client, worker, facility_user, facility, patient):
    referral_id = _advance_to_consulted(client, worker, facility_user, facility, patient, True)
    _schedule_follow_up(client, facility_user, referral_id)
    resp = _complete_follow_up(client, facility_user, referral_id)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "CLOSED"
    assert data["closure_reason"] == "completed"
    assert data["closed_at"] is not None


# 10. CONSULTED -> CLOSED succeeds where allowed (no follow-up required, via close)
def test_close_succeeds_when_no_followup_required(client, worker, facility_user, facility, patient):
    referral_id = _advance_to_consulted(client, worker, facility_user, facility, patient, False)
    resp = _close(client, facility_user, referral_id)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "CLOSED"
    assert data["closure_reason"] == "completed"


# 11. illegal skipped transition rejected
def test_skipped_transition_rejected(client, worker, facility_user, facility, patient):
    referral_id = _create_referral(client, worker, patient.id, facility.id).json()["id"]
    resp = _arrive(client, facility_user, referral_id)  # skips acknowledge/CONFIRMED
    assert resp.status_code == 409, resp.text


# 12. backwards transition rejected
def test_backwards_transition_rejected(client, worker, facility_user, facility, patient):
    referral_id = _create_referral(client, worker, patient.id, facility.id).json()["id"]
    _acknowledge(client, facility_user, referral_id)
    # No endpoint can move CONFIRMED back to ASSIGNED; exercised via close,
    # which requires CONSULTED and is rejected from CONFIRMED as a stand-in
    # backwards/invalid-state probe.
    resp = _close(client, facility_user, referral_id)
    assert resp.status_code == 409, resp.text


# 13. same-state transition rejected
def test_same_state_transition_rejected(client, worker, facility_user, facility, patient):
    referral_id = _create_referral(client, worker, patient.id, facility.id).json()["id"]
    resp = _acknowledge(client, facility_user, referral_id)
    assert resp.status_code == 200
    again = _acknowledge(client, facility_user, referral_id)
    assert again.status_code == 409, again.text


# 14. terminal-state transition rejected
def test_terminal_state_transition_rejected(client, worker, facility_user, facility, patient):
    referral_id = _create_referral(client, worker, patient.id, facility.id).json()["id"]
    decline = _decline(client, facility_user, referral_id)
    assert decline.status_code == 200, decline.text
    resp = _acknowledge(client, facility_user, referral_id)
    assert resp.status_code == 409, resp.text


# 15, 16. failed transition leaves status unchanged and appends no event
def test_failed_transition_leaves_status_and_events_unchanged(client, worker, facility_user, facility, patient):
    referral_id = _create_referral(client, worker, patient.id, facility.id).json()["id"]

    before = client.get(f"/api/referrals/{referral_id}", headers=actor_headers(worker)).json()
    before_events = client.get(
        f"/api/referrals/{referral_id}/events", headers=actor_headers(worker)
    ).json()

    resp = _arrive(client, facility_user, referral_id)  # illegal skip
    assert resp.status_code == 409

    after = client.get(f"/api/referrals/{referral_id}", headers=actor_headers(worker)).json()
    after_events = client.get(
        f"/api/referrals/{referral_id}/events", headers=actor_headers(worker)
    ).json()

    assert after["status"] == before["status"] == "ASSIGNED"
    assert len(after_events) == len(before_events) == 1


# 17. successful transition appends exactly one event
def test_successful_transition_appends_exactly_one_event(client, worker, facility_user, facility, patient):
    referral_id = _create_referral(client, worker, patient.id, facility.id).json()["id"]
    _acknowledge(client, facility_user, referral_id)

    events = client.get(f"/api/referrals/{referral_id}/events", headers=actor_headers(worker)).json()
    assert len(events) == 2  # REFERRAL_ASSIGNED + REFERRAL_CONFIRMED
    assert events[-1]["event_type"] == "REFERRAL_CONFIRMED"


# 18. timestamps populate correctly
def test_timestamps_populate_correctly(client, worker, facility_user, facility, patient):
    referral_id = _create_referral(client, worker, patient.id, facility.id).json()["id"]
    r1 = _acknowledge(client, facility_user, referral_id).json()
    assert r1["confirmed_at"] is not None
    assert r1["arrived_at"] is None

    r2 = _arrive(client, facility_user, referral_id).json()
    assert r2["arrived_at"] is not None
