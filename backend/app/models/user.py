import uuid

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship

from app.db import Base, utcnow
from app.models.enums import UserRole, portable_enum


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        # role == 'facility' <=> facility_id IS NOT NULL (a true biconditional,
        # not just the one-way "facility implies facility_id" check). A
        # CheckConstraint (not a trigger) is the simplest portable way to
        # enforce two columns together atomically at commit time -- an
        # ORM-level @validates would be order-dependent (fields are set one
        # at a time) and easy to get wrong.
        CheckConstraint(
            "(role = 'facility' AND facility_id IS NOT NULL) "
            "OR (role != 'facility' AND facility_id IS NULL)",
            name="ck_users_facility_role_requires_facility_id",
        ),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    firebase_uid = Column(String(128), unique=True, nullable=False, index=True)
    display_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=False)
    role = Column(
        portable_enum(UserRole, "ck_users_role"),
        nullable=False,
        default=UserRole.UNASSIGNED,
    )
    facility_id = Column(String(36), ForeignKey("facilities.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)

    facility = relationship("Facility", back_populates="users")
