// ============================================================================
// main.js — application bootstrap. Wires the two listeners that coordinate
// across modules (triage form submit, login button); everything self-
// contained within one module (pure modal/nav UI, pure Firebase) wires its
// own listeners at import time in its own file.
// ============================================================================
import { loginWithGoogle, logout, getCurrentUser, saveTriageToFirestore } from "./firebase.js";
import { callTriagePatient } from "./triage-api.js";
import { renderResult, showError, clearError, setLoading } from "./ui.js";

const form = document.getElementById("triageForm");
const loginBtn = document.getElementById("navLoginBtn");

// ----------------------------------------------------------------------------
// Login button
// ----------------------------------------------------------------------------
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    if (getCurrentUser()) {
      await logout();
    } else {
      await loginWithGoogle();
    }
  });
}

// ----------------------------------------------------------------------------
// Triage submission → Gradio backend → Firestore
// ----------------------------------------------------------------------------
async function handleTriageSubmit(event) {
  event.preventDefault();
  clearError();

  const name = document.getElementById("patientName").value.trim();
  const age = Number(document.getElementById("patientAge").value);
  const raw_symptoms = document.getElementById("rawSymptoms").value.trim();

  if (!name || !raw_symptoms || Number.isNaN(age)) {
    showError("Please fill in your name, age and symptoms before continuing.");
    return;
  }

  setLoading(true);

  try {
    const data = await callTriagePatient(name, age, raw_symptoms);
    const result = Array.isArray(data) ? data : [];

    // Show the AI result to the user immediately...
    renderResult(result);

    // ...then persist it, prompting Google login first if needed.
    const saved = await saveTriageToFirestore({ name, age, raw_symptoms }, result);
    if (!saved) {
      showError(
        "Result dikh raha hai, par record save nahi ho paaya. Login karke dobara try karein."
      );
    }
  } catch (err) {
    console.error("Triage request failed:", err);
    showError(
      "We couldn't reach the triage service right now. Please try again in a moment."
    );
  } finally {
    setLoading(false);
  }
}

form.addEventListener("submit", handleTriageSubmit);
