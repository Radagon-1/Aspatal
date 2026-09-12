"""
Backend environment configuration.

Loads settings from backend/.env (via python-dotenv locally; real environment
variables in any deployed environment). Never hardcode secrets here — copy
backend/.env.example to backend/.env instead.

Importing this module must never fail or make a network call: persistence
tooling (Alembic, seed scripts, pytest) imports it transitively and must work
even in an environment where GROQ_API_KEY isn't configured. Groq-dependent
code is responsible for validating GROQ_API_KEY itself, at the point it's
actually used — see app/routers/triage.py's get_groq_client().
"""
import os

from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

# Persistence (Phase 5). SQLite by default for local dev/demo; swapping to
# Postgres for a hosted deploy is a DATABASE_URL change only — no model or
# service code depends on which one is in use.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
