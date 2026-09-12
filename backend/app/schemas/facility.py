from typing import Optional

from pydantic import BaseModel, ConfigDict


class FacilityServiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    service_name: str
    available: bool


class FacilityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    type: str
    location: Optional[str] = None
    active: bool
    services: list[FacilityServiceOut] = []
