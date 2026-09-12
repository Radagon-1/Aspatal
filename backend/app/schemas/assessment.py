from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AssessmentRecommendation


class AssessmentCreate(BaseModel):
    id: Optional[str] = None  # client-generated UUID, for offline-safe creation
    patient_id: str
    chief_complaint: str = Field(..., min_length=1)
    notes: Optional[str] = None
    recommendation: AssessmentRecommendation


class AssessmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    patient_id: str
    created_by: str
    chief_complaint: str
    notes: Optional[str] = None
    recommendation: AssessmentRecommendation
    created_at: datetime
