"""
SQLAlchemy infrastructure: engine, session factory, declarative base, and the
FastAPI get_db() dependency. All database access in this app goes through
this module — no router or service constructs its own engine/session.

Timestamp convention: every model timestamp is naive UTC, produced by the
utcnow() helper below. Naive (not tz-aware) is a deliberate simplification
for this MVP — mixing naive/aware datetimes is a common source of subtle
bugs, and a single global "everything is UTC, always" convention avoids that
without needing timezone-aware columns anywhere. UI layers are responsible
for local-time display.
"""
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import DATABASE_URL

# SQLite needs check_same_thread=False to be used across FastAPI's request
# threads; other databases (e.g. Postgres) don't take this argument at all.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def utcnow() -> datetime:
    return datetime.utcnow()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
