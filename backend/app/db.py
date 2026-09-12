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

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import DATABASE_URL

_IS_SQLITE = DATABASE_URL.startswith("sqlite")

# SQLite needs check_same_thread=False to be used across FastAPI's request
# threads; other databases (e.g. Postgres) don't take this argument at all.
connect_args = {"check_same_thread": False} if _IS_SQLITE else {}

def enable_sqlite_foreign_keys(target_engine) -> None:
    """
    SQLite does not enforce FOREIGN KEY constraints by default -- they
    exist in the schema (see the models) but are silently unenforced
    unless each connection turns this pragma on. Postgres enforces FKs
    natively and needs no equivalent; only call this for a SQLite engine.

    A standalone function (not inlined below) so tests that build their
    own disposable SQLite engine can apply the exact same configuration
    the application uses, rather than re-implementing it.
    """
    @event.listens_for(target_engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

if _IS_SQLITE:
    enable_sqlite_foreign_keys(engine)

Base = declarative_base()


def utcnow() -> datetime:
    return datetime.utcnow()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
