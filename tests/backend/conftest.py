"""
Shared pytest fixtures for backend persistence tests.

These tests never touch the team's real backend/app.db, never call Groq/
Gradio/Firebase, and never hit the network -- every test gets its own
disposable SQLite file that's created fresh and deleted afterward.
"""
import os
import sys
import tempfile
import uuid
from pathlib import Path

import pytest

# backend/ isn't a normally-installed package -- put it on sys.path so
# `import app...` resolves the same way it does when running the app itself.
BACKEND_DIR = Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Ensure app.config's DATABASE_URL default doesn't matter here -- every
# fixture below builds its own explicit engine anyway.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import app.models  # noqa: E402,F401  (registers every table on Base.metadata)
from app.db import Base  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402


@pytest.fixture()
def db_session():
    """A fresh, empty, disposable SQLite-file-backed database per test."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    engine = create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()
        Path(path).unlink(missing_ok=True)


@pytest.fixture()
def client(db_session):
    """
    A FastAPI TestClient wired to the SAME disposable session as db_session,
    via a get_db dependency override -- so a test can set up fixture rows
    directly through the ORM and then exercise the real HTTP routers
    against that exact data.
    """
    from fastapi.testclient import TestClient

    from app.db import get_db
    from app.main import app

    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _make_user(db, role, facility_id=None, email=None):
    from app.models import User

    user = User(
        firebase_uid=f"uid-{uuid.uuid4()}",
        email=email or f"{role.value}@example.com",
        role=role,
        facility_id=facility_id,
    )
    db.add(user)
    db.commit()
    return user


def _make_facility(db, name=None, services=None):
    from app.models import Facility, FacilityService

    facility = Facility(name=name or f"Facility {uuid.uuid4()}", type="PHC", active=True)
    db.add(facility)
    db.flush()
    for service_name in services or []:
        db.add(FacilityService(facility_id=facility.id, service_name=service_name, available=True))
    db.commit()
    return facility


@pytest.fixture()
def worker(db_session):
    from app.models.enums import UserRole

    return _make_user(db_session, UserRole.WORKER)


@pytest.fixture()
def admin(db_session):
    from app.models.enums import UserRole

    return _make_user(db_session, UserRole.ADMIN)


@pytest.fixture()
def unassigned(db_session):
    from app.models.enums import UserRole

    return _make_user(db_session, UserRole.UNASSIGNED)


@pytest.fixture()
def facility(db_session):
    return _make_facility(db_session, name="Home Facility", services=["General OPD", "X-Ray"])


@pytest.fixture()
def other_facility(db_session):
    return _make_facility(db_session, name="Other Facility", services=["General OPD"])


@pytest.fixture()
def facility_user(db_session, facility):
    from app.models.enums import UserRole

    return _make_user(db_session, UserRole.FACILITY, facility_id=facility.id)


@pytest.fixture()
def other_facility_user(db_session, other_facility):
    from app.models.enums import UserRole

    return _make_user(db_session, UserRole.FACILITY, facility_id=other_facility.id)


@pytest.fixture()
def patient(db_session, worker):
    from app.models import Patient

    p = Patient(full_name="Test Patient", approximate_age=30, registered_by=worker.id)
    db_session.add(p)
    db_session.commit()
    return p


def actor_headers(user) -> dict:
    return {"X-Actor-User-Id": user.id}


def idem_key() -> str:
    return str(uuid.uuid4())
