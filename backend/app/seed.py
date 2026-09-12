"""
Deterministic, idempotent demo/domain seed data.

Usage (after `alembic upgrade head` has already created the schema):
    python -m app.seed

Seeds:
- Facilities + FacilityServices: always, unconditionally. Non-sensitive
  demo/domain data (facility names/types/services), safe to commit.
- RoleAssignment rows: only for whichever of DEMO_WORKER_EMAIL /
  DEMO_FACILITY_EMAIL / DEMO_ADMIN_EMAIL are actually set in the
  environment (backend/.env, uncommitted). No real email address is
  hardcoded in this file -- leaving all three unset simply skips
  role-assignment seeding.

Safe to run multiple times: every insert is preceded by an existence check
keyed on a natural identifier (facility name, facility_id+service_name, or
email) rather than a blind insert.
"""
import os

from app.db import SessionLocal
from app.models import Facility, FacilityService, RoleAssignment, UserRole

FACILITIES = [
    {
        "name": "Village Primary Health Centre",
        "type": "PHC",
        "location": "Demo Village",
        "services": ["General OPD", "Maternity"],
    },
    {
        "name": "Block Community Health Centre",
        "type": "CHC",
        "location": "Demo Block",
        "services": ["General OPD", "X-Ray", "Emergency"],
    },
    {
        "name": "District Hospital",
        "type": "District Hospital",
        "location": "Demo District HQ",
        "services": ["General OPD", "X-Ray", "Emergency", "Diagnostics", "Maternity"],
    },
]


def seed_facilities(db) -> list[str]:
    created = []
    for entry in FACILITIES:
        facility = db.query(Facility).filter_by(name=entry["name"]).first()
        if facility is None:
            facility = Facility(
                name=entry["name"],
                type=entry["type"],
                location=entry["location"],
                active=True,
            )
            db.add(facility)
            db.flush()  # assign facility.id before attaching services below
            created.append(facility.name)

        for service_name in entry["services"]:
            exists = (
                db.query(FacilityService)
                .filter_by(facility_id=facility.id, service_name=service_name)
                .first()
            )
            if exists is None:
                db.add(
                    FacilityService(
                        facility_id=facility.id,
                        service_name=service_name,
                        available=True,
                    )
                )

    db.commit()
    return created


def seed_role_assignments(db) -> list[str]:
    mapping = [
        (os.getenv("DEMO_WORKER_EMAIL"), UserRole.WORKER, False),
        (os.getenv("DEMO_FACILITY_EMAIL"), UserRole.FACILITY, True),
        (os.getenv("DEMO_ADMIN_EMAIL"), UserRole.ADMIN, False),
    ]

    # The facility role requires a facility_id. Deterministic choice: the
    # first seeded facility (alphabetical), i.e. Block Community Health
    # Centre. Arbitrary but stable -- adjust here if the team's demo script
    # wants the demo facility account attached elsewhere.
    demo_facility = db.query(Facility).order_by(Facility.name).first()

    created = []
    for email, role, needs_facility in mapping:
        if not email:
            continue
        normalized_email = email.strip().lower()
        existing = db.query(RoleAssignment).filter_by(email=normalized_email).first()
        if existing is not None:
            continue
        facility_id = demo_facility.id if (needs_facility and demo_facility) else None
        db.add(RoleAssignment(email=normalized_email, role=role, facility_id=facility_id))
        created.append(normalized_email)

    db.commit()
    return created


def run():
    db = SessionLocal()
    try:
        created_facilities = seed_facilities(db)
        created_roles = seed_role_assignments(db)
        print(f"Facilities newly created: {created_facilities or 'none (already seeded)'}")
        print(
            "Role assignments newly created: "
            f"{created_roles or 'none (no DEMO_*_EMAIL configured, or already seeded)'}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    run()
