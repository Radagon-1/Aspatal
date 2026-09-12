"""
Pre-Phase-6 hardening: role == 'facility' <=> facility_id IS NOT NULL must
hold as a true biconditional on both `users` and `role_assignments`, not
just the one-way "facility role requires facility_id" direction.
"""
import uuid

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Facility, RoleAssignment, User, UserRole


def make_facility(db):
    f = Facility(name=f"Facility {uuid.uuid4()}", type="PHC")
    db.add(f)
    db.commit()
    return f


# --- User -------------------------------------------------------------

def test_user_facility_role_with_facility_id_passes(db_session):
    facility = make_facility(db_session)
    db_session.add(
        User(
            firebase_uid=f"uid-{uuid.uuid4()}",
            email="f@example.com",
            role=UserRole.FACILITY,
            facility_id=facility.id,
        )
    )
    db_session.commit()  # should not raise


def test_user_facility_role_with_null_facility_id_fails(db_session):
    db_session.add(
        User(
            firebase_uid=f"uid-{uuid.uuid4()}",
            email="f2@example.com",
            role=UserRole.FACILITY,
            facility_id=None,
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_user_worker_role_with_null_facility_id_passes(db_session):
    db_session.add(
        User(
            firebase_uid=f"uid-{uuid.uuid4()}",
            email="w@example.com",
            role=UserRole.WORKER,
            facility_id=None,
        )
    )
    db_session.commit()  # should not raise


def test_user_worker_role_with_facility_id_fails(db_session):
    facility = make_facility(db_session)
    db_session.add(
        User(
            firebase_uid=f"uid-{uuid.uuid4()}",
            email="w2@example.com",
            role=UserRole.WORKER,
            facility_id=facility.id,
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# --- RoleAssignment -----------------------------------------------------

def test_role_assignment_facility_role_with_facility_id_passes(db_session):
    facility = make_facility(db_session)
    db_session.add(
        RoleAssignment(email="ra-f@example.com", role=UserRole.FACILITY, facility_id=facility.id)
    )
    db_session.commit()  # should not raise


def test_role_assignment_facility_role_with_null_facility_id_fails(db_session):
    db_session.add(RoleAssignment(email="ra-f2@example.com", role=UserRole.FACILITY, facility_id=None))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_role_assignment_worker_role_with_null_facility_id_passes(db_session):
    db_session.add(RoleAssignment(email="ra-w@example.com", role=UserRole.WORKER, facility_id=None))
    db_session.commit()  # should not raise


def test_role_assignment_worker_role_with_facility_id_fails(db_session):
    facility = make_facility(db_session)
    db_session.add(
        RoleAssignment(email="ra-w2@example.com", role=UserRole.WORKER, facility_id=facility.id)
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
