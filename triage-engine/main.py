from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from engine import run_triage, TriageInput

app = FastAPI(
    title="Aspatal Triage Engine",
    description="Clinical rule-based decision support for rural healthcare triage (SIH PS 26133)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "aspatal-triage-engine"}


@app.post("/triage")
def triage(payload: TriageInput):
    result = run_triage(payload)
    return result
