from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_assigned_actor
from app.models import Patient, User
from app.schemas.patient import PatientCreate, PatientOut
from app.services import referral_workflow as workflow
from app.services.idempotency import (
    get_replayed_response,
    record_operation,
    resolve_create_by_client_entity_id,
)

router = APIRouter(tags=["patients"])

# Practical safety cap on an unfiltered/broad lookup -- not pagination
# (not asked for), just a sane ceiling on result size.
_SEARCH_LIMIT = 50

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

    # Same target, different operation key: return the existing patient
    # rather than attempting a duplicate insert that would fail purely on
    # the primary key already existing (baseline-hardening fix E).
    existing_result = resolve_create_by_client_entity_id(
        db, Patient, expected_entity_id, PatientOut, idempotency_key, EP_CREATE
    )
    if existing_result is not None:
        return existing_result

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


@router.get("/patients", response_model=list[PatientOut])
def search_patients(
    query: Optional[str] = None,
    actor: User = Depends(require_assigned_actor),
    db: Session = Depends(get_db),
):
    """
    Practical lookup for the worker "does this patient already exist"
    workflow -- case-insensitive substring match against full_name and,
    where present, phone. No fuzzy/AI matching -- exact substring, sorted
    deterministically. `/patients` (no path param) and `/patients/{id}`
    are distinct route shapes, so this never conflicts with get_patient.
    """
    q = db.query(Patient)
    if query:
        pattern = f"%{query}%"
        q = q.filter(or_(Patient.full_name.ilike(pattern), Patient.phone.ilike(pattern)))
    return q.order_by(Patient.full_name, Patient.id).limit(_SEARCH_LIMIT).all()


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
