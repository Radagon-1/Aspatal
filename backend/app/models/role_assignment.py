import uuid

from sqlalchemy import CheckConstraint, Column, ForeignKey, String
from sqlalchemy.orm import relationship

from app.db import Base
from app.models.enums import UserRole, portable_enum


class RoleAssignment(Base):
    """
    Demo/deployment bootstrap data only: maps a known email address to the
    role (and facility, if applicable) it should receive on first login.
    Contains no password, token, or other secret -- just an email + role
    label, safe to seed from non-sensitive configuration.

    Consumed by a later phase's auth dependency: on a Firebase-verified
    login whose email has no existing User row, look this table up by email
    to auto-provision the new User's role/facility_id. Nothing in Phase 5
    reads this table at runtime -- it only needs to exist and be seedable.
    """
    __tablename__ = "role_assignments"
    __table_args__ = (
        # role == 'facility' <=> facility_id IS NOT NULL -- same biconditional
        # invariant as User, kept consistent across both tables.
        CheckConstraint(
            "(role = 'facility' AND facility_id IS NOT NULL) "
            "OR (role != 'facility' AND facility_id IS NULL)",
            name="ck_role_assignments_facility_role_requires_facility_id",
        ),
    )

    email = Column(String(255), primary_key=True)
    role = Column(portable_enum(UserRole, "ck_role_assignments_role"), nullable=False)
    facility_id = Column(String(36), ForeignKey("facilities.id"), nullable=True)

    facility = relationship("Facility", back_populates="role_assignments")
