import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.db import Base, utcnow
from app.models.enums import ReferralEventType, ReferralStatus, portable_enum


class ReferralEvent(Base):
    """
    Append-only audit trail (one row per referral action). Enforced at the
    service layer in a later phase -- no client-facing mutation API exists
    or is planned for this table.
    """
    __tablename__ = "referral_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    referral_id = Column(String(36), ForeignKey("referrals.id"), nullable=False)
    event_type = Column(
        portable_enum(ReferralEventType, "ck_referral_events_event_type"),
        nullable=False,
    )
    from_status = Column(
        portable_enum(ReferralStatus, "ck_referral_events_from_status"), nullable=True
    )
    to_status = Column(
        portable_enum(ReferralStatus, "ck_referral_events_to_status"), nullable=False
    )
    actor_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    actor_role = Column(String(32), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)

    referral = relationship("Referral", back_populates="events")
