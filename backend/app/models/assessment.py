import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.db import Base, utcnow
from app.models.enums import AssessmentRecommendation, portable_enum


class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String(36), ForeignKey("patients.id"), nullable=False)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    chief_complaint = Column(Text, nullable=False)
    notes = Column(Text, nullable=True)
    recommendation = Column(
        portable_enum(AssessmentRecommendation, "ck_assessments_recommendation"),
        nullable=False,
    )
    created_at = Column(DateTime, nullable=False, default=utcnow)

    patient = relationship("Patient", back_populates="assessments")
    referral = relationship("Referral", back_populates="assessment", uselist=False)
