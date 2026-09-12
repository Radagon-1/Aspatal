"""
Aspatal Backend — FastAPI app entrypoint.
----------------------------------------
Exposes POST /triage (legacy, Groq-backed triage assessment, unchanged) and
the /api/* referral care-coordination routes (Phase 6): patients, facilities,
referrals, follow-ups. Auth is a later phase -- see app/deps.py.

INSTALL:
    pip install -r backend/requirements.txt

CONFIGURE:
    Copy backend/.env.example to backend/.env and set GROQ_API_KEY.

RUN (from the backend/ directory):
    uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

TEST:
    curl -X POST http://127.0.0.1:8000/triage \
      -H "Content-Type: application/json" \
      -d '{"name": "Ramesh Kumar", "age": 45, "raw_symptoms": "chest pain, sweating, shortness of breath since 1 hour"}'

NOTE ON CORS:
    By default, FastAPI only registers the HTTP methods you explicitly
    define on a route (e.g. POST for /triage). It does NOT auto-handle
    the OPTIONS "preflight" request that browsers send before a
    cross-origin POST — that's what causes a "405 Method Not Allowed on
    OPTIONS" / CORS error. Adding CORSMiddleware below fixes this: it
    intercepts OPTIONS preflight requests and responds to them
    automatically, and it adds the Access-Control-* headers to real
    responses so the browser accepts them.
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers import assessments, facilities, follow_ups, patients, referrals, triage
from app.services.referral_workflow import WorkflowError

app = FastAPI(title="Rural Healthcare Triage API")


# --------------------------------------------------------------------------
# Domain error -> HTTP mapping, in one place. The workflow service raises
# plain WorkflowError subclasses (HTTP-agnostic on purpose); this is the
# only place that translates them into responses, so no router needs a
# try/except around every call into app.services.referral_workflow.
# --------------------------------------------------------------------------
@app.exception_handler(WorkflowError)
async def workflow_error_handler(request: Request, exc: WorkflowError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
    # Defense in depth: a stray ValueError (e.g. an ORM-level @validates
    # check) should never leak a stack trace to the client, even though
    # Pydantic request validation is expected to catch these first.
    return JSONResponse(status_code=400, content={"detail": str(exc)})

# --------------------------------------------------------------------------
# CORS MIDDLEWARE — must be added before any requests are handled.
# allow_origins=["*"] means ANY frontend/domain can call this API.
# NOTE: allow_credentials must stay False when allow_origins is "*" —
# browsers reject the combination of wildcard origin + credentials=True.
# Tighten allow_origins once a real deploy target exists.
# --------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(triage.router)
app.include_router(patients.router, prefix="/api")
app.include_router(assessments.router, prefix="/api")
app.include_router(facilities.router, prefix="/api")
app.include_router(referrals.router, prefix="/api")
app.include_router(follow_ups.router, prefix="/api")


# --------------------------------------------------------------------------
# ENTRY POINT — allows running with `python -m app.main` as an alternative
# to the uvicorn CLI command above.
# --------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
