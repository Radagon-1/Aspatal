from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_assigned_actor
from app.models import Assessment, User
from app.schemas.assessment import AssessmentCreate, AssessmentOut
from app.services import referral_workflow as workflow
from app.services.idempotency import get_replayed_response, record_operation

router = APIRouter(tags=["assessments"])

EP_CREATE = "/api/assessments"


@router.post("/assessments", response_model=AssessmentOut, status_code=201)
def create_assessment(
    payload: AssessmentCreate,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    actor: User = Depends(require_assigned_actor),
    db: Session = Depends(get_db),
):
    # Entity binding only applies when the client supplied its own UUID --
    # see app/services/idempotency.py's documented create-endpoint limitation.
    expected_entity_id = payload.id
    replay = get_replayed_response(db, idempotency_key, EP_CREATE, expected_entity_id)
    if replay is not None:
        return replay

    assessment = workflow.create_assessment(
        db,
        actor,
        patient_id=payload.patient_id,
        chief_complaint=payload.chief_complaint,
        recommendation=payload.recommendation,
        notes=payload.notes,
        assessment_id=payload.id,
    )

    out = AssessmentOut.model_validate(assessment)
    record_operation(db, idempotency_key, EP_CREATE, assessment.id, 201, out.model_dump(mode="json"))

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        replay = get_replayed_response(db, idempotency_key, EP_CREATE, expected_entity_id)
        if replay is not None:
            return replay
        raise HTTPException(status_code=409, detail="Conflicting create operation")

    return out


@router.get("/assessments/{assessment_id}", response_model=AssessmentOut)
def get_assessment(
    assessment_id: str,
    actor: User = Depends(require_assigned_actor),
    db: Session = Depends(get_db),
):
    assessment = db.get(Assessment, assessment_id)
    if assessment is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return assessment
