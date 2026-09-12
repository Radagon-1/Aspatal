"""
Tests 1-2: the Alembic migration itself, run against a genuinely empty
database via the real `alembic upgrade head` command -- not just
Base.metadata.create_all() (which every other test file uses for speed,
since those tests exercise model/constraint behavior, not the migration).
"""
import os
import sqlite3
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2] / "backend"

EXPECTED_TABLES = {
    "users",
    "role_assignments",
    "patients",
    "facilities",
    "facility_services",
    "assessments",
    "referrals",
    "referral_events",
    "consultation_outcomes",
    "follow_ups",
    "processed_operations",
    "alembic_version",
}


def test_alembic_upgrade_head_succeeds_from_empty_database(tmp_path):
    db_path = tmp_path / "migration_test.db"
    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite:///{db_path}"

    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"stdout={result.stdout}\nstderr={result.stderr}"

    conn = sqlite3.connect(db_path)
    tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    conn.close()

    assert EXPECTED_TABLES.issubset(tables), f"missing: {EXPECTED_TABLES - tables}"
