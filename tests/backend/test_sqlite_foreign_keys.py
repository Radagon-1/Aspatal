"""
Fix A: SQLite connections used by the application must enforce
FOREIGN KEY constraints -- SQLite does not do this by default even though
the schema declares them.
"""
import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError


def test_sqlite_foreign_keys_pragma_is_enabled(db_session):
    result = db_session.execute(text("PRAGMA foreign_keys")).scalar()
    assert result == 1


def test_invalid_foreign_key_insert_is_rejected(db_session):
    """
    Raw SQL, bypassing the ORM's own application-level existence checks,
    to prove the DATABASE itself now rejects a dangling FK -- not just
    that referral_workflow.create_referral validates it beforehand.
    """
    with pytest.raises(IntegrityError):
        db_session.execute(
            text(
                "INSERT INTO patients (id, full_name, approximate_age, registered_by, registered_at) "
                "VALUES ('p1', 'Ghost Patient', 40, 'does-not-exist-user-id', '2026-01-01 00:00:00')"
            )
        )
        db_session.commit()
    db_session.rollback()
