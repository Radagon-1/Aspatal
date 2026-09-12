# Aspatal — Implementation Roadmap

> **SIH 2025 · PS 26133** — Rural Healthcare Access Platform  
> Last updated: September 2025

---

## ✅ Phase 1 — Backend Foundation (COMPLETE)

### Database & Config
- [x] PostgreSQL schema via Prisma ORM
  - User, Patient, Doctor, Hospital, HospitalAdmin, AshaWorker
  - Visit, Admission, Bed, Referral, FollowUp, Appointment
  - Medicine, Machine, Pharmacy, TriageRecord, AshaVisit
  - RefreshToken (JWT rotation)
  - Role enum: `ADMIN`, `HOSPITAL_ADMIN`, `DOCTOR`, `ASHA_WORKER`, `PATIENT`
- [x] Prisma client config (`db.js`)
- [x] Environment validation with Zod (`env.js`)
- [x] DB seed with demo data (admin + hospital + doctor + ASHA + beds + medicines)

### Auth System
- [x] JWT access + refresh token pair (rotating refresh)
- [x] Passport.js — JWT strategy + Google OAuth 2.0
- [x] Phone OTP (in-memory store; Redis-ready)
- [x] Role-based access control middleware (`authorize(...roles)`)
- [x] Admin-specific login endpoint

### Middleware & Utils
- [x] Error handler (`errorHandler.js`) with Prisma error mapping
- [x] Zod validation middleware (`validate.js`)
- [x] Token utilities (`token.js`)
- [x] OTP utilities (`otp.js`) — stubbed for Twilio/MSG91
- [x] Pagination utility (`pagination.js`)

### Server Setup
- [x] Express 5 server with Helmet, CORS, Morgan, Rate Limiting
- [x] All routes mounted at `/api/*`
- [x] Teleconsultation scalability hook (commented, ready to mount)

---

## ✅ Phase 2 — API Routes & Controllers (COMPLETE)

| Module | Routes File | Controller | Status |
|---|---|---|---|
| Auth | `auth.routes.js` | `auth.controller.js` | ✅ |
| Hospitals | `hospital.routes.js` | `hospital.controller.js` | ✅ |
| Doctors | `doctor.routes.js` | `doctor.controller.js` | ✅ |
| Patients | `patient.routes.js` | `patient.controller.js` | ✅ |
| Visits | `visit.routes.js` | `visit.controller.js` | ✅ |
| Admissions | `admission.routes.js` | `admission.controller.js` | ✅ |
| Beds | `bed.routes.js` | `bed.controller.js` | ✅ |
| Referrals | `referral.routes.js` | `referral.controller.js` | ✅ |
| Follow-ups | `followup.routes.js` | `followup.controller.js` | ✅ |
| Appointments | `appointment.routes.js` | `appointment.controller.js` | ✅ |
| Inventory | `inventory.routes.js` | `inventory.controller.js` | ✅ |
| Triage | `triage.routes.js` | `triage.controller.js` | ✅ |
| ASHA Worker | `asha.routes.js` | `asha.controller.js` | ✅ |
| Dashboard | `dashboard.routes.js` | `dashboard.controller.js` | ✅ |

**Key implementation details:**
- Admissions use Prisma transactions (atomic bed OCCUPIED/AVAILABLE updates)
- Referrals enforce a strict state machine (invalid transitions rejected with 400)
- Appointments auto-generate token numbers per doctor per day
- Triage proxies to Python engine with local rules fallback (5s timeout)
- ASHA visits support bulk upsert sync from offline clients

---

## ✅ Phase 3 — Python Triage Engine (COMPLETE)

**Location:** `triage-engine/`

- [x] FastAPI app (`main.py`) with CORS
- [x] Pydantic input/output schemas (`TriageInput`, `TriageOutput`)
- [x] Clinical rules engine (`engine.py`):
  - Vital sign red-flag detection (SpO2, BP, HR, temp, RR)
  - Symptom urgency mapping (EMERGENCY / URGENT / STANDARD / NON_URGENT)
  - Age & pregnancy modifier rules
  - Specialist recommendation via keyword map (20+ specializations)
  - Facility suggestion per urgency level
  - Plain-language recommendation generation
  - Confidence score (0.90 with vitals, 0.75 without)
- [x] Local fallback rules engine in `triage.controller.js` (Node.js)
- [x] Health check endpoint (`GET /health`)

---

## ✅ Phase 4 — Frontend (COMPLETE)

**Stack:** React + Vite, Vanilla CSS (no Tailwind), Lucide Icons, Axios

### Design System (`index.css`)
- [x] Dark-mode navy theme (`#080d18` bg, `#00d9a6` primary teal)
- [x] Inter + Outfit fonts (Google Fonts)
- [x] CSS design tokens (colors, radii, shadows, typography)
- [x] Glassmorphism cards, stat cards, badges
- [x] Premium button variants (primary, secondary, ghost, danger)
- [x] Responsive grid (2/3/4 col), mobile collapse at 768px
- [x] Color-coded bed status, referral status, urgency levels

### Pages Implemented

| Page | Route | Status |
|---|---|---|
| Landing | `/` | ✅ Hero, feature grid, stats strip |
| Login | `/login` | ✅ Email / Phone OTP / Admin tabs + Google OAuth |
| Dashboard | `/dashboard` | ✅ System stats (admin) + hospital KPIs + bed bars + alerts |
| Patients List | `/patients` | ✅ Searchable, paginated, high-risk badges |
| Patient Detail | `/patients/:id` | ✅ Tabbed — visits, admissions, referrals, follow-ups, triage |
| New Patient | `/patients/new` | ✅ Full registration form with tag selectors |
| New Visit | `/visits/new` | ✅ Symptom picker, vitals, diagnosis, prescriptions |
| Bed Management | `/beds` | ✅ Color-coded ward grid, inline status update |
| Referrals | `/referrals` | ✅ Progress bar state machine, one-click advance |
| Appointments | `/appointments` | ✅ Token queue, check-in/start/complete flow |
| Triage | `/triage` | ✅ Symptom + vitals form → urgency result card |
| ASHA Portal | `/asha` | ✅ Offline IndexedDB, online/offline status, sync button |
| Inventory | `/inventory` | ✅ Medicines (low-stock warning), machines, pharmacy |
| Admin Panel | `/admin` | ✅ System stats, referral breakdown, hospitals table |

### Infrastructure
- [x] Axios client with JWT Bearer + auto-refresh on 401 (`lib/api.js`)
- [x] Auth context with login/adminLogin/register/logout (`context/AuthContext.jsx`)
- [x] Protected routes with role guard (`App.jsx`)
- [x] Sidebar layout with role-conditional nav items

---

## ✅ Phase 5 — Documentation (COMPLETE)

- [x] `doc.md` — Full API reference (all 14 route groups, schemas, error codes, pagination, setup)
- [x] `readme.md` — Project overview, feature table, structure, quick start, demo credentials
- [x] `implementation.md` (this file) — Phase-by-phase implementation roadmap

---

## 🔜 Phase 6 — Production & Deployment (NEXT)

### Immediate TODOs before deploy

- [ ] Copy `.env.example` → `.env` in both `backend/` and `frontend/`, fill values
- [ ] Provision PostgreSQL (Supabase / Railway recommended)
- [ ] Run `npm run db:push && npm run db:seed` against production DB
- [ ] Deploy triage engine to Railway/Render (Python)
- [ ] Deploy backend to Railway/Render (Node.js)
- [ ] Deploy frontend to Vercel (set `VITE_API_URL` env var)

### OTP Integration
- [ ] Replace OTP stub in `backend/src/utils/otp.js` with Twilio or MSG91
- [ ] Add Redis for production OTP store (replace in-memory Map)

### Teleconsultation (Future)
- [ ] Mount `teleconsultation.routes.js` at `/api/teleconsultation`
- [ ] Integrate WebRTC via Daily.co, Agora, or Jitsi
- [ ] Add `VideoSession` Prisma model for session tracking

### Optional Enhancements
- [ ] SMS notification on referral status change
- [ ] Push notifications for upcoming follow-ups
- [ ] ABHA (Ayushman Bharat Health Account) ID integration
- [ ] Multilingual UI (Hindi, Marathi) via i18n
- [ ] PWA manifest for installable ASHA app

---

## Architecture Overview

```
Browser (React)
     │ HTTPS
     ▼
Express API (:5000) ──────────────► PostgreSQL
     │                                (Prisma)
     │ HTTP (internal)
     ▼
Python Triage Engine (:8000)
     (FastAPI, rule-based)
```

**Auth flow:**
1. User authenticates → receives `accessToken` (15min) + `refreshToken` (7d)
2. Axios interceptor attaches `accessToken` to all requests
3. On 401 → interceptor auto-calls `/auth/refresh-token` → rotates both tokens
4. Logout revokes `refreshToken` from DB

**Offline ASHA flow:**
1. Visits created offline → stored in browser IndexedDB
2. On reconnect → `POST /asha/visits/sync` bulk-upserts all pending records
3. UI shows pending count and sync button when offline records exist
