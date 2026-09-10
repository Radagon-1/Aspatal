// ============================================================================
// MedCore Health — script.js
// Handles: mobile nav, triage modal open/close, the Gradio-backed Smart
// Triage submission flow, and Firebase (Google Auth + Firestore) for
// saving triage records against the logged-in user.
// ============================================================================

// ----------------------------------------------------------------------------
// Firebase Imports & Init
// ----------------------------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDv71KplO1fhFFTyVEMpOE8cH0A5gq_6qg",
  authDomain: "medcore-health.firebaseapp.com",
  projectId: "medcore-health",
  storageBucket: "medcore-health.firebasestorage.app",
  messagingSenderId: "610795513092",
  appId: "1:610795513092:web:f2a31ba526b2b7f3361c51",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;

// ----------------------------------------------------------------------------
// Triage backend (Gradio Space) — plain REST calls, no @gradio/client.
// (That client sends credentials:'include' on its config fetch, which
// Hugging Face Spaces' CORS response doesn't allow — see earlier fix.)
// ----------------------------------------------------------------------------
const SPACE_BASE = "https://adisharm4988-sih-triage-api.hf.space";
const TRIAGE_API_NAME = "triage_patient";

async function callTriagePatient(name, age, raw_symptoms) {
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

// ----------------------------------------------------------------------------
// Elements
// ----------------------------------------------------------------------------
const backdrop = document.getElementById("triageBackdrop");
const modal = document.getElementById("triageModal");
const openButtons = [
  document.getElementById("heroTriageBtn"),
  document.getElementById("openTriageBtn"),
].filter(Boolean);
const closeBtn = document.getElementById("closeTriageBtn");

const form = document.getElementById("triageForm");
const submitBtn = document.getElementById("triageSubmitBtn");
const submitLabel = document.getElementById("triageSubmitLabel");
const errorEl = document.getElementById("triageError");

const resultEl = document.getElementById("triageResult");
const zoneEl = document.getElementById("res-zone");
const summaryEl = document.getElementById("res-summary");
const actionEl = document.getElementById("res-action");
const resetBtn = document.getElementById("triageResetBtn");

const menuToggle = document.getElementById("menuToggle");
const loginBtn = document.getElementById("navLoginBtn");
const userStatusEl = document.getElementById("navUserStatus");

let lastFocusedElement = null;

// ----------------------------------------------------------------------------
// Google Login & "Online Perchi" creation (users collection)
// ----------------------------------------------------------------------------
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;

    await setDoc(
      doc(db, "users", currentUser.uid),
      {
        uid: currentUser.uid,
        name: currentUser.displayName,
        email: currentUser.email,
        photoURL: currentUser.photoURL,
        perchiCreatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return currentUser;
  } catch (error) {
    console.error("Google Auth Error:", error);
    showError("Login fail ho gaya: " + error.message);
    return null;
  }
}

function updateAuthUI(user) {
  const nameField = document.getElementById("patientName");

  if (user) {
    if (nameField && !nameField.value) nameField.value = user.displayName || "";
    if (loginBtn) loginBtn.textContent = "Log out";
    if (userStatusEl) {
      userStatusEl.hidden = false;
      userStatusEl.textContent = user.email || user.displayName || "";
    }
  } else {
    if (loginBtn) loginBtn.textContent = "Log in";
    if (userStatusEl) {
      userStatusEl.hidden = true;
      userStatusEl.textContent = "";
    }
  }
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  updateAuthUI(user);
});

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    if (currentUser) {
      await signOut(auth);
    } else {
      await loginWithGoogle();
    }
  });
}

// ----------------------------------------------------------------------------
// Triage output → Firestore (appointments collection)
// ----------------------------------------------------------------------------
function getPriorityScore(zone) {
  const norm = String(zone || "").toLowerCase();
  if (norm.includes("critical") || norm.includes("red")) return 1;
  if (norm.includes("moderate") || norm.includes("yellow")) return 2;
  return 3; // Stable / Green
}

async function saveTriageToFirestore(patientData, triageOutput) {
  if (!currentUser) {
    const user = await loginWithGoogle();
    if (!user) return false; // login cancelled or failed
  }

  const [zone, summary, action] = triageOutput;

  try {
    await addDoc(collection(db, "appointments"), {
      uid: currentUser.uid,
      email: currentUser.email,
      patientName: patientData.name,
      age: patientData.age,
      symptoms: patientData.raw_symptoms,
      zone: zone || "",
      summary: summary || "",
      action: action || "",
      priorityScore: getPriorityScore(zone),
      status: "Pending",
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error("Firestore Save Error:", err);
    return false;
  }
}

// ----------------------------------------------------------------------------
// Modal open / close
// ----------------------------------------------------------------------------
function openTriageModal() {
  lastFocusedElement = document.activeElement;
  backdrop.hidden = false;
  requestAnimationFrame(() => {
    backdrop.classList.add("is-open");
  });
  document.body.style.overflow = "hidden";

  const firstField = document.getElementById("patientName");
  if (firstField) firstField.focus();

  document.addEventListener("keydown", onKeydown);
}

function closeTriageModal() {
  backdrop.classList.remove("is-open");
  document.body.style.overflow = "";
  document.removeEventListener("keydown", onKeydown);

  const onTransitionEnd = () => {
    backdrop.hidden = true;
    modal.removeEventListener("transitionend", onTransitionEnd);
  };
  modal.addEventListener("transitionend", onTransitionEnd);

  if (lastFocusedElement) lastFocusedElement.focus();
}

function onKeydown(event) {
  if (event.key === "Escape") {
    closeTriageModal();
    return;
  }
  if (event.key === "Tab") {
    trapFocus(event);
  }
}

function trapFocus(event) {
  const focusable = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

openButtons.forEach((btn) => btn.addEventListener("click", openTriageModal));
closeBtn.addEventListener("click", closeTriageModal);
backdrop.addEventListener("click", (event) => {
  if (event.target === backdrop) closeTriageModal();
});

// ----------------------------------------------------------------------------
// Mobile nav toggle
// ----------------------------------------------------------------------------
if (menuToggle) {
  menuToggle.addEventListener("click", () => {
    const expanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!expanded));
    document.querySelector(".navlinks")?.classList.toggle("is-open");
  });
}

// ----------------------------------------------------------------------------
// Triage submission → Gradio backend → Firestore
// ----------------------------------------------------------------------------
const ZONE_BADGE_MAP = {
  critical: "badge--critical",
  moderate: "badge--moderate",
  stable: "badge--stable",
};

function badgeClassForZone(zoneLabel) {
  const normalized = String(zoneLabel || "").trim().toLowerCase();
  return ZONE_BADGE_MAP[normalized] || "badge--moderate";
}

function setLoading(isLoading) {
  submitBtn.classList.toggle("is-loading", isLoading);
  submitBtn.disabled = isLoading;
  submitLabel.textContent = isLoading ? "Assessing…" : "Assess symptoms";
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = "";
}

function renderResult([zone, summary, action]) {
  const badgeClass = badgeClassForZone(zone);

  zoneEl.textContent = zone || "Unknown";
  zoneEl.className = `badge ${badgeClass}`;
  summaryEl.textContent = summary || "No summary returned.";
  actionEl.textContent = action || "No recommended action returned.";

  form.hidden = true;
  resultEl.hidden = false;
}

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

resetBtn.addEventListener("click", () => {
  form.reset();
  form.hidden = false;
  resultEl.hidden = true;
  clearError();
  document.getElementById("patientName").focus();
});