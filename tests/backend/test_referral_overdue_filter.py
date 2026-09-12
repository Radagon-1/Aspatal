"""
Fix D: GET /api/referrals?overdue= -- reuses the exact same FollowUp
overdue semantic already implemented for GET /api/follow-ups/overdue.
Does not invent an ASSIGNED/CONFIRMED duration-based overdue concept,
since none exists in the persisted model or config.
"""
from datetime import datetime, timedelta

from conftest import actor_headers, idem_key


def _advance_to_consulted_with_followup(client, worker, facility_user, facility, patient, due_date):
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
    client.post(
        f"/api/referrals/{referral_id}/consult",
        json={"diagnosis_summary": "diag", "requires_followup": True},
        headers={**actor_headers(facility_user), "Idempotency-Key": idem_key()},
    )
    client.post(
        f"/api/referrals/{referral_id}/follow-up",
        json={"due_date": due_date},
        headers={**actor_headers(facility_user), "Idempotency-Key": idem_key()},
    )
    return referral_id


def test_overdue_true_returns_referral_with_overdue_followup(client, worker, facility_user, facility, patient):
    past_due = (datetime.utcnow() - timedelta(days=1)).isoformat()
    referral_id = _advance_to_consulted_with_followup(
        client, worker, facility_user, facility, patient, past_due
    )

    resp = client.get(
        "/api/referrals", params={"overdue": True}, headers=actor_headers(facility_user)
    )
    assert resp.status_code == 200
    ids = [r["id"] for r in resp.json()]
    assert referral_id in ids


def test_overdue_false_excludes_referral_with_overdue_followup(client, worker, facility_user, facility, patient):
    past_due = (datetime.utcnow() - timedelta(days=1)).isoformat()
    referral_id = _advance_to_consulted_with_followup(
        client, worker, facility_user, facility, patient, past_due
    )

    resp = client.get(
        "/api/referrals", params={"overdue": False}, headers=actor_headers(facility_user)
    )
    ids = [r["id"] for r in resp.json()]
    assert referral_id not in ids


def test_overdue_false_includes_referral_with_no_followup(client, worker, facility_user, facility, patient):
    referral_id = client.post(
        "/api/referrals",
        json={"patient_id": patient.id, "assigned_facility_id": facility.id, "reason": "test"},
        headers={**actor_headers(worker), "Idempotency-Key": idem_key()},
    ).json()["id"]

    resp = client.get(
        "/api/referrals", params={"overdue": False}, headers=actor_headers(facility_user)
    )
    ids = [r["id"] for r in resp.json()]
    assert referral_id in ids


def test_overdue_true_excludes_future_followup(client, worker, facility_user, facility, patient):
    future_due = (datetime.utcnow() + timedelta(days=7)).isoformat()
    referral_id = _advance_to_consulted_with_followup(
        client, worker, facility_user, facility, patient, future_due
    )

    resp = client.get(
        "/api/referrals", params={"overdue": True}, headers=actor_headers(facility_user)
    )
    ids = [r["id"] for r in resp.json()]
    assert referral_id not in ids


def test_existing_status_and_facility_filters_still_work(client, worker, facility, facility_user, patient):
    referral_id = client.post(
        "/api/referrals",
        json={"patient_id": patient.id, "assigned_facility_id": facility.id, "reason": "test"},
        headers={**actor_headers(worker), "Idempotency-Key": idem_key()},
    ).json()["id"]

    resp = client.get(
        "/api/referrals",
        params={"status": "ASSIGNED", "facility_id": facility.id},
        headers=actor_headers(facility_user),
    )
    assert resp.status_code == 200
    ids = [r["id"] for r in resp.json()]
    assert referral_id in ids
