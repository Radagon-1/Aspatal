"""
TEMPORARY PHASE-6 ACTOR CONTEXT.
TO BE REPLACED BY VERIFIED FIREBASE IDENTITY.

Resolves the acting user from an explicit X-Actor-User-Id header instead of
a verified Firebase ID token -- production auth (token verification, role
middleware) is out of scope for this phase. This exists so the workflow/API
layer can be built and tested against a real User row now: every router and
service function already takes a resolved `User` object, not a raw
token/header, so replacing this dependency later with real Firebase
verification will not require touching any business logic.
"""
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.models.enums import UserRole


def get_current_actor(
    x_actor_user_id: str = Header(..., alias="X-Actor-User-Id"),
    db: Session = Depends(get_db),
) -> User:
    actor = db.get(User, x_actor_user_id)
    if actor is None:
        raise HTTPException(status_code=404, detail="Actor user (X-Actor-User-Id) not found")
    return actor


def require_assigned_actor(actor: User = Depends(get_current_actor)) -> User:
    """An UNASSIGNED role has no workflow authority at all -- not even
    read access, since granting visibility into care-coordination data to
    an un-provisioned account isn't specified anywhere in the frozen
    contract, and blocking is the conservative default."""
    if actor.role == UserRole.UNASSIGNED:
        raise HTTPException(status_code=403, detail="Unassigned users have no workflow access")
    return actor
