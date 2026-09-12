"""
Tests 24-27 (Phase 6) + Phase 6.1 §5/§8 invariant tests (9, 10, 11 from the
Phase 6.1 test list): consultation outcome uniqueness, follow-up linkage,
overdue determination, and the central "no patient lost between referral
and follow-up" closure invariant.
"""
from datetime import datetime, timedelta

from conftest import actor_headers, idem_key


def _advance_to_arrived(client, worker, facility_user, facility, patient):
    referral_id = client.post(
        "/api/referrals",
        json={"patient_id": patient.id, "assigned_facility_id": facility.id, "reason": "test"},
        headers={**actor_headers(worker), "Idempotency-Key": idem_key()},
    ).json()["id"]
    client.post(
        f"/api/referrals/{referral_id}/acknowledge",
        json={},
        headers={**actor_headers(facility_user), "Idempotency-Key": idem_key()},
    )
    client.post(
        f"/api/referrals/{referral_id}/arrive",
        json={},
        headers={**actor_headers(facility_user), "Idempotency-Key": idem_key()},
    )
    return referral_id


def _consult(client, facility_user, referral_id, requires_followup):
    return client.post(
        f"/api/referrals/{referral_id}/consult",
        json={"diagnosis_summary": "diag", "requires_followup": requires_followup},
        headers={**actor_headers(facility_user), "Idempotency-Key": idem_key()},
    )


def _schedule_follow_up(client, facility_user, referral_id, due_date):
    return client.post(
        f"/api/referrals/{referral_id}/follow-up",
        json={"due_date": due_date},
        headers={**actor_headers(facility_user), "Idempotency-Key": idem_key()},
    )


def _close(client, facility_user, referral_id):
    return client.post(
        f"/api/referrals/{referral_id}/close",
        json={},
        headers={**actor_headers(facility_user), "Idempotency-Key": idem_key()},
    )


def _complete_follow_up(client, facility_user, referral_id):
    return client.post(
        f"/api/referrals/{referral_id}/complete-follow-up",
        json={},
        headers={**actor_headers(facility_user), "Idempotency-Key": idem_key()},
    )


# 24. duplicate consultation outcome rejected
def test_duplicate_consultation_outcome_rejected(client, worker, facility_user, facility, patient):
    referral_id = _advance_to_arrived(client, worker, facility_user, facility, patient)

    first = _consult(client, facility_user, referral_id, False)
    assert first.status_code == 200

    second = _consult(client, facility_user, referral_id, False)
    assert second.status_code == 409, second.text


# 25. follow-up remains linked to referral
def test_follow_up_remains_linked_to_referral(client, worker, facility_user, facility, patient, db_session):
    referral_id = _advance_to_arrived(client, worker, facility_user, facility, patient)
    _consult(client, facility_user, referral_id, True)
    due = (datetime.utcnow() + timedelta(days=3)).isoformat()
    _schedule_follow_up(client, facility_user, referral_id, due)

    from app.models import FollowUp, Referral

    referral = db_session.get(Referral, referral_id)
    follow_up = db_session.query(FollowUp).filter_by(referral_id=referral_id).one()
    assert follow_up.referral_id == referral.id
    assert referral.follow_up.id == follow_up.id


# 26. overdue query returns genuinely overdue incomplete follow-up
def test_overdue_query_returns_overdue_pending_follow_up(client, worker, facility_user, facility, patient):
    referral_id = _advance_to_arrived(client, worker, facility_user, facility, patient)
    _consult(client, facility_user, referral_id, True)
    past_due = (datetime.utcnow() - timedelta(days=1)).isoformat()
    _schedule_follow_up(client, facility_user, referral_id, past_due)

    resp = client.get("/api/follow-ups/overdue", headers=actor_headers(facility_user))
    assert resp.status_code == 200
    overdue = resp.json()
    assert any(f["referral_id"] == referral_id for f in overdue)


# 27. completed follow-up is not overdue
def test_completed_follow_up_is_not_overdue(client, worker, facility_user, facility, patient):
    referral_id = _advance_to_arrived(client, worker, facility_user, facility, patient)
    _consult(client, facility_user, referral_id, True)
    past_due = (datetime.utcnow() - timedelta(days=1)).isoformat()
    _schedule_follow_up(client, facility_user, referral_id, past_due)

    close_resp = _complete_follow_up(client, facility_user, referral_id)
    assert close_resp.status_code == 200, close_resp.text

    resp = client.get("/api/follow-ups/overdue", headers=actor_headers(facility_user))
    overdue_referral_ids = [f["referral_id"] for f in resp.json()]
    assert referral_id not in overdue_referral_ids


# Phase 6.1 §5/§8: close without required follow-up succeeds
def test_close_succeeds_when_followup_not_required(client, worker, facility_user, facility, patient):
    referral_id = _advance_to_arrived(client, worker, facility_user, facility, patient)
    _consult(client, facility_user, referral_id, False)

    resp = _close(client, facility_user, referral_id)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "CLOSED"


# Phase 6.1 §5/§8: direct close REJECTED when follow-up is required --
# central invariant "no patient lost between referral and follow-up". Also
# confirms the reject did not partially apply (status stays CONSULTED).
def test_direct_close_rejected_when_followup_required(
    client, worker, facility_user, facility, patient, db_session
):
    referral_id = _advance_to_arrived(client, worker, facility_user, facility, patient)
    _consult(client, facility_user, referral_id, True)

    resp = _close(client, facility_user, referral_id)
    assert resp.status_code == 409, resp.text

    from app.models import Referral

    referral = db_session.get(Referral, referral_id)
    assert referral.status.value == "CONSULTED"
