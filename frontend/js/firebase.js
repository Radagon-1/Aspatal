// ============================================================================
// firebase.js — Firebase init, Google Auth, and Firestore writes
// (users, appointments collections). Config/project/collections unchanged.
// ============================================================================
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

import { showError, updateAuthUI } from "./ui.js";

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

export async function logout() {
  await signOut(auth);
}

export function getCurrentUser() {
  return currentUser;
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  updateAuthUI(user);
});

// ----------------------------------------------------------------------------
// Triage output → Firestore (appointments collection)
// ----------------------------------------------------------------------------
function getPriorityScore(zone) {
  const norm = String(zone || "").toLowerCase();
  if (norm.includes("critical") || norm.includes("red")) return 1;
  if (norm.includes("moderate") || norm.includes("yellow")) return 2;
  return 3; // Stable / Green
}

export async function saveTriageToFirestore(patientData, triageOutput) {
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
