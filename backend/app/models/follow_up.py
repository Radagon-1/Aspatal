import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.db import Base
from app.models.enums import FollowUpStatus, portable_enum


class FollowUp(Base):
    __tablename__ = "follow_ups"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # unique=True enforces max 1 FollowUp per Referral.
    referral_id = Column(String(36), ForeignKey("referrals.id"), unique=True, nullable=False)
    due_date = Column(DateTime, nullable=False)
    instructions = Column(Text, nullable=True)
    status = Column(
        portable_enum(FollowUpStatus, "ck_follow_ups_status"),
        nullable=False,
        default=FollowUpStatus.PENDING,
    )
    completed_at = Column(DateTime, nullable=True)
    completed_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    referral = relationship("Referral", back_populates="follow_up")
