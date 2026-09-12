import prisma from '../config/db.js';
import { env } from '../config/env.js';

/**
 * Proxy to Python FastAPI triage engine.
 * Falls back to a lightweight local rules engine if the Python service is unavailable.
 */
export async function runTriage(req, res, next) {
  try {
    const payload = req.body;

    let triageResult;

    // Try Python engine first
    try {
      const response = await fetch(`${env.TRIAGE_ENGINE_URL}/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000), // 5s timeout
      });

      if (response.ok) {
        triageResult = await response.json();
      } else {
        throw new Error('Triage engine returned error');
      }
    } catch {
      // Fallback: local rules engine
      triageResult = localRulesEngine(payload);
    }

    // Persist triage record if patientId provided
    if (payload.patientId) {
      await prisma.triageRecord.create({
        data: {
          patientId: payload.patientId,
          symptoms: payload.symptoms || [],
          vitalsSystolic: payload.vitals?.systolic,
          vitalsDiastolic: payload.vitals?.diastolic,
          vitalsTemperature: payload.vitals?.temperature,
          vitalsHeartRate: payload.vitals?.heartRate,
          vitalsOxygen: payload.vitals?.oxygenSaturation,
          urgency: triageResult.urgency,
          recommendedSpecialist: triageResult.recommended_specialist,
          suggestedFacility: triageResult.suggested_facility,
          redFlags: triageResult.red_flags || [],
          aiConfidence: triageResult.confidence,
        },
      });
    }

    res.json(triageResult);
  } catch (err) { next(err); }
}

export async function getTriageHistory(req, res, next) {
  try {
    const records = await prisma.triageRecord.findMany({
      where: { patientId: req.params.patientId },
      orderBy: { triageDate: 'desc' },
      take: 10,
    });
    res.json(records);
  } catch (err) { next(err); }
}

/**
 * Local fallback rules engine (subset of Python engine logic)
 */
function localRulesEngine(payload) {
  const { age, symptoms = [], vitals = {}, existingConditions = [] } = payload;
  const redFlags = [];
  let urgency = 'STANDARD';

  // Red flag vitals
  if (vitals.oxygenSaturation && vitals.oxygenSaturation < 90) {
    redFlags.push('Critically low oxygen saturation (<90%)');
    urgency = 'EMERGENCY';
  }
  if (vitals.systolic && vitals.systolic > 180) {
    redFlags.push('Hypertensive crisis (BP >180 mmHg)');
    urgency = 'EMERGENCY';
  }
  if (vitals.temperature && vitals.temperature > 39.5) {
    redFlags.push('High fever (>39.5°C)');
    urgency = urgency === 'EMERGENCY' ? 'EMERGENCY' : 'URGENT';
  }
  if (vitals.heartRate && vitals.heartRate > 120) {
    redFlags.push('Tachycardia (HR >120 bpm)');
    urgency = urgency === 'EMERGENCY' ? 'EMERGENCY' : 'URGENT';
  }

  // Emergency symptoms
  const emergencySymptoms = ['chest pain', 'difficulty breathing', 'unconscious', 'seizure', 'stroke'];
  const urgentSymptoms = ['high fever', 'severe pain', 'vomiting blood', 'head injury'];

  if (symptoms.some(s => emergencySymptoms.some(e => s.toLowerCase().includes(e)))) {
    urgency = 'EMERGENCY';
  } else if (urgency !== 'EMERGENCY' && symptoms.some(s => urgentSymptoms.some(u => s.toLowerCase().includes(u)))) {
    urgency = 'URGENT';
  }

  // Age-based adjustments
  if ((age < 5 || age > 65) && urgency === 'STANDARD') {
    urgency = 'URGENT';
  }

  const suggestedFacility = urgency === 'EMERGENCY' ? 'DISTRICT_HOSPITAL' :
    urgency === 'URGENT' ? 'RURAL_HOSPITAL' : 'PHC';

  return {
    urgency,
    red_flags: redFlags,
    suggested_facility: suggestedFacility,
    recommended_specialist: null,
    confidence: 0.7,
    source: 'local_fallback',
  };
}
