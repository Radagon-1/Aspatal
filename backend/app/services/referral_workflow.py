"""
Referral workflow service -- the ONE authoritative implementation of
referral transition rules (Phase 6 section 3). No router or schema
mutates Referral.status directly; every mutation goes through a function
in this module.

Domain errors (WorkflowError subclasses) are plain Python exceptions --
this module is HTTP-agnostic on purpose, so Phase 7 auth or any other
future transport can reuse it unchanged. app/main.py registers a single
FastAPI exception handler that maps WorkflowError -> HTTP response.
"""
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from sqlalchemy import and_
from sqlalchemy.orm import Query, Session

from app.db import utcnow
from app.models import (
    Assessment,
    ConsultationOutcome,
    Facility,
    FacilityService,
    FollowUp,
    Patient,
    Referral,
    ReferralEvent,
    User,
)
from app.models.enums import (
    FollowUpStatus,
    ReferralEventType,
    ReferralStatus,
    UserRole,
)


# --------------------------------------------------------------------------
# Domain errors -- the API layer maps these to HTTP status codes via a
# single exception handler (see app/main.py).
# --------------------------------------------------------------------------
class WorkflowError(Exception):
    status_code = 400


class ValidationError(WorkflowError):
    status_code = 400


class ForbiddenError(WorkflowError):
    status_code = 403


class NotFoundError(WorkflowError):
    status_code = 404


class ConflictError(WorkflowError):
    status_code = 409


# --------------------------------------------------------------------------
# Allowed-transition map for the "simple" transitions -- ones that need no
# payload beyond an optional reason. ARRIVED->CONSULTED and
# CONSULTED->FOLLOW_UP are NOT here: they require substantial extra data
# (a ConsultationOutcome / FollowUp record) and are handled by their own
# functions below, which call _execute_transition() directly -- the same
# core mutator, so there is still exactly one place Referral.status,
# timestamps, and ReferralEvent rows are actually written.
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class TransitionRule:
    event_type: ReferralEventType
    allowed_roles: frozenset
    actor_check: str = "facility_own"  # or "creator_or_admin", "facility_own_or_creator"
    requires_reason: bool = False


TRANSITION_RULES: dict[tuple[ReferralStatus, ReferralStatus], TransitionRule] = {
    (ReferralStatus.ASSIGNED, ReferralStatus.CONFIRMED): TransitionRule(
        ReferralEventType.REFERRAL_CONFIRMED, frozenset({UserRole.FACILITY})
    ),
    (ReferralStatus.ASSIGNED, ReferralStatus.DECLINED): TransitionRule(
        ReferralEventType.REFERRAL_DECLINED, frozenset({UserRole.FACILITY}), requires_reason=True
    ),
    (ReferralStatus.ASSIGNED, ReferralStatus.CANCELLED): TransitionRule(
        ReferralEventType.REFERRAL_CANCELLED,
        frozenset({UserRole.WORKER, UserRole.ADMIN}),
        actor_check="creator_or_admin",
        requires_reason=True,
    ),
    (ReferralStatus.CONFIRMED, ReferralStatus.ARRIVED): TransitionRule(
        ReferralEventType.PATIENT_ARRIVED, frozenset({UserRole.FACILITY})
    ),
    (ReferralStatus.CONFIRMED, ReferralStatus.NO_SHOW): TransitionRule(
        ReferralEventType.NO_SHOW_RECORDED, frozenset({UserRole.FACILITY})
    ),
    (ReferralStatus.CONFIRMED, ReferralStatus.CANCELLED): TransitionRule(
        ReferralEventType.REFERRAL_CANCELLED,
        frozenset({UserRole.WORKER, UserRole.ADMIN}),
        actor_check="creator_or_admin",
        requires_reason=True,
    ),
    (ReferralStatus.CONSULTED, ReferralStatus.CLOSED): TransitionRule(
        ReferralEventType.REFERRAL_CLOSED, frozenset({UserRole.FACILITY})
    ),
    (ReferralStatus.FOLLOW_UP, ReferralStatus.CLOSED): TransitionRule(
        ReferralEventType.FOLLOW_UP_COMPLETED,
        frozenset({UserRole.FACILITY, UserRole.WORKER}),
        actor_check="facility_own_or_creator",
    ),
}

_CLOSURE_REASON = {
    ReferralStatus.DECLINED: "declined",
    ReferralStatus.NO_SHOW: "no_show",
    ReferralStatus.CANCELLED: "cancelled",
    ReferralStatus.CLOSED: "completed",
}

_STATUS_TIMESTAMP_FIELD = {
    ReferralStatus.CONFIRMED: "confirmed_at",
    ReferralStatus.ARRIVED: "arrived_at",
    ReferralStatus.CONSULTED: "consulted_at",
    ReferralStatus.CLOSED: "closed_at",
    ReferralStatus.DECLINED: "closed_at",
    ReferralStatus.NO_SHOW: "closed_at",
    ReferralStatus.CANCELLED: "closed_at",
}


def _authorize(rule: TransitionRule, referral: Referral, actor: User) -> None:
    if actor.role not in rule.allowed_roles:
        raise ForbiddenError(f"Role '{actor.role.value}' cannot perform this transition")

    if rule.actor_check == "facility_own":
        if actor.role == UserRole.FACILITY and actor.facility_id != referral.assigned_facility_id:
            raise ForbiddenError("Actor does not belong to the referral's assigned facility")
    elif rule.actor_check == "creator_or_admin":
        if actor.role == UserRole.WORKER and actor.id != referral.created_by:
            raise ForbiddenError("Only the referral's creator (or an admin) may perform this action")
    elif rule.actor_check == "facility_own_or_creator":
        if actor.role == UserRole.FACILITY and actor.facility_id != referral.assigned_facility_id:
            raise ForbiddenError("Actor does not belong to the referral's assigned facility")
        if actor.role == UserRole.WORKER and actor.id != referral.created_by:
            raise ForbiddenError("Only the referral's creator may complete this follow-up")


def _execute_transition(
    db: Session,
    referral: Referral,
    to_status: ReferralStatus,
    event_type: ReferralEventType,
    actor: User,
    reason: Optional[str] = None,
) -> ReferralEvent:
    """The one place Referral.status, its timestamp, and the ReferralEvent
    row are actually written. Does not commit -- the caller (a router)
    commits once, together with its ProcessedOperation row."""
    from_status = referral.status
    referral.status = to_status

    timestamp_field = _STATUS_TIMESTAMP_FIELD.get(to_status)
    if timestamp_field:
        setattr(referral, timestamp_field, utcnow())

    if to_status in _CLOSURE_REASON:
        referral.closure_reason = _CLOSURE_REASON[to_status]

    event = ReferralEvent(
        referral_id=referral.id,
        event_type=event_type,
        from_status=from_status,
        to_status=to_status,
        actor_user_id=actor.id,
        actor_role=actor.role.value,
        notes=reason,
    )
    db.add(event)
    return event


def transition_referral(
    db: Session,
    referral: Referral,
    to_status: ReferralStatus,
    actor: User,
    reason: Optional[str] = None,
    expected_from: Optional[ReferralStatus] = None,
) -> ReferralEvent:
    """
    expected_from is set by explicit action endpoints whose target status
    is ambiguous on its own -- /close and /complete-follow-up both target
    CLOSED, but from CONSULTED and FOLLOW_UP respectively, with different
    event types and different side effects (see below). Without this
    check, calling the wrong endpoint for the referral's actual current
    state would silently succeed with the OTHER endpoint's semantics,
    since the transition rule is otherwise looked up purely from
    referral.status. Every other action endpoint's target status is
    unambiguous given its own name, so they don't need to pass this.
    """
    from_status = referral.status

    if expected_from is not None and from_status != expected_from:
        raise ConflictError(
            f"This action requires the referral to be {expected_from.value} "
            f"(currently {from_status.value})"
        )

    if from_status == to_status:
        raise ConflictError(f"Referral is already {to_status.value}")

    rule = TRANSITION_RULES.get((from_status, to_status))
    if rule is None:
        raise ConflictError(
            f"Cannot transition referral from {from_status.value} to {to_status.value}"
        )

    _authorize(rule, referral, actor)

    if rule.requires_reason and not reason:
        raise ValidationError("A reason is required for this transition")

    # Central product invariant: "no patient lost between referral and
    # follow-up." A consultation that flagged requires_followup=True MUST
    # go through FOLLOW_UP before CLOSED -- direct CONSULTED->CLOSED would
    # let a facility silently skip a needed follow-up.
    if from_status == ReferralStatus.CONSULTED and to_status == ReferralStatus.CLOSED:
        if referral.consultation_outcome is None:
            raise ConflictError("Cannot close: no consultation outcome has been recorded")
        if referral.consultation_outcome.requires_followup:
            raise ConflictError(
                "Cannot close directly: the consultation outcome requires a follow-up "
                "-- schedule and complete it via the follow-up workflow first"
            )

    event = _execute_transition(db, referral, to_status, rule.event_type, actor, reason=reason)

    # FOLLOW_UP -> CLOSED also completes the linked FollowUp row. This is a
    # mechanical side effect of one semantic transition, not a second
    # ambiguous branch -- the FollowUp's own lifecycle has no separate
    # client-facing "complete" endpoint (Phase 6 section 10's endpoint
    # list has none), so it rides along with this transition.
    if from_status == ReferralStatus.FOLLOW_UP and to_status == ReferralStatus.CLOSED:
        follow_up = referral.follow_up
        follow_up.status = FollowUpStatus.COMPLETED
        follow_up.completed_at = utcnow()
        follow_up.completed_by = actor.id

    return event


def record_consultation_outcome(
    db: Session,
    referral: Referral,
    actor: User,
    diagnosis_summary: str,
    requires_followup: bool,
    treatment_given: Optional[str] = None,
    medicines: Optional[str] = None,
    diagnostics_ordered: Optional[str] = None,
) -> tuple[ConsultationOutcome, ReferralEvent]:
    if referral.status != ReferralStatus.ARRIVED:
        raise ConflictError(
            f"Referral must be ARRIVED to record a consultation outcome "
            f"(currently {referral.status.value})"
        )
    if actor.role != UserRole.FACILITY:
        raise ForbiddenError("Only facility users may record a consultation outcome")
    if actor.facility_id != referral.assigned_facility_id:
        raise ForbiddenError("Actor does not belong to the referral's assigned facility")
    if referral.consultation_outcome is not None:
        raise ConflictError("A consultation outcome already exists for this referral")

    outcome = ConsultationOutcome(
        referral_id=referral.id,
        recorded_by=actor.id,
        diagnosis_summary=diagnosis_summary,
        treatment_given=treatment_given,
        medicines=medicines,
        diagnostics_ordered=diagnostics_ordered,
        requires_followup=requires_followup,
    )
    db.add(outcome)
    db.flush()

    event = _execute_transition(
        db, referral, ReferralStatus.CONSULTED, ReferralEventType.CONSULTATION_RECORDED, actor
    )
    return outcome, event


def schedule_follow_up(
    db: Session,
    referral: Referral,
    actor: User,
    due_date: datetime,
    instructions: Optional[str] = None,
) -> tuple[FollowUp, ReferralEvent]:
    if referral.status != ReferralStatus.CONSULTED:
        raise ConflictError(
            f"Referral must be CONSULTED to schedule a follow-up (currently {referral.status.value})"
        )
    if referral.consultation_outcome is None or not referral.consultation_outcome.requires_followup:
        raise ConflictError("This referral's consultation outcome does not require a follow-up")
    if actor.role != UserRole.FACILITY or actor.facility_id != referral.assigned_facility_id:
        raise ForbiddenError("Only the assigned facility may schedule a follow-up")
    if referral.follow_up is not None:
        raise ConflictError("A follow-up already exists for this referral")

    follow_up = FollowUp(referral_id=referral.id, due_date=due_date, instructions=instructions)
    db.add(follow_up)
    db.flush()

    event = _execute_transition(
        db, referral, ReferralStatus.FOLLOW_UP, ReferralEventType.FOLLOW_UP_SCHEDULED, actor
    )
    return follow_up, event


def create_assessment(
    db: Session,
    actor: User,
    patient_id: str,
    chief_complaint: str,
    recommendation,
    notes: Optional[str] = None,
    assessment_id: Optional[str] = None,
) -> Assessment:
    if actor.role not in (UserRole.WORKER, UserRole.ADMIN):
        raise ForbiddenError("Only workers may record assessments")

    patient = db.get(Patient, patient_id)
    if patient is None:
        raise NotFoundError("Patient not found")

    assessment = Assessment(
        id=assessment_id or str(uuid.uuid4()),
        patient_id=patient_id,
        created_by=actor.id,
        chief_complaint=chief_complaint,
        notes=notes,
        recommendation=recommendation,
    )
    db.add(assessment)
    db.flush()
    return assessment


def create_patient(
    db: Session,
    actor: User,
    full_name: str,
    date_of_birth=None,
    approximate_age: Optional[int] = None,
    sex: Optional[str] = None,
    phone: Optional[str] = None,
    village: Optional[str] = None,
    patient_id: Optional[str] = None,
) -> Patient:
    if actor.role not in (UserRole.WORKER, UserRole.ADMIN):
        raise ForbiddenError("Only workers may register patients")

    patient = Patient(
        id=patient_id or str(uuid.uuid4()),
        full_name=full_name,
        date_of_birth=date_of_birth,
        approximate_age=approximate_age,
        sex=sex,
        phone=phone,
        village=village,
        registered_by=actor.id,
    )
    db.add(patient)
    db.flush()
    return patient


def create_referral(
    db: Session,
    actor: User,
    patient_id: str,
    assigned_facility_id: str,
    reason: str,
    assessment_id: Optional[str] = None,
    required_service: Optional[str] = None,
    referred_from_referral_id: Optional[str] = None,
    referral_id: Optional[str] = None,
) -> tuple[Referral, ReferralEvent]:
    if actor.role not in (UserRole.WORKER, UserRole.ADMIN):
        raise ForbiddenError("Only workers may create referrals")

    patient = db.get(Patient, patient_id)
    if patient is None:
        raise NotFoundError("Patient not found")

    facility = db.get(Facility, assigned_facility_id)
    if facility is None:
        raise NotFoundError("Facility not found")
    if not facility.active:
        raise ValidationError("Facility is not active")

    if assessment_id is not None:
        assessment = db.get(Assessment, assessment_id)
        if assessment is None:
            raise NotFoundError("Assessment not found")
        if assessment.patient_id != patient_id:
            raise ValidationError("assessment_id does not belong to the given patient")

    if required_service is not None:
        service = (
            db.query(FacilityService)
            .filter_by(facility_id=facility.id, service_name=required_service, available=True)
            .first()
        )
        if service is None:
            raise ValidationError(
                f"Facility does not offer required_service '{required_service}'"
            )

    if referred_from_referral_id is not None:
        prior = db.get(Referral, referred_from_referral_id)
        if prior is None:
            raise NotFoundError("referred_from_referral_id not found")
        if prior.patient_id != patient_id:
            raise ValidationError("referred_from_referral_id does not belong to the same patient")

    referral = Referral(
        id=referral_id or str(uuid.uuid4()),
        patient_id=patient_id,
        assessment_id=assessment_id,
        created_by=actor.id,
        assigned_facility_id=assigned_facility_id,
        required_service=required_service,
        reason=reason,
        referred_from_referral_id=referred_from_referral_id,
        status=ReferralStatus.ASSIGNED,
    )
    db.add(referral)
    db.flush()

    event = ReferralEvent(
        referral_id=referral.id,
        event_type=ReferralEventType.REFERRAL_ASSIGNED,
        from_status=None,
        to_status=ReferralStatus.ASSIGNED,
        actor_user_id=actor.id,
        actor_role=actor.role.value,
        notes=reason,
    )
    db.add(event)

    return referral, event


# --------------------------------------------------------------------------
# Read-side authorization/scoping (section 9: workers see their own,
# facilities see their own, admins see everything, unassigned see nothing).
# --------------------------------------------------------------------------
def authorize_referral_read(referral: Referral, actor: User) -> None:
    if actor.role == UserRole.ADMIN:
        return
    if actor.role == UserRole.FACILITY:
        if actor.facility_id == referral.assigned_facility_id:
            return
        raise ForbiddenError("Actor does not belong to the referral's assigned facility")
    if actor.role == UserRole.WORKER:
        if actor.id == referral.created_by:
            return
        raise ForbiddenError("Workers may only view referrals they created")
    raise ForbiddenError("Unassigned users have no workflow access")


def scope_referrals_query(query: Query, actor: User) -> Query:
    if actor.role == UserRole.ADMIN:
        return query
    if actor.role == UserRole.FACILITY:
        return query.filter(Referral.assigned_facility_id == actor.facility_id)
    if actor.role == UserRole.WORKER:
        return query.filter(Referral.created_by == actor.id)
    raise ForbiddenError("Unassigned users have no workflow access")


def apply_overdue_filter(query: Query, overdue: bool, now: Optional[datetime] = None) -> Query:
    """
    GET /api/referrals?overdue= filter. Reuses the EXACT same overdue
    predicate as list_overdue_follow_ups below (FollowUp still PENDING and
    its due_date has passed) -- this is the only overdue semantic actually
    persisted and implemented in this codebase. There is no ASSIGNED/
    CONFIRMED duration-based overdue threshold anywhere in the models or
    config; inventing one here was explicitly out of scope for this fix.

    overdue=True  -> referrals whose linked FollowUp is overdue.
    overdue=False -> everything else, including referrals with no
    FollowUp at all (a referral that was never given a follow-up isn't
    "overdue" by this definition -- it simply isn't in scope of it).
    """
    now = now or utcnow()
    is_overdue = Referral.follow_up.has(
        and_(FollowUp.status == FollowUpStatus.PENDING, FollowUp.due_date < now)
    )
    return query.filter(is_overdue) if overdue else query.filter(~is_overdue)


def list_overdue_follow_ups(db: Session, actor: User, now: Optional[datetime] = None) -> list[FollowUp]:
    now = now or utcnow()
    query = (
        db.query(FollowUp)
        .join(Referral, FollowUp.referral_id == Referral.id)
        .filter(FollowUp.status == FollowUpStatus.PENDING, FollowUp.due_date < now)
    )
    query = scope_referrals_query(query, actor)
    return query.all()
