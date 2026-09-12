// ============================================================================
// triage-api.js — Hugging Face / Gradio triage backend client.
// Plain REST calls, no @gradio/client (that client sends credentials:'include'
// on its config fetch, which Hugging Face Spaces' CORS response doesn't allow).
// NOTE: intentionally still points at the Gradio Space, not the local FastAPI
// backend — switching that over is a later, separate phase.
// ============================================================================
const SPACE_BASE = "https://adisharm4988-sih-triage-api.hf.space";
const TRIAGE_API_NAME = "triage_patient";

export async function callTriagePatient(name, age, raw_symptoms) {
  const submitRes = await fetch(`${SPACE_BASE}/gradio_api/call/${TRIAGE_API_NAME}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [name, age, raw_symptoms] }),
  });

  if (!submitRes.ok) {
    throw new Error(`Triage submit failed: ${submitRes.status} ${submitRes.statusText}`);
  }

  const { event_id } = await submitRes.json();
  if (!event_id) {
    throw new Error("Triage submit did not return an event_id.");
  }

  const eventRes = await fetch(`${SPACE_BASE}/gradio_api/call/${TRIAGE_API_NAME}/${event_id}`);
  if (!eventRes.ok || !eventRes.body) {
    throw new Error(`Triage result stream failed: ${eventRes.status} ${eventRes.statusText}`);
  }

  const reader = eventRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "null") continue;
      try {
        result = JSON.parse(payload);
      } catch {
        // Ignore malformed/incomplete SSE chunks; keep waiting for a full one.
      }
    }
  }

  if (!result) {
    throw new Error("Triage service returned no result.");
  }

  return result; // expected shape: [zone, summary, action]
}
