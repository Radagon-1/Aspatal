"""
Triage endpoint — accepts patient symptom data and uses the Groq API
(Llama model) to return a structured triage assessment.

Moved from the original single-file main.py during the repo restructuring;
logic is unchanged.
"""
import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from groq import Groq

from app.config import GROQ_API_KEY, GROQ_MODEL

router = APIRouter()

# The Groq client is constructed lazily, on first real use, not at import
# time — importing this module (and everything that imports it, including
# app.main) must succeed even when GROQ_API_KEY isn't configured, so that
# persistence tooling (Alembic, seed scripts, pytest) never needs a Groq key
# just to load the app. See app/config.py.
_groq_client = None


def get_groq_client() -> Groq:
    global _groq_client
    if _groq_client is None:
        if not GROQ_API_KEY:
            raise HTTPException(
                status_code=503,
                detail="GROQ_API_KEY is not configured on this server.",
            )
        _groq_client = Groq(api_key=GROQ_API_KEY)
    return _groq_client


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
@router.post("/triage", response_model=TriageResponse)
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
        completion = get_groq_client().chat.completions.create(
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
