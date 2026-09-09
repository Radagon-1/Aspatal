"""
Rural Healthcare Triage API
----------------------------
A single-file FastAPI service that accepts patient symptom data and uses
the Groq API (Llama model) to return a structured triage assessment.

INSTALL:
    pip install fastapi uvicorn groq pydantic

RUN:
    python main.py
    (or: uvicorn main:app --host 0.0.0.0 --port 8000 --reload)

TEST:
    curl -X POST http://127.0.0.1:8000/triage \
      -H "Content-Type: application/json" \
      -d '{"name": "Ramesh Kumar", "age": 45, "raw_symptoms": "chest pain, sweating, shortness of breath since 1 hour"}'

NOTE ON CORS:
    By default, FastAPI only registers the HTTP methods you explicitly
    define on a route (e.g. POST for /triage). It does NOT auto-handle
    the OPTIONS "preflight" request that browsers send before a
    cross-origin POST — that's what causes the "405 Method Not Allowed
    on OPTIONS" / CORS error you were seeing. Adding CORSMiddleware
    below fixes this: it intercepts OPTIONS preflight requests and
    responds to them automatically, and it adds the Access-Control-*
    headers to real responses so the browser accepts them.
"""

import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from groq import Groq

# --------------------------------------------------------------------------
# CONFIGURATION — PASTE YOUR ACTUAL GROQ API KEY BELOW
# --------------------------------------------------------------------------
GROQ_API_KEY = "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"

# Model to use for triage reasoning. Llama 3.3 70B (via Groq) is a strong,
# fast default for this kind of structured clinical-style task.
GROQ_MODEL = "openai/gpt-oss-120b"

# --------------------------------------------------------------------------
# INITIALIZE APP
# --------------------------------------------------------------------------
app = FastAPI(title="Rural Healthcare Triage API")

# --------------------------------------------------------------------------
# CORS MIDDLEWARE — must be added before any requests are handled.
# allow_origins=["*"] means ANY frontend/domain can call this API.
# allow_methods=["*"] and allow_headers=["*"] ensure preflight (OPTIONS)
# requests succeed for any method/header combination the browser sends,
# which resolves the 405 on OPTIONS you were hitting.
# NOTE: allow_credentials must stay False when allow_origins is "*" —
# browsers reject the combination of wildcard origin + credentials=True.
# --------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# The Groq client is initialized once at startup using the embedded key above.
groq_client = Groq(api_key=GROQ_API_KEY)


# --------------------------------------------------------------------------
# REQUEST / RESPONSE SCHEMAS
# --------------------------------------------------------------------------
class TriageRequest(BaseModel):
    """Incoming patient data submitted by the health worker."""
    name: str = Field(..., description="Patient's full name")
    age: int = Field(..., ge=0, le=130, description="Patient's age in years")
    raw_symptoms: str = Field(..., description="Free-text description of symptoms")


class TriageResponse(BaseModel):
    """Structured triage result returned to the client."""
    triage_zone: str
    clinical_summary: str
    recommended_action: str


# --------------------------------------------------------------------------
# SYSTEM PROMPT
# --------------------------------------------------------------------------
# This instructs the model to behave as a rural healthcare triage expert and
# to respond ONLY with a strict JSON object containing the 3 required keys.
SYSTEM_PROMPT = """You are an expert clinical triage assistant supporting a
community health worker (CHW) in a rural, low-resource setting with limited
access to doctors, labs, and emergency transport.

Given a patient's name, age, and free-text description of their symptoms,
assess the urgency of their condition and respond with a triage decision.

Use this triage scale:
- "Red": Life-threatening or emergency condition. Needs immediate referral
  to the nearest hospital/emergency care, potentially within minutes to hours.
- "Yellow": Concerning condition that needs prompt medical attention
  (within the same day, e.g. see a doctor or visit a clinic soon) but is
  not immediately life-threatening.
- "Green": Mild or non-urgent condition that can likely be managed with
  basic care, rest, home remedies, or a routine/non-urgent clinic visit.

You MUST respond with ONLY a valid JSON object and nothing else — no
preamble, no markdown, no explanation outside the JSON. The JSON object
must contain EXACTLY these 3 keys and no others:

{
  "triage_zone": "Red" | "Yellow" | "Green",
  "clinical_summary": "A crisp 2-line clinical summary for a doctor, in English.",
  "recommended_action": "The immediate next step the health worker should take."
}

Be conservative: if there is any doubt or the symptoms could indicate a
serious condition, err toward a higher triage zone (Red over Yellow,
Yellow over Green)."""


# --------------------------------------------------------------------------
# ENDPOINT
# --------------------------------------------------------------------------
@app.post("/triage", response_model=TriageResponse)
def triage_patient(request: TriageRequest):
    """
    Accepts patient details + raw symptoms, sends them to Groq (Llama model)
    for triage assessment, and returns a strict JSON response with:
    triage_zone, clinical_summary, recommended_action.
    """

    # Build the user message with patient context for the model.
    user_message = (
        f"Patient Name: {request.name}\n"
        f"Age: {request.age}\n"
        f"Reported Symptoms: {request.raw_symptoms}\n\n"
        "Provide the triage assessment as specified."
    )

    try:
        # Call the Groq chat completion API. response_format is set to
        # json_object to force strict, parseable JSON output.
        completion = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.2,  # low temperature for consistent, clinical-style output
            response_format={"type": "json_object"},
        )

        raw_content = completion.choices[0].message.content

    except Exception as e:
        # Any failure calling Groq (bad key, network issue, rate limit, etc.)
        raise HTTPException(status_code=502, detail=f"Groq API error: {str(e)}")

    # Parse the JSON string returned by the model into a Python dict.
    try:
        result = json.loads(raw_content)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail="Groq returned malformed JSON. Try again or adjust the prompt.",
        )

    # Validate that all 3 required keys are present.
    required_keys = {"triage_zone", "clinical_summary", "recommended_action"}
    if not required_keys.issubset(result.keys()):
        raise HTTPException(
            status_code=502,
            detail=f"Groq response missing required keys. Got: {list(result.keys())}",
        )

    # Normalize/validate triage_zone value defensively.
    if result["triage_zone"] not in ("Red", "Yellow", "Green"):
        raise HTTPException(
            status_code=502,
            detail=f"Invalid triage_zone value returned: {result['triage_zone']}",
        )

    return TriageResponse(
        triage_zone=result["triage_zone"],
        clinical_summary=result["clinical_summary"],
        recommended_action=result["recommended_action"],
    )


# --------------------------------------------------------------------------
# ENTRY POINT — allows running with `python main.py`
# --------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)