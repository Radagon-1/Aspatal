// ============================================================================
// ui.js — triage modal (open/close/focus-trap), result rendering, mobile nav,
// and the small DOM-update helpers (loading state, error display, auth status
// display) shared by firebase.js and main.js.
//
// Self-contained: wires its own internal, non-coordinating listeners (modal
// open/close, backdrop click, Escape/focus-trap, mobile nav toggle, reset
// button) at module load. Exports only what firebase.js/main.js actually
// need to call.
// ============================================================================

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
// Auth status display (called by firebase.js on auth state change)
// ----------------------------------------------------------------------------
export function updateAuthUI(user) {
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
// Triage result rendering + form state helpers
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

export function setLoading(isLoading) {
  submitBtn.classList.toggle("is-loading", isLoading);
  submitBtn.disabled = isLoading;
  submitLabel.textContent = isLoading ? "Assessing…" : "Assess symptoms";
}

export function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

export function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = "";
}

export function renderResult([zone, summary, action]) {
  const badgeClass = badgeClassForZone(zone);

  zoneEl.textContent = zone || "Unknown";
  zoneEl.className = `badge ${badgeClass}`;
  summaryEl.textContent = summary || "No summary returned.";
  actionEl.textContent = action || "No recommended action returned.";

  form.hidden = true;
  resultEl.hidden = false;
}

resetBtn.addEventListener("click", () => {
  form.reset();
  form.hidden = false;
  resultEl.hidden = true;
  clearError();
  document.getElementById("patientName").focus();
});
