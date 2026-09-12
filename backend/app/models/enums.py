"""
Domain enums, centralized here instead of scattering magic strings across
models. Every enum is a str-Enum so its members compare/serialize naturally
as their .value string.

Persistence note: SQLAlchemy's Enum type, given a Python Enum class, binds
and stores each member's NAME by default (e.g. "WORKER"), not its .value
(e.g. "worker") -- easy to miss. portable_enum() below always passes
values_callable so the DATABASE and the generated CHECK constraint use
.value, matching the frozen contract's persisted/API-facing representation
exactly (lowercase for UserRole/AssessmentRecommendation/FollowUpStatus,
uppercase for ReferralStatus/ReferralEventType, as defined below).
"""
import enum

from sqlalchemy import Enum as SAEnum


def portable_enum(enum_cls: type[enum.Enum], name: str) -> SAEnum:
    """A SQLAlchemy Enum column type that is identical on SQLite and
    Postgres (VARCHAR + a named CHECK constraint, no native DB enum type),
    and persists/validates against each member's .value, not its Python
    name."""
    return SAEnum(
        enum_cls,
        name=name,
        native_enum=False,
        create_constraint=True,
        validate_strings=True,
        values_callable=lambda cls: [member.value for member in cls],
    )


class UserRole(str, enum.Enum):
    UNASSIGNED = "unassigned"
    WORKER = "worker"
    FACILITY = "facility"
    ADMIN = "admin"


class ReferralStatus(str, enum.Enum):
    ASSIGNED = "ASSIGNED"
    CONFIRMED = "CONFIRMED"
    ARRIVED = "ARRIVED"
    CONSULTED = "CONSULTED"
    FOLLOW_UP = "FOLLOW_UP"
    CLOSED = "CLOSED"
    DECLINED = "DECLINED"
    NO_SHOW = "NO_SHOW"
    CANCELLED = "CANCELLED"


class AssessmentRecommendation(str, enum.Enum):
    LOCAL_CARE = "local_care"
    REFERRAL = "referral"


class FollowUpStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    MISSED = "missed"


class ReferralEventType(str, enum.Enum):
    REFERRAL_ASSIGNED = "REFERRAL_ASSIGNED"
    REFERRAL_CONFIRMED = "REFERRAL_CONFIRMED"
    REFERRAL_DECLINED = "REFERRAL_DECLINED"
    REFERRAL_CANCELLED = "REFERRAL_CANCELLED"
    PATIENT_ARRIVED = "PATIENT_ARRIVED"
    NO_SHOW_RECORDED = "NO_SHOW_RECORDED"
    CONSULTATION_RECORDED = "CONSULTATION_RECORDED"
    FOLLOW_UP_SCHEDULED = "FOLLOW_UP_SCHEDULED"
    REFERRAL_CLOSED = "REFERRAL_CLOSED"
    FOLLOW_UP_COMPLETED = "FOLLOW_UP_COMPLETED"
