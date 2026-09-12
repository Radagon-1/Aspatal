from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ConsultationOutcomeCreate(BaseModel):
    diagnosis_summary: str = Field(..., min_length=1)
    requires_followup: bool
    treatment_given: Optional[str] = None
    medicines: Optional[str] = None
    diagnostics_ordered: Optional[str] = None


class ConsultationOutcomeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    referral_id: str
    recorded_by: str
    diagnosis_summary: str
    treatment_given: Optional[str] = None
    medicines: Optional[str] = None
    diagnostics_ordered: Optional[str] = None
    requires_followup: bool
    created_at: datetime
