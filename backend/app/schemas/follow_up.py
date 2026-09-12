from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import FollowUpStatus


class FollowUpCreate(BaseModel):
    due_date: datetime
    instructions: Optional[str] = None


class FollowUpOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    referral_id: str
    due_date: datetime
    instructions: Optional[str] = None
    status: FollowUpStatus
    completed_at: Optional[datetime] = None
    completed_by: Optional[str] = None
