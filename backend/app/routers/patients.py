from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_assigned_actor
from app.models import Patient, User
from app.schemas.patient import PatientCreate, PatientOut
from app.services import referral_workflow as workflow
from app.services.idempotency import get_replayed_response, record_operation

router = APIRouter(tags=["patients"])

EP_CREATE = "/api/patients"


@router.post("/patients", response_model=PatientOut, status_code=201)
def create_patient(
    payload: PatientCreate,
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

    patient = workflow.create_patient(
        db,
        actor,
        full_name=payload.full_name,
        date_of_birth=payload.date_of_birth,
        approximate_age=payload.approximate_age,
        sex=payload.sex,
        phone=payload.phone,
        village=payload.village,
        patient_id=payload.id,
    )

    out = PatientOut.model_validate(patient)
    record_operation(db, idempotency_key, EP_CREATE, patient.id, 201, out.model_dump(mode="json"))

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        replay = get_replayed_response(db, idempotency_key, EP_CREATE, expected_entity_id)
        if replay is not None:
            return replay
        raise HTTPException(status_code=409, detail="Conflicting create operation")

    return out


@router.get("/patients/{patient_id}", response_model=PatientOut)
def get_patient(
    patient_id: str,
    actor: User = Depends(require_assigned_actor),
    db: Session = Depends(get_db),
):
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient
