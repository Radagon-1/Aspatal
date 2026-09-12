"""
Tests 3-13, 15: model-level validation, DB constraints, and relationship
loading. Does not test referral state-transition logic -- that's out of
scope for Phase 5.
"""
import uuid
from datetime import date, datetime, timedelta

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import (
    ConsultationOutcome,
    Facility,
    FacilityService,
    FollowUp,
    Patient,
    ProcessedOperation,
    Referral,
    ReferralEvent,
    ReferralEventType,
    ReferralStatus,
    User,
    UserRole,
)


def make_user(db, role=UserRole.WORKER, facility_id=None):
    u = User(
        firebase_uid=f"uid-{uuid.uuid4()}",
        email="user@example.com",
        role=role,
        facility_id=facility_id,
    )
    db.add(u)
    db.commit()
    return u


def make_facility(db, name=None):
    f = Facility(name=name or f"Facility {uuid.uuid4()}", type="PHC")
    db.add(f)
    db.commit()
    return f


def make_referral(db, worker=None, facility=None):
    worker = worker or make_user(db)
    facility = facility or make_facility(db)
    patient = Patient(full_name="Test Patient", approximate_age=30, registered_by=worker.id)
    db.add(patient)
    db.commit()
    referral = Referral(
        patient_id=patient.id,
        created_by=worker.id,
        assigned_facility_id=facility.id,
        reason="test referral",
    )
    db.add(referral)
    db.commit()
    return referral, worker, facility, patient


# 3. Patient with date_of_birth succeeds
def test_patient_with_dob_succeeds(db_session):
    worker = make_user(db_session)
    p = Patient(full_name="Has DOB", date_of_birth=date(1990, 1, 1), registered_by=worker.id)
    db_session.add(p)
    db_session.commit()
    assert p.id is not None


# 4. Patient with approximate_age succeeds
def test_patient_with_approximate_age_succeeds(db_session):
    worker = make_user(db_session)
    p = Patient(full_name="Has Approx Age", approximate_age=45, registered_by=worker.id)
    db_session.add(p)
    db_session.commit()
    assert p.id is not None


# 5. Patient with neither DOB nor approximate_age fails
def test_patient_with_neither_dob_nor_age_fails(db_session):
    worker = make_user(db_session)
    p = Patient(full_name="Neither", registered_by=worker.id)
    db_session.add(p)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# 6. approximate_age < 0 fails
def test_patient_approximate_age_below_zero_fails(db_session):
    with pytest.raises(ValueError):
        Patient(full_name="Negative Age", approximate_age=-1, registered_by="irrelevant")


# 7. approximate_age > 130 fails
def test_patient_approximate_age_above_130_fails(db_session):
    with pytest.raises(ValueError):
        Patient(full_name="Too Old", approximate_age=131, registered_by="irrelevant")


# 8. duplicate firebase_uid fails
def test_duplicate_firebase_uid_fails(db_session):
    db_session.add(User(firebase_uid="dup-uid", email="a@example.com", role=UserRole.WORKER))
    db_session.commit()
    db_session.add(User(firebase_uid="dup-uid", email="b@example.com", role=UserRole.WORKER))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# 9. duplicate facility service for same facility fails
def test_duplicate_facility_service_fails(db_session):
    facility = make_facility(db_session)
    db_session.add(FacilityService(facility_id=facility.id, service_name="X-Ray", available=True))
    db_session.commit()
    db_session.add(FacilityService(facility_id=facility.id, service_name="X-Ray", available=True))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# 10. ConsultationOutcome one-per-referral constraint
def test_consultation_outcome_one_per_referral(db_session):
    referral, worker, facility, patient = make_referral(db_session)
    db_session.add(
        ConsultationOutcome(
            referral_id=referral.id,
            recorded_by=worker.id,
            diagnosis_summary="first",
            requires_followup=False,
        )
    )
    db_session.commit()

    db_session.add(
        ConsultationOutcome(
            referral_id=referral.id,
            recorded_by=worker.id,
            diagnosis_summary="second",
            requires_followup=False,
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# 11. FollowUp one-per-referral constraint
def test_follow_up_one_per_referral(db_session):
    referral, worker, facility, patient = make_referral(db_session)
    due = datetime.utcnow() + timedelta(days=7)
    db_session.add(FollowUp(referral_id=referral.id, due_date=due))
    db_session.commit()

    db_session.add(FollowUp(referral_id=referral.id, due_date=due))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# 12. Referral self-reference can represent a re-referral
def test_referral_self_reference_re_referral(db_session):
    referral1, worker, facility, patient = make_referral(db_session)

    referral2 = Referral(
        patient_id=patient.id,
        created_by=worker.id,
        assigned_facility_id=facility.id,
        reason="second attempt after decline",
        referred_from_referral_id=referral1.id,
    )
    db_session.add(referral2)
    db_session.commit()

    assert referral2.referred_from.id == referral1.id
    assert referral1.re_referrals[0].id == referral2.id


# 13. ProcessedOperation operation_id uniqueness
def test_processed_operation_uniqueness(db_session):
    op_id = str(uuid.uuid4())
    db_session.add(
        ProcessedOperation(
            operation_id=op_id, endpoint="/referrals", response_status=201, response_body="{}"
        )
    )
    db_session.commit()

    db_session.add(
        ProcessedOperation(
            operation_id=op_id, endpoint="/referrals", response_status=201, response_body="{}"
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# 15. relationships load correctly
def test_relationships_load_correctly(db_session):
    referral, worker, facility, patient = make_referral(db_session)

    event = ReferralEvent(
        referral_id=referral.id,
        event_type=ReferralEventType.REFERRAL_ASSIGNED,
        to_status=ReferralStatus.ASSIGNED,
        actor_user_id=worker.id,
        actor_role=UserRole.WORKER.value,
    )
    db_session.add(event)

    outcome = ConsultationOutcome(
        referral_id=referral.id,
        recorded_by=worker.id,
        diagnosis_summary="fine",
        requires_followup=True,
    )
    db_session.add(outcome)

    follow_up = FollowUp(referral_id=referral.id, due_date=datetime.utcnow() + timedelta(days=3))
    db_session.add(follow_up)
    db_session.commit()

    db_session.expire_all()

    # Patient -> Referral -> Events
    reloaded_patient = db_session.get(Patient, patient.id)
    assert len(reloaded_patient.referrals) == 1
    reloaded_referral = reloaded_patient.referrals[0]
    assert len(reloaded_referral.events) == 1
    assert reloaded_referral.events[0].event_type == ReferralEventType.REFERRAL_ASSIGNED

    # Referral -> ConsultationOutcome
    assert reloaded_referral.consultation_outcome.diagnosis_summary == "fine"

    # Referral -> FollowUp
    assert reloaded_referral.follow_up is not None
    assert reloaded_referral.follow_up.status.value == "pending"
