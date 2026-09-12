"""
Tests 14, 16-18: seed-script idempotency (facilities/services and role
assignments) and RoleAssignment-specific constraints.
"""
import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Facility, FacilityService, RoleAssignment, UserRole
from app.seed import seed_facilities, seed_role_assignments


# 14. seed script can run twice without duplicates (facilities/services)
def test_seed_facilities_idempotent(db_session):
    created_first = seed_facilities(db_session)
    assert len(created_first) == 3  # PHC, CHC, District Hospital
    facility_count = db_session.query(Facility).count()
    service_count = db_session.query(FacilityService).count()
    assert facility_count == 3
    assert service_count > 0

    created_second = seed_facilities(db_session)
    assert created_second == []
    assert db_session.query(Facility).count() == facility_count
    assert db_session.query(FacilityService).count() == service_count


# 16. role assignment uniqueness works
def test_role_assignment_email_uniqueness(db_session):
    db_session.add(RoleAssignment(email="dup@example.com", role=UserRole.WORKER))
    db_session.commit()

    db_session.add(RoleAssignment(email="dup@example.com", role=UserRole.ADMIN))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# 17. facility role assignment may reference a facility
def test_role_assignment_seed_wires_facility_email_to_a_facility(db_session, monkeypatch):
    monkeypatch.setenv("DEMO_WORKER_EMAIL", "demo-worker@example.com")
    monkeypatch.setenv("DEMO_FACILITY_EMAIL", "demo-facility@example.com")
    monkeypatch.setenv("DEMO_ADMIN_EMAIL", "demo-admin@example.com")

    seed_facilities(db_session)  # facility role needs a facility to exist first
    created = seed_role_assignments(db_session)
    assert set(created) == {
        "demo-worker@example.com",
        "demo-facility@example.com",
        "demo-admin@example.com",
    }

    facility_row = db_session.query(RoleAssignment).filter_by(email="demo-facility@example.com").first()
    assert facility_row.role == UserRole.FACILITY
    assert facility_row.facility_id is not None

    worker_row = db_session.query(RoleAssignment).filter_by(email="demo-worker@example.com").first()
    assert worker_row.facility_id is None

    admin_row = db_session.query(RoleAssignment).filter_by(email="demo-admin@example.com").first()
    assert admin_row.facility_id is None


# 18. role assignment seed is idempotent
def test_role_assignment_seed_idempotent(db_session, monkeypatch):
    monkeypatch.setenv("DEMO_WORKER_EMAIL", "demo-worker@example.com")
    seed_facilities(db_session)

    first = seed_role_assignments(db_session)
    assert first == ["demo-worker@example.com"]

    second = seed_role_assignments(db_session)
    assert second == []
    assert db_session.query(RoleAssignment).count() == 1


def test_seed_role_assignments_skips_when_no_env_configured(db_session, monkeypatch):
    monkeypatch.delenv("DEMO_WORKER_EMAIL", raising=False)
    monkeypatch.delenv("DEMO_FACILITY_EMAIL", raising=False)
    monkeypatch.delenv("DEMO_ADMIN_EMAIL", raising=False)

    seed_facilities(db_session)
    created = seed_role_assignments(db_session)
    assert created == []
    assert db_session.query(RoleAssignment).count() == 0
