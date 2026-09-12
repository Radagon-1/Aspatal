"""
Aspatal Clinical Triage Engine
Rule-based decision support system for rural healthcare triage.
Maps patient symptoms and vitals → urgency level, recommended specialist, facility level.
"""

from pydantic import BaseModel
from typing import Optional, List


# ─── Input Schema ──────────────────────────────────────────

class Vitals(BaseModel):
    systolic: Optional[int] = None       # mmHg
    diastolic: Optional[int] = None      # mmHg
    temperature: Optional[float] = None  # °C
    heart_rate: Optional[int] = None     # bpm
    oxygen_saturation: Optional[float] = None  # %
    respiratory_rate: Optional[int] = None     # breaths/min
    weight: Optional[float] = None       # kg


class TriageInput(BaseModel):
    patient_id: Optional[str] = None
    age: int
    sex: str  # 'male', 'female', 'other'
    pregnancy_status: bool = False
    existing_conditions: List[str] = []
    current_medications: List[str] = []
    known_allergies: List[str] = []
    symptoms: List[str] = []
    vitals: Optional[Vitals] = None


# ─── Output Schema ─────────────────────────────────────────

class TriageOutput(BaseModel):
    urgency: str                # EMERGENCY | URGENT | STANDARD | NON_URGENT
    red_flags: List[str]
    suggested_facility: str     # SUB_CENTRE | PHC | CHC | RURAL_HOSPITAL | DISTRICT_HOSPITAL | TERTIARY
    recommended_specialist: Optional[str]
    recommendations: List[str]
    confidence: float
    source: str = "triage_engine_v1"


# ─── Triage Logic ──────────────────────────────────────────

# Symptom → urgency map
EMERGENCY_SYMPTOMS = [
    "chest pain", "difficulty breathing", "shortness of breath", "unconscious",
    "seizure", "stroke", "severe bleeding", "heart attack", "anaphylaxis",
    "severe head injury", "poisoning", "choking", "cardiac arrest",
    "major trauma", "severe allergic reaction",
]

URGENT_SYMPTOMS = [
    "high fever", "vomiting blood", "blood in stool", "severe abdominal pain",
    "head injury", "fracture", "deep wound", "severe pain", "dehydration",
    "severe diarrhea", "severe vomiting", "difficulty swallowing",
    "eye injury", "burns", "severe headache", "altered consciousness",
    "new weakness", "sudden vision loss", "infant fever",
]

# Condition → specialist map
CONDITION_SPECIALIST_MAP = {
    "diabetes": "Endocrinologist",
    "hypertension": "Cardiologist",
    "heart": "Cardiologist",
    "chest pain": "Cardiologist",
    "respiratory": "Pulmonologist",
    "breathing": "Pulmonologist",
    "asthma": "Pulmonologist",
    "pregnancy": "Gynecologist",
    "maternal": "Gynecologist",
    "child": "Pediatrician",
    "infant": "Pediatrician",
    "neonate": "Neonatologist",
    "eye": "Ophthalmologist",
    "skin": "Dermatologist",
    "bone": "Orthopedician",
    "fracture": "Orthopedician",
    "mental": "Psychiatrist",
    "depression": "Psychiatrist",
    "kidney": "Nephrologist",
    "liver": "Gastroenterologist",
    "stomach": "Gastroenterologist",
    "cancer": "Oncologist",
    "tumor": "Oncologist",
    "neuro": "Neurologist",
    "seizure": "Neurologist",
    "stroke": "Neurologist",
    "ear": "ENT Specialist",
    "throat": "ENT Specialist",
    "nose": "ENT Specialist",
}


def _check_vital_red_flags(vitals: Vitals) -> tuple[list, str]:
    """Check vitals for red flags and return (red_flags, urgency)."""
    red_flags = []
    urgency = "NON_URGENT"

    if vitals is None:
        return red_flags, urgency

    if vitals.oxygen_saturation is not None:
        if vitals.oxygen_saturation < 90:
            red_flags.append(f"Critically low SpO2: {vitals.oxygen_saturation}% (<90%) — risk of hypoxia")
            urgency = "EMERGENCY"
        elif vitals.oxygen_saturation < 94:
            red_flags.append(f"Low SpO2: {vitals.oxygen_saturation}% (<94%)")
            urgency = max(urgency, "URGENT", key=["NON_URGENT", "STANDARD", "URGENT", "EMERGENCY"].index)

    if vitals.systolic is not None:
        if vitals.systolic >= 180:
            red_flags.append(f"Hypertensive crisis: BP {vitals.systolic}/{vitals.diastolic or '?'} mmHg")
            urgency = "EMERGENCY"
        elif vitals.systolic >= 140:
            red_flags.append(f"High blood pressure: {vitals.systolic}/{vitals.diastolic or '?'} mmHg")
        elif vitals.systolic < 90:
            red_flags.append(f"Hypotension: BP {vitals.systolic}/{vitals.diastolic or '?'} mmHg — possible shock")
            urgency = "EMERGENCY"

    if vitals.temperature is not None:
        if vitals.temperature >= 40.0:
            red_flags.append(f"Dangerously high fever: {vitals.temperature}°C (≥40°C)")
            urgency = "EMERGENCY" if urgency != "EMERGENCY" else urgency
        elif vitals.temperature >= 38.5:
            red_flags.append(f"High fever: {vitals.temperature}°C")
            if urgency not in ("EMERGENCY",):
                urgency = "URGENT"
        elif vitals.temperature < 36.0:
            red_flags.append(f"Hypothermia: {vitals.temperature}°C (<36°C)")
            if urgency not in ("EMERGENCY",):
                urgency = "URGENT"

    if vitals.heart_rate is not None:
        if vitals.heart_rate > 150 or vitals.heart_rate < 40:
            red_flags.append(f"Dangerous heart rate: {vitals.heart_rate} bpm")
            urgency = "EMERGENCY"
        elif vitals.heart_rate > 100:
            red_flags.append(f"Tachycardia: {vitals.heart_rate} bpm")
        elif vitals.heart_rate < 60:
            red_flags.append(f"Bradycardia: {vitals.heart_rate} bpm")

    if vitals.respiratory_rate is not None:
        if vitals.respiratory_rate > 30 or vitals.respiratory_rate < 8:
            red_flags.append(f"Abnormal respiratory rate: {vitals.respiratory_rate} breaths/min")
            if urgency not in ("EMERGENCY",):
                urgency = "URGENT"

    return red_flags, urgency


def _check_symptom_urgency(symptoms: list[str]) -> tuple[str, list]:
    """Check symptoms and return (urgency, matched_symptoms)."""
    symptoms_lower = [s.lower() for s in symptoms]
    matched = []
    urgency = "NON_URGENT"

    for symptom in symptoms_lower:
        for emergency in EMERGENCY_SYMPTOMS:
            if emergency in symptom or symptom in emergency:
                matched.append(symptom)
                urgency = "EMERGENCY"
                break
        if urgency != "EMERGENCY":
            for urgent in URGENT_SYMPTOMS:
                if urgent in symptom or symptom in urgent:
                    matched.append(symptom)
                    if urgency != "EMERGENCY":
                        urgency = "URGENT"
                    break

    if not matched and symptoms:
        urgency = "STANDARD"

    return urgency, matched


def _suggest_specialist(symptoms: list[str], existing_conditions: list[str], age: int,
                         sex: str, pregnancy: bool) -> Optional[str]:
    """Suggest a specialist based on symptoms and conditions."""
    combined = " ".join(symptoms + existing_conditions).lower()

    if pregnancy or (sex == "female" and any(k in combined for k in ["pregnancy", "maternal", "obstetric"])):
        return "Gynecologist"

    if age < 5:
        return "Pediatrician"

    for keyword, specialist in CONDITION_SPECIALIST_MAP.items():
        if keyword in combined:
            return specialist

    return "General Physician"


def _suggest_facility(urgency: str, age: int) -> str:
    """Map urgency to appropriate facility level."""
    mapping = {
        "EMERGENCY": "DISTRICT_HOSPITAL",
        "URGENT": "RURAL_HOSPITAL",
        "STANDARD": "PHC" if age > 5 else "RURAL_HOSPITAL",
        "NON_URGENT": "SUB_CENTRE",
    }
    return mapping.get(urgency, "PHC")


def _build_recommendations(urgency: str, red_flags: list, pregnancy: bool, age: int) -> list[str]:
    """Generate plain-language recommendations."""
    recs = []

    if urgency == "EMERGENCY":
        recs.append("⚠️ IMMEDIATE attention required — proceed to Emergency department")
        recs.append("Do not delay — call emergency services if transport is unavailable")
    elif urgency == "URGENT":
        recs.append("Seek medical care within 1–2 hours")
        recs.append("Avoid eating or drinking until assessed by a doctor")
    elif urgency == "STANDARD":
        recs.append("Schedule a consultation within 24–48 hours")
        recs.append("Monitor symptoms and seek immediate care if they worsen")
    else:
        recs.append("Home care with rest and adequate hydration")
        recs.append("Follow up with local ASHA worker or PHC if symptoms persist beyond 3 days")

    if pregnancy:
        recs.append("Pregnant patient — ensure obstetric care is available at the facility")

    if age < 5:
        recs.append("Child under 5 — monitor for dehydration, rapid breathing, and feeding difficulties")

    if age > 65:
        recs.append("Elderly patient — monitor for confusion, falls, or rapid deterioration")

    return recs


# ─── Main Entry ────────────────────────────────────────────

def run_triage(payload: TriageInput) -> TriageOutput:
    """
    Main triage function. Runs all checks and returns a TriageOutput.
    """
    red_flags = []

    # 1. Vital signs check
    vital_red_flags, vital_urgency = _check_vital_red_flags(payload.vitals)
    red_flags.extend(vital_red_flags)

    # 2. Symptom urgency check
    symptom_urgency, _ = _check_symptom_urgency(payload.symptoms)

    # 3. Merge — take the highest urgency
    urgency_order = ["NON_URGENT", "STANDARD", "URGENT", "EMERGENCY"]
    urgency = urgency_order[max(urgency_order.index(vital_urgency), urgency_order.index(symptom_urgency))]

    # 4. Age/pregnancy modifiers
    if urgency == "NON_URGENT" and (payload.age < 5 or payload.age > 70 or payload.pregnancy_status):
        urgency = "STANDARD"

    # 5. Specialist recommendation
    specialist = _suggest_specialist(
        payload.symptoms, payload.existing_conditions,
        payload.age, payload.sex, payload.pregnancy_status
    )

    # 6. Facility suggestion
    facility = _suggest_facility(urgency, payload.age)

    # 7. Recommendations
    recommendations = _build_recommendations(urgency, red_flags, payload.pregnancy_status, payload.age)

    # 8. Confidence — higher when we have vitals
    confidence = 0.90 if payload.vitals else 0.75

    return TriageOutput(
        urgency=urgency,
        red_flags=red_flags,
        suggested_facility=facility,
        recommended_specialist=specialist,
        recommendations=recommendations,
        confidence=confidence,
    )
