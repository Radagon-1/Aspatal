from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PatientCreate(BaseModel):
    id: Optional[str] = None  # client-generated UUID, for offline-safe creation
    full_name: str = Field(..., min_length=1)
    date_of_birth: Optional[date] = None
    approximate_age: Optional[int] = Field(None, ge=0, le=130)
    sex: Optional[str] = None
    phone: Optional[str] = None
    village: Optional[str] = None

    @model_validator(mode="after")
    def _require_dob_or_approximate_age(self):
        if self.date_of_birth is None and self.approximate_age is None:
            raise ValueError("Either date_of_birth or approximate_age is required")
        return self


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    date_of_birth: Optional[date] = None
    approximate_age: Optional[int] = None
    sex: Optional[str] = None
    phone: Optional[str] = None
    village: Optional[str] = None
    registered_by: str
    registered_at: datetime
