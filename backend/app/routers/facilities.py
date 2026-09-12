from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_assigned_actor
from app.models import Facility, FacilityService, User
from app.schemas.facility import FacilityOut

router = APIRouter(tags=["facilities"])


@router.get("/facilities", response_model=list[FacilityOut])
def list_facilities(
    service: Optional[str] = None,
    active: Optional[bool] = None,
    actor: User = Depends(require_assigned_actor),
    db: Session = Depends(get_db),
):
    """`service` is the canonical public query parameter name (the frozen
    contract's GET /api/facilities?service=&active=) -- it maps internally
    to FacilityService.service_name, which stays as the model/column name
    since that's an internal implementation detail, not the API surface."""
    query = db.query(Facility)
    if active is not None:
        query = query.filter(Facility.active == active)
    if service is not None:
        query = query.join(FacilityService).filter(
            FacilityService.service_name == service,
            FacilityService.available.is_(True),
        )
    return query.all()


@router.get("/facilities/{facility_id}", response_model=FacilityOut)
def get_facility(
    facility_id: str,
    actor: User = Depends(require_assigned_actor),
    db: Session = Depends(get_db),
):
    facility = db.get(Facility, facility_id)
    if facility is None:
        raise HTTPException(status_code=404, detail="Facility not found")
    return facility
