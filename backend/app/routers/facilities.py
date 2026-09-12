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
    active: Optional[bool] = None,
    service_name: Optional[str] = None,
    actor: User = Depends(require_assigned_actor),
    db: Session = Depends(get_db),
):
    query = db.query(Facility)
    if active is not None:
        query = query.filter(Facility.active == active)
    if service_name is not None:
        query = query.join(FacilityService).filter(
            FacilityService.service_name == service_name,
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
