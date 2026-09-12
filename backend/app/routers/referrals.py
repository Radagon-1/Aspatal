"""
Explicit referral action endpoints (Phase 6.1 correction B -- restores the
frozen Phase 4B API shape). Every action below delegates to the SAME
authoritative workflow service (app.services.referral_workflow) -- no
router here sets Referral.status or appends a ReferralEvent directly.

There is deliberately no generic POST /referrals/{id}/transitions endpoint
in the public API: each action's target status is fixed by which endpoint
was called, not by a client-supplied `to_status` field.

Phase 6.2: every resource-specific mutation below binds its Idempotency-Key
replay check to `referral_id` (via `expected_entity_id`), not just the
endpoint template -- see app/services/idempotency.py for why. The check
happens before the referral is even fetched, using the `referral_id` path
parameter directly, so a target mismatch is rejected before any domain
mutation could run.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_assigned_actor
from app.models import Referral, User
from app.models.enums import ReferralStatus
from app.schemas.consultation import ConsultationOutcomeCreate
from app.schemas.follow_up import FollowUpCreate
from app.schemas.referral import ReasonPayload, ReferralCreate, ReferralEventOut, ReferralOut
from app.services import referral_workflow as workflow
from app.services.idempotency import get_replayed_response, record_operation

router = APIRouter(tags=["referrals"])

# Canonical endpoint identifiers for idempotency binding -- the route's own
# path template (literal {referral_id}, never a resolved ID). See
# app/services/idempotency.py for why this convention was chosen.
EP_CREATE = "/api/referrals"
EP_ACKNOWLEDGE = "/api/referrals/{referral_id}/acknowledge"
EP_DECLINE = "/api/referrals/{referral_id}/decline"
EP_CANCEL = "/api/referrals/{referral_id}/cancel"
EP_ARRIVE = "/api/referrals/{referral_id}/arrive"
EP_NO_SHOW = "/api/referrals/{referral_id}/no-show"
EP_CONSULT = "/api/referrals/{referral_id}/consult"
EP_FOLLOW_UP = "/api/referrals/{referral_id}/follow-up"
EP_CLOSE = "/api/referrals/{referral_id}/close"
EP_COMPLETE_FOLLOW_UP = "/api/referrals/{referral_id}/complete-follow-up"


def _get_referral_or_404(db: Session, referral_id: str) -> Referral:
    referral = db.get(Referral, referral_id)
    if referral is None:
        raise HTTPException(status_code=404, detail="Referral not found")
    return referral


def _commit_or_replay(
    db: Session,
    idempotency_key: str,
    endpoint: str,
    conflict_detail: str,
    expected_entity_id: Optional[str] = None,
):
    """Shared tail of every mutating handler: one commit, with the
    idempotency race-recovery fallback described in idempotency.py. Uses
    the SAME endpoint + expected_entity_id as the handler's original
    replay check, so the race path can't reintroduce a cross-entity
    replay that the upfront check would have rejected."""
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        replay = get_replayed_response(db, idempotency_key, endpoint, expected_entity_id)
        if replay is not None:
            return replay
        raise HTTPException(status_code=409, detail=conflict_detail)
    return None


@router.post("/referrals", response_model=ReferralOut, status_code=201)
def create_referral(
    payload: ReferralCreate,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    actor: User = Depends(require_assigned_actor),
    db: Session = Depends(get_db),
):
    # Entity binding is only meaningful here if the client supplied its own
    # UUID (payload.id) -- when the server generates the ID, there is
    # nothing to bind to yet at replay-check time. See idempotency.py's
    # documented limitation.
    expected_entity_id = payload.id
    replay = get_replayed_response(db, idempotency_key, EP_CREATE, expected_entity_id)
    if replay is not None:
        return replay

    referral, _event = workflow.create_referral(
        db,
        actor,
        patient_id=payload.patient_id,
        assigned_facility_id=payload.assigned_facility_id,
        reason=payload.reason,
        assessment_id=payload.assessment_id,
        required_service=payload.required_service,
        referred_from_referral_id=payload.referred_from_referral_id,
        referral_id=payload.id,
    )

    out = ReferralOut.model_validate(referral)
    record_operation(db, idempotency_key, EP_CREATE, referral.id, 201, out.model_dump(mode="json"))

    conflict = _commit_or_replay(
        db, idempotency_key, EP_CREATE, "Conflicting create operation", expected_entity_id
    )
    if conflict is not None:
        return conflict
    return out


@router.get("/referrals/{referral_id}", response_model=ReferralOut)
def get_referral(
    referral_id: str,
    actor: User = Depends(require_assigned_actor),
    db: Session = Depends(get_db),
):
    referral = _get_referral_or_404(db, referral_id)
    workflow.authorize_referral_read(referral, actor)
    return referral


@router.get("/referrals", response_model=list[ReferralOut])
def list_referrals(
    status: Optional[ReferralStatus] = None,
    facility_id: Optional[str] = None,
    actor: User = Depends(require_assigned_actor),
    db: Session = Depends(get_db),
):
    query = workflow.scope_referrals_query(db.query(Referral), actor)
    if status is not None:
        query = query.filter(Referral.status == status)
    if facility_id is not None:
        query = query.filter(Referral.assigned_facility_id == facility_id)
    return query.order_by(Referral.created_at.desc()).all()


@router.get("/referrals/{referral_id}/events", response_model=list[ReferralEventOut])
def list_referral_events(
    referral_id: str,
    actor: User = Depends(require_assigned_actor),
    db: Session = Depends(get_db),
):
    referral = _get_referral_or_404(db, referral_id)
    workflow.authorize_referral_read(referral, actor)
    return referral.events


@router.post("/referrals/{referral_id}/acknowledge", response_model=ReferralOut)
def acknowledge_referral(
    referral_id: str,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    actor: User = Depends(require_assigned_actor),
    db: Session = Depends(get_db),
):
    replay = get_replayed_response(db, idempotency_key, EP_ACKNOWLEDGE, referral_id)
    if replay is not None:
        return replay

    referral = _get_referral_or_404(db, referral_id)
    workflow.transition_referral(db, referral, ReferralStatus.CONFIRMED, actor)

    out = ReferralOut.model_validate(referral)
    record_operation(db, idempotency_key, EP_ACKNOWLEDGE, referral.id, 200, out.model_dump(mode="json"))

    conflict = _commit_or_replay(
        db, idempotency_key, EP_ACKNOWLEDGE, "Conflicting acknowledge operation", referral_id
    )
    if conflict is not None:
        return conflict
    return out


@router.post("/referrals/{referral_id}/decline", response_model=ReferralOut)
def decline_referral(
    referral_id: str,
    payload: ReasonPayload,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    actor: User = Depends(require_assigned_actor),
    db: Session = Depends(get_db),
):
    replay = get_replayed_response(db, idempotency_key, EP_DECLINE, referral_id)
    if replay is not None:
        return replay

    referral = _get_referral_or_404(db, referral_id)
    workflow.transition_referral(db, referral, ReferralStatus.DECLINED, actor, reason=payload.reason)

    out = ReferralOut.model_validate(referral)
    record_operation(db, idempotency_key, EP_DECLINE, referral.id, 200, out.model_dump(mode="json"))

    conflict = _commit_or_replay(
        db, idempotency_key, EP_DECLINE, "Conflicting decline operation", referral_id
    )
    if conflict is not None:
        return conflict
    return out


@router.post("/referrals/{referral_id}/cancel", response_model=ReferralOut)
def cancel_referral(
    referral_id: str,
    payload: ReasonPayload,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    actor: User = Depends(require_assigned_actor),
    db: Session = Depends(get_db),
):
    replay = get_replayed_response(db, idempotency_key, EP_CANCEL, referral_id)
    if replay is not None:
        return replay

    referral = _get_referral_or_404(db, referral_id)
    workflow.transition_referral(db, referral, ReferralStatus.CANCELLED, actor, reason=payload.reason)

    out = ReferralOut.model_validate(referral)
    record_operation(db, idempotency_key, EP_CANCEL, referral.id, 200, out.model_dump(mode="json"))

    conflict = _commit_or_replay(
        db, idempotency_key, EP_CANCEL, "Conflicting cancel operation", referral_id
    )
    if conflict is not None:
        return conflict
    return out


@router.post("/referrals/{referral_id}/arrive", response_model=ReferralOut)
def arrive_referral(
    referral_id: str,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    actor: User = Depends(require_assigned_actor),
    db: Session = Depends(get_db),
):
    replay = get_replayed_response(db, idempotency_key, EP_ARRIVE, referral_id)
    if replay is not None:
        return replay

    referral = _get_referral_or_404(db, referral_id)
    workflow.transition_referral(db, referral, ReferralStatus.ARRIVED, actor)

    out = ReferralOut.model_validate(referral)
    record_operation(db, idempotency_key, EP_ARRIVE, referral.id, 200, out.model_dump(mode="json"))

    conflict = _commit_or_replay(
        db, idempotency_key, EP_ARRIVE, "Conflicting arrive operation", referral_id
    )
    if conflict is not None:
        return conflict
    return out


@router.post("/referrals/{referral_id}/no-show", response_model=ReferralOut)
def mark_no_show(
    referral_id: str,
    payload: ReasonPayload,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    actor: User = Depends(require_assigned_actor),
    db: Session = Depends(get_db),
):
    replay = get_replayed_response(db, idempotency_key, EP_NO_SHOW, referral_id)
    if replay is not None:
        return replay

    referral = _get_referral_or_404(db, referral_id)
    workflow.transition_referral(db, referral, ReferralStatus.NO_SHOW, actor, reason=payload.reason)

    out = ReferralOut.model_validate(referral)
    record_operation(db, idempotency_key, EP_NO_SHOW, referral.id, 200, out.model_dump(mode="json"))

    conflict = _commit_or_replay(
        db, idempotency_key, EP_NO_SHOW, "Conflicting no-show operation", referral_id
    )
    if conflict is not None:
        return conflict
    return out


@router.post("/referrals/{referral_id}/consult", response_model=ReferralOut)
def consult_referral(
    referral_id: str,
    payload: ConsultationOutcomeCreate,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    actor: User = Depends(require_assigned_actor),
    db: Session = Depends(get_db),
):
    replay = get_replayed_response(db, idempotency_key, EP_CONSULT, referral_id)
    if replay is not None:
        return replay

    referral = _get_referral_or_404(db, referral_id)
    workflow.record_consultation_outcome(
        db,
        referral,
        actor,
        diagnosis_summary=payload.diagnosis_summary,
        requires_followup=payload.requires_followup,
        treatment_given=payload.treatment_given,
        medicines=payload.medicines,
        diagnostics_ordered=payload.diagnostics_ordered,
    )

    out = ReferralOut.model_validate(referral)
    record_operation(db, idempotency_key, EP_CONSULT, referral.id, 200, out.model_dump(mode="json"))

    conflict = _commit_or_replay(
        db, idempotency_key, EP_CONSULT, "Conflicting consult operation", referral_id
    )
    if conflict is not None:
        return conflict
    return out


@router.post("/referrals/{referral_id}/follow-up", response_model=ReferralOut)
def schedule_follow_up(
    referral_id: str,
    payload: FollowUpCreate,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    actor: User = Depends(require_assigned_actor),
    db: Session = Depends(get_db),
):
    replay = get_replayed_response(db, idempotency_key, EP_FOLLOW_UP, referral_id)
    if replay is not None:
        return replay

    referral = _get_referral_or_404(db, referral_id)
    workflow.schedule_follow_up(
        db, referral, actor, due_date=payload.due_date, instructions=payload.instructions
    )

    out = ReferralOut.model_validate(referral)
    record_operation(db, idempotency_key, EP_FOLLOW_UP, referral.id, 200, out.model_dump(mode="json"))

    conflict = _commit_or_replay(
        db, idempotency_key, EP_FOLLOW_UP, "Conflicting follow-up operation", referral_id
    )
    if conflict is not None:
        return conflict
    return out


@router.post("/referrals/{referral_id}/close", response_model=ReferralOut)
def close_referral(
    referral_id: str,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    actor: User = Depends(require_assigned_actor),
    db: Session = Depends(get_db),
):
    """CONSULTED -> CLOSED, only when the recorded consultation outcome did
    NOT flag requires_followup -- enforced inside
    workflow.transition_referral, not here (see the invariant check there:
    "no patient lost between referral and follow-up")."""
    replay = get_replayed_response(db, idempotency_key, EP_CLOSE, referral_id)
    if replay is not None:
        return replay

    referral = _get_referral_or_404(db, referral_id)
    workflow.transition_referral(
        db, referral, ReferralStatus.CLOSED, actor, expected_from=ReferralStatus.CONSULTED
    )

    out = ReferralOut.model_validate(referral)
    record_operation(db, idempotency_key, EP_CLOSE, referral.id, 200, out.model_dump(mode="json"))

    conflict = _commit_or_replay(
        db, idempotency_key, EP_CLOSE, "Conflicting close operation", referral_id
    )
    if conflict is not None:
        return conflict
    return out


@router.post("/referrals/{referral_id}/complete-follow-up", response_model=ReferralOut)
def complete_follow_up(
    referral_id: str,
    payload: ReasonPayload,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    actor: User = Depends(require_assigned_actor),
    db: Session = Depends(get_db),
):
    replay = get_replayed_response(db, idempotency_key, EP_COMPLETE_FOLLOW_UP, referral_id)
    if replay is not None:
        return replay

    referral = _get_referral_or_404(db, referral_id)
    workflow.transition_referral(
        db,
        referral,
        ReferralStatus.CLOSED,
        actor,
        reason=payload.reason,
        expected_from=ReferralStatus.FOLLOW_UP,
    )

    out = ReferralOut.model_validate(referral)
    record_operation(
        db, idempotency_key, EP_COMPLETE_FOLLOW_UP, referral.id, 200, out.model_dump(mode="json")
    )

    conflict = _commit_or_replay(
        db,
        idempotency_key,
        EP_COMPLETE_FOLLOW_UP,
        "Conflicting complete-follow-up operation",
        referral_id,
    )
    if conflict is not None:
        return conflict
    return out
