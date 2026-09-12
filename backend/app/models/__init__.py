"""
Importing this package registers every model on app.db.Base.metadata --
required by both Alembic autogenerate and any create_all() call (e.g. in
tests). Import app.models (not individual model modules) wherever the full
schema needs to be known.
"""
from app.models.enums import (
    AssessmentRecommendation,
    FollowUpStatus,
    ReferralEventType,
    ReferralStatus,
    UserRole,
)
from app.models.facility import Facility, FacilityService
from app.models.user import User
from app.models.role_assignment import RoleAssignment
from app.models.patient import Patient
from app.models.assessment import Assessment
from app.models.referral import Referral
from app.models.referral_event import ReferralEvent
from app.models.consultation_outcome import ConsultationOutcome
from app.models.follow_up import FollowUp
from app.models.processed_operation import ProcessedOperation

__all__ = [
    "UserRole",
    "ReferralStatus",
    "AssessmentRecommendation",
    "FollowUpStatus",
    "ReferralEventType",
    "Facility",
    "FacilityService",
    "User",
    "RoleAssignment",
    "Patient",
    "Assessment",
    "Referral",
    "ReferralEvent",
    "ConsultationOutcome",
    "FollowUp",
    "ProcessedOperation",
]
