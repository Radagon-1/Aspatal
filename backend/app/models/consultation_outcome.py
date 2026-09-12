import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.db import Base, utcnow


class ConsultationOutcome(Base):
    __tablename__ = "consultation_outcomes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # unique=True enforces max 1 ConsultationOutcome per Referral.
    referral_id = Column(String(36), ForeignKey("referrals.id"), unique=True, nullable=False)
    recorded_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    diagnosis_summary = Column(Text, nullable=False)
    treatment_given = Column(Text, nullable=True)
    medicines = Column(Text, nullable=True)
    diagnostics_ordered = Column(Text, nullable=True)
    requires_followup = Column(Boolean, nullable=False)
    created_at = Column(DateTime, nullable=False, default=utcnow)

    referral = relationship("Referral", back_populates="consultation_outcome")
