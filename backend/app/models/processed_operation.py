from sqlalchemy import Column, DateTime, Integer, String, Text

from app.db import Base, utcnow


class ProcessedOperation(Base):
    """
    Idempotency infrastructure table (Phase 4B correction 4 / 4B §10).
    No processing logic lives here yet -- that's a later phase's
    middleware/service. This is just the persisted shape it will read and
    write: one row per client-supplied Idempotency-Key, storing the
    response that was actually returned so a retried request can be
    answered identically without re-executing anything.
    """
    __tablename__ = "processed_operations"

    operation_id = Column(String(36), primary_key=True)
    endpoint = Column(String(255), nullable=False)
    entity_id = Column(String(36), nullable=True)
    response_status = Column(Integer, nullable=False)
    # Portable simple representation: the response body as a JSON string in
    # a plain Text column, rather than a dialect-specific JSON/JSONB type.
    response_body = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=utcnow)
