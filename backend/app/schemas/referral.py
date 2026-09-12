from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ReferralEventType, ReferralStatus


class ReferralCreate(BaseModel):
    id: Optional[str] = None  # client-generated UUID, for offline-safe creation
    patient_id: str
    assessment_id: Optional[str] = None
    assigned_facility_id: str
    required_service: Optional[str] = None
    reason: str = Field(..., min_length=1)
    referred_from_referral_id: Optional[str] = None


class ReferralOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    patient_id: str
    assessment_id: Optional[str] = None
    created_by: str
    assigned_facility_id: str
    required_service: Optional[str] = None
    reason: str
    status: ReferralStatus
    closure_reason: Optional[str] = None
    referred_from_referral_id: Optional[str] = None
    created_at: datetime
    confirmed_at: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    consulted_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None


class ReferralEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    referral_id: str
    event_type: ReferralEventType
    from_status: Optional[ReferralStatus] = None
    to_status: ReferralStatus
    actor_user_id: str
    actor_role: str
    notes: Optional[str] = None
    created_at: datetime


class ReasonPayload(BaseModel):
    """Shared optional/required-by-service free-text payload for the
    explicit action endpoints that carry a reason or closing note (decline,
    cancel, no-show, complete-follow-up). Whether the reason is actually
    required is enforced by the workflow service per-transition, not here,
    since the same shape serves both required- and optional-reason
    actions."""

    reason: Optional[str] = None
