import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.db import Base, utcnow
from app.models.enums import ReferralStatus, portable_enum


class Referral(Base):
    """
    No FK in this model (or anywhere in this schema) is declared with
    ondelete="CASCADE" -- deleting a Patient/Facility/Referral is not
    supported by this schema. There are no deletion endpoints planned for
    the MVP; a real care record should not be silently cascade-deleted, so
    the conservative default (no cascade) is deliberate, not an oversight.
    """
    __tablename__ = "referrals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String(36), ForeignKey("patients.id"), nullable=False)
    assessment_id = Column(String(36), ForeignKey("assessments.id"), nullable=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    assigned_facility_id = Column(String(36), ForeignKey("facilities.id"), nullable=False)
    required_service = Column(String(128), nullable=True)
    reason = Column(Text, nullable=False)
    status = Column(
        portable_enum(ReferralStatus, "ck_referrals_status"),
        nullable=False,
        default=ReferralStatus.ASSIGNED,
    )
    closure_reason = Column(String(64), nullable=True)
    referred_from_referral_id = Column(String(36), ForeignKey("referrals.id"), nullable=True)

    created_at = Column(DateTime, nullable=False, default=utcnow)
    confirmed_at = Column(DateTime, nullable=True)
    arrived_at = Column(DateTime, nullable=True)
    consulted_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)

    patient = relationship("Patient", back_populates="referrals")
    assessment = relationship("Assessment", back_populates="referral")
    assigned_facility = relationship("Facility", back_populates="referrals")
    referred_from = relationship(
        "Referral", remote_side=[id], backref="re_referrals"
    )

    events = relationship(
        "ReferralEvent", back_populates="referral", order_by="ReferralEvent.created_at"
    )
    consultation_outcome = relationship(
        "ConsultationOutcome", back_populates="referral", uselist=False
    )
    follow_up = relationship("FollowUp", back_populates="referral", uselist=False)
