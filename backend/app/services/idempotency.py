"""
Idempotency helpers built on the Phase 5 ProcessedOperation table.

Design (Phase 4B correction 4 / 4B §10 + Phase 6.1 correction A + Phase 6.2
target-binding fix, smallest viable version for a hackathon -- no
distributed locking):

- Every mutating request carries an Idempotency-Key header (the client-
  generated operation UUID).
- The key is bound to a CANONICAL ENDPOINT IDENTIFIER -- the route's own
  path template, with any {path_param} left as a literal placeholder (e.g.
  "/api/referrals/{referral_id}/acknowledge"), never the resolved path with
  a real ID interpolated in. Every router passes the exact same constant
  string on every call for a given endpoint.
- For resource-specific endpoints (anything that mutates a *particular*
  referral/patient/assessment named in the URL or a client-generated ID),
  the key is ALSO bound to that target entity's ID via
  ProcessedOperation.entity_id. A legitimate retry must target the SAME
  logical entity, not just the same endpoint shape -- see get_replayed_
  response's `expected_entity_id` parameter. Without this, the same key
  reused against two different referrals on the same endpoint template
  (e.g. .../REFERRAL_A/acknowledge then .../REFERRAL_B/acknowledge) would
  incorrectly replay REFERRAL_A's stored response for REFERRAL_B -- that
  was Phase 6.2's bug, now fixed.
- On the FIRST request with a given key: the router executes the workflow
  operation, builds its response, and inserts a ProcessedOperation row
  storing the endpoint identifier, the target entity_id, and the exact
  response -- all in the SAME transaction as the domain mutation (one
  db.commit() call; see each router).
- On a RETRY with the same key, same endpoint, AND same entity_id:
  get_replayed_response finds the stored row and returns its response
  verbatim, without touching the workflow service at all -- so a retried
  request cannot duplicate a Referral, append a second ReferralEvent, etc.
- On a request with the same key but a DIFFERENT endpoint, OR the same
  endpoint but a DIFFERENT entity_id: rejected with 409 BEFORE any domain
  logic runs. A key is a promise about one specific operation against one
  specific target; replaying across endpoints or across entities would be
  silently wrong, not idempotent.
- Race safety: ProcessedOperation.operation_id is the table's primary key,
  so if two requests with the same key somehow commit concurrently, only
  one INSERT succeeds; the loser gets an IntegrityError, rolls back, and
  re-checks for a replay using the SAME endpoint + expected_entity_id as
  its original check (see each router's `except IntegrityError` block /
  `_commit_or_replay` in routers/referrals.py) -- the DB constraint is the
  actual final duplicate protection, not the upfront read-check.

Known limitation (create endpoints, documented rather than silently
accepted -- see app/routers/{patients,assessments,referrals}.py): entity
binding is only enforced on a create endpoint when the client supplied an
explicit `id` in the request body. When the server generates the ID (no
client `id` given), a retry's response is validated by endpoint alone, not
by entity, because the entity ID doesn't exist yet at the time the
Idempotency-Key is chosen -- there is nothing to bind to until after the
first attempt runs. This phase does not add request-body hashing to close
that gap; it is out of scope per the Phase 6.2 instructions.
"""
import json
from typing import Any, Optional

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.models import ProcessedOperation


def get_replayed_response(
    db: Session,
    operation_id: str,
    endpoint: str,
    expected_entity_id: Optional[str] = None,
) -> Optional[JSONResponse]:
    """
    Returns the stored response if `operation_id` was already processed for
    this exact `endpoint` AND (when `expected_entity_id` is given) the same
    target entity. Returns None if the key is unused (caller should proceed
    normally).

    Raises 409 if the key was already used for a different endpoint, or for
    the same endpoint but a different target entity -- neither is ever a
    legitimate retry, and the domain mutation must not run in that case.
    """
    existing = db.get(ProcessedOperation, operation_id)
    if existing is None:
        return None

    if existing.endpoint != endpoint:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Idempotency-Key was already used for a different operation "
                f"({existing.endpoint}); a key must not be reused across endpoints"
            ),
        )

    if expected_entity_id is not None and existing.entity_id != expected_entity_id:
        raise HTTPException(
            status_code=409,
            detail=(
                "Idempotency-Key was already used for a different target entity "
                "on this endpoint; a key must not be reused across entities"
            ),
        )

    return JSONResponse(
        status_code=existing.response_status,
        content=json.loads(existing.response_body),
    )


def record_operation(
    db: Session,
    operation_id: str,
    endpoint: str,
    entity_id: Optional[str],
    response_status: int,
    response_body: dict[str, Any],
) -> None:
    db.add(
        ProcessedOperation(
            operation_id=operation_id,
            endpoint=endpoint,
            entity_id=entity_id,
            response_status=response_status,
            response_body=json.dumps(response_body),
        )
    )
