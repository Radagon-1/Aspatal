"""
Tests 19-20: DB-level enum CHECK enforcement, and that persistence tooling
imports cleanly with no Groq/network dependency.
"""
import os
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

BACKEND_DIR = Path(__file__).resolve().parents[2] / "backend"


# 19. enum CHECK constraints are present/validated where practical
def test_invalid_enum_value_rejected_at_db_level(db_session):
    """
    Insert via raw SQL, bypassing the ORM/Python Enum entirely, to prove the
    CHECK constraint is a real database-level guarantee -- not just Python
    validation that a direct SQL write (or a bug) could route around.
    """
    with pytest.raises(IntegrityError):
        db_session.execute(
            text(
                "INSERT INTO users (id, firebase_uid, email, role, created_at) "
                "VALUES ('bad-1', 'raw-uid', 'raw@example.com', 'not_a_real_role', "
                "'2026-01-01 00:00:00')"
            )
        )
        db_session.commit()
    db_session.rollback()


# 20. database/migration modules can load without making any Groq/network call
def test_config_and_models_import_without_groq_configured(tmp_path):
    """
    Runs in a subprocess whose cwd has no .env file anywhere above it (so
    python-dotenv's upward search finds nothing) and with GROQ_API_KEY
    stripped from the environment, to prove app.config/app.db/app.models
    import cleanly with no Groq key available at all -- the exact scenario
    the old module-level `raise RuntimeError(...)` used to break.
    """
    env = os.environ.copy()
    env.pop("GROQ_API_KEY", None)
    env["DATABASE_URL"] = "sqlite:///:memory:"
    env["PYTHONPATH"] = str(BACKEND_DIR)

    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import app.config; "
            "assert app.config.GROQ_API_KEY is None, app.config.GROQ_API_KEY; "
            "import app.db; "
            "import app.models; "
            "print('IMPORT_OK')",
        ],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"stdout={result.stdout}\nstderr={result.stderr}"
    assert "IMPORT_OK" in result.stdout
