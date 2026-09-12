import uuid

from sqlalchemy import CheckConstraint, Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship, validates

from app.db import Base, utcnow


class Patient(Base):
    __tablename__ = "patients"
    __table_args__ = (
        CheckConstraint(
            "date_of_birth IS NOT NULL OR approximate_age IS NOT NULL",
            name="ck_patients_dob_or_approx_age",
        ),
        CheckConstraint(
            "approximate_age IS NULL OR (approximate_age >= 0 AND approximate_age <= 130)",
            name="ck_patients_approx_age_range",
        ),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = Column(String(255), nullable=False)
    date_of_birth = Column(Date, nullable=True)
    approximate_age = Column(Integer, nullable=True)
    sex = Column(String(32), nullable=True)
    phone = Column(String(32), nullable=True)
    village = Column(String(255), nullable=True)
    registered_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    registered_at = Column(DateTime, nullable=False, default=utcnow)

    referrals = relationship("Referral", back_populates="patient")
    assessments = relationship("Assessment", back_populates="patient")

    @validates("approximate_age")
    def validate_approximate_age(self, key, value):
        # Immediate, clear Python-level error in addition to the DB
        # CheckConstraint above (which is the real enforcement and also
        # catches inserts that bypass the ORM).
        if value is not None and not (0 <= value <= 130):
            raise ValueError("approximate_age must be between 0 and 130")
        return value
