from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_assigned_actor
from app.models import User
from app.schemas.follow_up import FollowUpOut
from app.services import referral_workflow as workflow

router = APIRouter(tags=["follow-ups"])


@router.get("/follow-ups/overdue", response_model=list[FollowUpOut])
def list_overdue_follow_ups(
    actor: User = Depends(require_assigned_actor),
    db: Session = Depends(get_db),
):
    return workflow.list_overdue_follow_ups(db, actor)
