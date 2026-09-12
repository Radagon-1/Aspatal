# Aspatal API Documentation

> **Base URL:** `http://localhost:5000/api`  
> **Auth:** Bearer JWT token in `Authorization` header  
> **Format:** JSON request/response bodies

---

## Authentication

All protected endpoints require:
```
Authorization: Bearer <accessToken>
```

### Roles & Permissions

| Role | Description |
|---|---|
| `ADMIN` | Super admin — full access to all endpoints |
| `HOSPITAL_ADMIN` | Manages a specific hospital |
| `DOCTOR` | Creates visits, views patients |
| `ASHA_WORKER` | Logs household visits, offline sync |
| `PATIENT` | Views own records only |

---

## Auth Routes (`/api/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register new user (patient/doctor/admin) |
| POST | `/auth/login` | Public | Email/phone + password login |
| POST | `/auth/admin/login` | Public | Admin-only login endpoint |
| GET | `/auth/google` | Public | Initiate Google OAuth flow |
| GET | `/auth/google/callback` | Public | Google OAuth callback (redirects with tokens) |
| POST | `/auth/phone/send-otp` | Public | Send OTP to phone number |
| POST | `/auth/phone/verify-otp` | Public | Verify OTP → returns JWT tokens |
| POST | `/auth/refresh-token` | Public | Rotate access token using refresh token |
| POST | `/auth/logout` | 🔒 Any | Revoke refresh token |
| GET | `/auth/me` | 🔒 Any | Get current authenticated user's profile |

### Request Bodies

#### `POST /auth/register`
```json
{
  "email": "user@example.com",
  "phone": "+919876543210",
  "password": "securepassword",
  "role": "PATIENT",
  "name": "Ramesh Kumar"
}
```
> Either `email` or `phone` required.

#### `POST /auth/login`
```json
{ "email": "user@example.com", "password": "securepassword" }
```

#### `POST /auth/admin/login`
```json
{ "email": "admin@aspatal.in", "password": "admin123" }
```

#### `POST /auth/phone/send-otp`
```json
{ "phone": "+919876543210" }
```

#### `POST /auth/phone/verify-otp`
```json
{ "phone": "+919876543210", "otp": "123456" }
```

#### `POST /auth/refresh-token`
```json
{ "refreshToken": "<refreshToken>" }
```

#### Response (login/register/OTP verify)
```json
{
  "user": { "id": "...", "email": "...", "role": "PATIENT", "isActive": true },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

---

## Hospital Routes (`/api/hospitals`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/hospitals` | Public | List hospitals (paginated, filterable) |
| GET | `/hospitals/search?q=&facilityLevel=` | Public | Search hospitals |
| GET | `/hospitals/:id` | Public | Get hospital details + available doctors |
| GET | `/hospitals/:id/dashboard` | 🔒 ADMIN, HOSPITAL_ADMIN | Hospital dashboard stats |
| POST | `/hospitals` | 🔒 ADMIN | Create hospital |
| PUT | `/hospitals/:id` | 🔒 ADMIN, HOSPITAL_ADMIN | Update hospital |
| DELETE | `/hospitals/:id` | 🔒 ADMIN | Soft-delete (deactivate) hospital |

### Query Params (`GET /hospitals`)
| Param | Type | Example |
|---|---|---|
| `state` | string | `Maharashtra` |
| `district` | string | `Nagpur` |
| `facilityLevel` | enum | `PHC`, `CHC`, `RURAL_HOSPITAL`, `DISTRICT_HOSPITAL` |
| `page` | number | `1` |
| `limit` | number | `20` |

---

## Doctor Routes (`/api/doctors`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/doctors` | Public | List doctors (filterable by hospital, availability) |
| GET | `/doctors/:id` | Public | Get doctor profile |
| GET | `/doctors/hospital/:hospitalId` | Public | All doctors at a hospital |
| GET | `/doctors/specialization/:spec` | Public | Available doctors by specialization |
| POST | `/doctors` | 🔒 ADMIN, HOSPITAL_ADMIN | Register doctor |
| PUT | `/doctors/:id` | 🔒 ADMIN, HOSPITAL_ADMIN, DOCTOR | Update doctor profile |
| PATCH | `/doctors/:id/availability` | 🔒 ADMIN, HOSPITAL_ADMIN, DOCTOR | Toggle availability |
| DELETE | `/doctors/:id` | 🔒 ADMIN, HOSPITAL_ADMIN | Remove doctor |

---

## Patient Routes (`/api/patients`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/patients` | 🔒 All roles | List patients (paginated) |
| GET | `/patients/search?q=` | 🔒 All roles | Search by name/phone/email |
| GET | `/patients/high-risk` | 🔒 ADMIN, HOSPITAL_ADMIN, DOCTOR | Get high-risk patients |
| GET | `/patients/:id` | 🔒 Any | Get patient details |
| GET | `/patients/:id/history` | 🔒 Any | Full longitudinal history (visits, admissions, referrals, follow-ups, triage) |
| POST | `/patients` | 🔒 Any | Register patient |
| PUT | `/patients/:id` | 🔒 ADMIN, HOSPITAL_ADMIN, DOCTOR, ASHA_WORKER | Update patient |

---

## Visit Routes (`/api/visits`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/visits/patient/:patientId` | 🔒 Any | Patient's visit history |
| GET | `/visits/doctor/:doctorId` | 🔒 ADMIN, HOSPITAL_ADMIN, DOCTOR | Doctor's consultations |
| GET | `/visits/:id` | 🔒 Any | Visit details |
| POST | `/visits` | 🔒 ADMIN, DOCTOR | Record a visit/consultation |
| PUT | `/visits/:id` | 🔒 ADMIN, DOCTOR | Update visit notes |

### `POST /visits` Body
```json
{
  "patientId": "uuid",
  "doctorId": "uuid",
  "hospitalId": "uuid",
  "symptoms": ["Fever", "Cough"],
  "diagnosis": "Viral URTI",
  "prescriptions": ["Tab. Paracetamol 500mg x 3/day"],
  "medicalTestsOrdered": ["CBC"],
  "bloodPressureSystolic": 120,
  "bloodPressureDiastolic": 80,
  "bodyTemperature": 37.5,
  "heartRate": 80,
  "oxygenSaturation": 98.0,
  "notes": "Advised rest",
  "toBeAdmitted": false,
  "needsReferral": false,
  "needsFollowUp": true
}
```

---

## Admission Routes (`/api/admissions`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admissions/hospital/:hospitalId` | 🔒 ADMIN, HOSPITAL_ADMIN, DOCTOR | List admissions |
| GET | `/admissions/hospital/:hospitalId/active` | 🔒 Any | Active (current) admissions |
| GET | `/admissions/:id` | 🔒 Any | Admission details |
| POST | `/admissions` | 🔒 ADMIN, HOSPITAL_ADMIN, DOCTOR | Admit patient (atomically marks bed OCCUPIED) |
| PATCH | `/admissions/:id/discharge` | 🔒 ADMIN, HOSPITAL_ADMIN, DOCTOR | Discharge (frees bed atomically) |
| PATCH | `/admissions/:id/transfer` | 🔒 ADMIN, HOSPITAL_ADMIN, DOCTOR | Mark as transferred |

---

## Bed Routes (`/api/beds`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/beds/hospital/:hospitalId` | 🔒 Any | All beds (filterable by type, status, ward) |
| GET | `/beds/hospital/:hospitalId/summary` | 🔒 Any | Occupancy breakdown by bed type and status |
| GET | `/beds/:id` | 🔒 Any | Bed details with current occupant |
| POST | `/beds` | 🔒 ADMIN, HOSPITAL_ADMIN | Create a bed |
| PATCH | `/beds/:id/status` | 🔒 ADMIN, HOSPITAL_ADMIN, DOCTOR | Update bed status |
| PUT | `/beds/:id` | 🔒 ADMIN, HOSPITAL_ADMIN | Update bed metadata |
| DELETE | `/beds/:id` | 🔒 ADMIN, HOSPITAL_ADMIN | Delete bed |

### Bed Types
`NORMAL` · `ICU` · `EMERGENCY` · `MATERNITY` · `NICU` · `PAEDIATRIC` · `ISOLATION`

### Bed Statuses
`AVAILABLE` · `OCCUPIED` · `MAINTENANCE` · `RESERVED`

---

## Referral Routes (`/api/referrals`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/referrals/patient/:patientId` | 🔒 Any | Patient's referral history |
| GET | `/referrals/hospital/:hospitalId?type=from\|to` | 🔒 ADMIN, HOSPITAL_ADMIN, DOCTOR | Outgoing or incoming referrals |
| GET | `/referrals/stats/:hospitalId` | 🔒 ADMIN, HOSPITAL_ADMIN | Referral status counts |
| GET | `/referrals/:id` | 🔒 Any | Referral details |
| POST | `/referrals` | 🔒 ADMIN, DOCTOR | Create referral |
| PATCH | `/referrals/:id/status` | 🔒 ADMIN, HOSPITAL_ADMIN, DOCTOR | Advance referral state |

### Referral State Machine
```
PENDING → ACCEPTED → IN_TRANSIT → COMPLETED
        ↓           ↓            ↓
      CANCELLED   CANCELLED   (terminal)
```

---

## Follow-up Routes (`/api/followups`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/followups/patient/:patientId` | 🔒 Any | Patient's follow-ups |
| GET | `/followups/upcoming/hospital/:hospitalId` | 🔒 ADMIN, HOSPITAL_ADMIN, DOCTOR | Next 50 upcoming follow-ups |
| GET | `/followups/:id` | 🔒 Any | Follow-up detail |
| POST | `/followups` | 🔒 ADMIN, DOCTOR | Schedule follow-up |
| PATCH | `/followups/:id/complete` | 🔒 ADMIN, DOCTOR | Mark complete |

---

## Appointment Routes (`/api/appointments`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/appointments/patient/:patientId` | 🔒 Any | Patient's appointments |
| GET | `/appointments/doctor/:doctorId?date=YYYY-MM-DD` | 🔒 Any | Doctor's appointments by date |
| GET | `/appointments/doctor/:doctorId/queue` | 🔒 Any | Today's live queue (non-terminal) |
| GET | `/appointments/doctor/:doctorId/today` | 🔒 Any | Today's full schedule |
| GET | `/appointments/:id` | 🔒 Any | Appointment details |
| POST | `/appointments` | 🔒 Any | Book appointment (auto token number) |
| PATCH | `/appointments/:id/status` | 🔒 ADMIN, HOSPITAL_ADMIN, DOCTOR | Update status |
| PATCH | `/appointments/:id/cancel` | 🔒 Any | Cancel appointment |

### Appointment Statuses
`SCHEDULED` → `CHECKED_IN` → `IN_PROGRESS` → `COMPLETED` / `CANCELLED` / `NO_SHOW`

---

## Inventory Routes (`/api/inventory`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/inventory/medicines/hospital/:hospitalId` | 🔒 Any | All medicines |
| GET | `/inventory/medicines/hospital/:hospitalId/low-stock` | 🔒 Any | Medicines at or below reorder level |
| POST | `/inventory/medicines` | 🔒 ADMIN, HOSPITAL_ADMIN | Add medicine |
| PUT | `/inventory/medicines/:id` | 🔒 ADMIN, HOSPITAL_ADMIN | Update medicine |
| DELETE | `/inventory/medicines/:id` | 🔒 ADMIN, HOSPITAL_ADMIN | Remove medicine |
| GET | `/inventory/machines/hospital/:hospitalId` | 🔒 Any | Diagnostic machines |
| POST | `/inventory/machines` | 🔒 ADMIN, HOSPITAL_ADMIN | Add machine |
| PUT | `/inventory/machines/:id` | 🔒 ADMIN, HOSPITAL_ADMIN | Update machine |
| GET | `/inventory/pharmacy/hospital/:hospitalId` | 🔒 Any | Pharmacy info |
| PUT | `/inventory/pharmacy/hospital/:hospitalId` | 🔒 ADMIN, HOSPITAL_ADMIN | Update pharmacy info |

---

## Triage Routes (`/api/triage`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/triage` | 🔒 Any | Run triage assessment (proxies to Python FastAPI, falls back to local rules engine) |
| GET | `/triage/patient/:patientId` | 🔒 Any | Patient triage history (last 10) |

### `POST /triage` Body
```json
{
  "patientId": "uuid (optional — persists record if provided)",
  "age": 45,
  "sex": "male",
  "pregnancy_status": false,
  "existing_conditions": ["Diabetes", "Hypertension"],
  "symptoms": ["Chest Pain", "Difficulty Breathing"],
  "vitals": {
    "systolic": 185,
    "diastolic": 110,
    "temperature": 37.5,
    "heart_rate": 95,
    "oxygen_saturation": 91.0
  }
}
```

### Triage Response
```json
{
  "urgency": "EMERGENCY",
  "red_flags": ["Hypertensive crisis: BP 185/110 mmHg", "Low SpO2: 91%"],
  "suggested_facility": "DISTRICT_HOSPITAL",
  "recommended_specialist": "Cardiologist",
  "recommendations": ["Immediate attention required — go to Emergency now"],
  "confidence": 0.90,
  "source": "triage_engine_v1"
}
```

### Urgency Levels
| Level | Meaning |
|---|---|
| `EMERGENCY` | Immediate — life-threatening |
| `URGENT` | Within 1–2 hours |
| `STANDARD` | Within 24–48 hours |
| `NON_URGENT` | Home care / ASHA follow-up |

---

## ASHA Worker Routes (`/api/asha`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/asha/:id` | 🔒 Any | ASHA worker profile |
| GET | `/asha/:id/patients` | 🔒 Any | Patients visited by this worker |
| GET | `/asha/:id/visits` | 🔒 Any | Visit logs |
| POST | `/asha/register` | 🔒 ADMIN | Register ASHA worker |
| PUT | `/asha/:id` | 🔒 ADMIN, ASHA_WORKER | Update profile |
| POST | `/asha/visits` | 🔒 ASHA_WORKER, ADMIN | Log a visit |
| POST | `/asha/visits/sync` | 🔒 ASHA_WORKER, ADMIN | Bulk sync offline visits |

### Offline Sync (`POST /asha/visits/sync`)
```json
{
  "visits": [
    {
      "id": "offline_1726148....",
      "ashaWorkerId": "uuid",
      "visitType": "household_visit",
      "householdId": "HH-001",
      "notes": "Patient has fever",
      "visitDate": "2025-09-12T08:00:00Z",
      "isSynced": false
    }
  ]
}
```
Response:
```json
{ "synced": 3, "failed": 0, "total": 3 }
```

---

## Dashboard Routes (`/api/dashboard`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/dashboard/system` | 🔒 ADMIN | System-wide stats (hospitals, doctors, patients, visits, referrals) |
| GET | `/dashboard/hospital/:hospitalId` | 🔒 ADMIN, HOSPITAL_ADMIN, DOCTOR | Hospital-level dashboard KPIs |
| GET | `/dashboard/compare` | 🔒 ADMIN | Facility comparison table |

---

## Error Responses

All errors return:
```json
{ "error": "Descriptive error message" }
```

| Status | Meaning |
|---|---|
| `400` | Bad request / validation failure |
| `401` | Unauthenticated — missing/invalid token |
| `403` | Forbidden — insufficient role |
| `404` | Resource not found |
| `409` | Conflict (e.g., duplicate email) |
| `429` | Rate limit exceeded (100 req/15min) |
| `500` | Internal server error |

---

## Pagination

All list endpoints support:
| Param | Default | Description |
|---|---|---|
| `page` | `1` | Page number |
| `limit` | `20` | Items per page (max `100`) |

Response shape:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasPrev": false,
    "hasNext": true
  }
}
```

---

## Python Triage Engine (`triage-engine/`)

The triage microservice runs independently as a FastAPI app.

**Start:**
```bash
cd triage-engine
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Endpoints:**
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/triage` | Run triage (same schema as `/api/triage`) |

**Environment:** Set `TRIAGE_ENGINE_URL=http://localhost:8000` in `backend/.env`

---

## Setup & Running

### Backend
```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, etc.
npm install
npm run db:generate    # prisma generate
npm run db:push        # create tables
npm run db:seed        # seed demo data
npm run dev            # start dev server on :5000
```

### Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev            # start on :5173
```

### Triage Engine
```bash
cd triage-engine
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Demo Credentials (after seeding)
| Role | Email | Password |
|---|---|---|
| Admin | `admin@aspatal.in` | `admin123` |
| Hospital Admin | `admin@nagpur.dgh.in` | `hospital123` |
| Doctor | `dr.sharma@nagpur.dgh.in` | `doctor123` |
| ASHA Worker | `asha.kavita@nagpur.in` | `asha123` |

---

## Teleconsultation (Planned)

Slots are reserved in the server for future video consultation integration:
```js
// In backend/src/server.js (line 82):
// import teleconsultationRoutes from './routes/teleconsultation.routes.js';
// app.use('/api/teleconsultation', teleconsultationRoutes);
```

WebRTC / Daily.co / Agora integration can be mounted here without breaking existing routes.
