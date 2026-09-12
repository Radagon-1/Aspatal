# Aspatal — Rural Healthcare Access Platform

> **SIH 2025 · Problem Statement 26133**  
> Accessibility and quality of public healthcare services, particularly in rural and underserved areas

---

## Problem Statement

Rural and underserved communities face:
- Long travel distances to specialists
- Shortage of specialists and equipment
- Fragmented medical records across facilities
- Delayed referrals with no tracking
- No visibility into medicine or bed availability
- Limited awareness of available services

**Aspatal** bridges sub-centres, PHCs, rural hospitals, and district hospitals into a single digital platform.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), Vanilla CSS, Lucide Icons |
| Backend | Node.js, Express 5, Passport.js |
| Database | PostgreSQL via Prisma ORM |
| Triage Engine | Python FastAPI (rule-based clinical engine) |
| Auth | JWT (access + refresh), Google OAuth, Phone OTP |
| Deployment | Vercel (frontend) + Railway/Render (backend) |

---

## Features

| Feature | Status |
|---|---|
| JWT + Google OAuth + Phone OTP auth | ✅ Done |
| Role-based access (Admin, Hospital Admin, Doctor, ASHA, Patient) | ✅ Done |
| Patient registration with longitudinal records | ✅ Done |
| Doctor visit / consultation recording | ✅ Done |
| Bed management (ICU/Emergency/Normal/Maternity/NICU) | ✅ Done |
| Referral tracking with state machine (PENDING→COMPLETED) | ✅ Done |
| Appointment & queue management (token-based) | ✅ Done |
| AI-assisted triage (Python engine + local fallback) | ✅ Done |
| ASHA Worker portal with offline-first IndexedDB sync | ✅ Done |
| Medicine inventory + low-stock alerts | ✅ Done |
| Hospital & system dashboard analytics | ✅ Done |
| Admin panel (super admin) | ✅ Done |
| API documentation (`doc.md`) | ✅ Done |
| Teleconsultation (video calls) | 🔜 Scalability hooks in place |

---

## Project Structure

```
SIH/
├── backend/                  # Node.js / Express API
│   ├── prisma/
│   │   ├── schema.prisma     # Full DB schema
│   │   └── seed.js           # Demo data seeder
│   └── src/
│       ├── config/           # DB, env, auth strategy
│       ├── controllers/      # Business logic
│       ├── middleware/        # Auth, validation, error handling
│       ├── routes/           # All API route files
│       ├── utils/            # Token, OTP, pagination
│       └── validators/       # Zod schemas
├── frontend/                 # React + Vite app
│   └── src/
│       ├── context/          # Auth context
│       ├── lib/              # Axios API client (with auto-refresh)
│       ├── components/       # Layout, sidebar
│       └── pages/            # All app pages
├── triage-engine/            # Python FastAPI microservice
│   ├── main.py               # FastAPI app
│   ├── engine.py             # Clinical rules engine
│   └── requirements.txt
├── doc.md                    # Full API documentation
└── readme.md                 # This file
```

---

## Quick Start

### 1. Backend
```bash
cd backend
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET etc.
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev                 # → http://localhost:5000
```

### 2. Triage Engine
```bash
cd triage-engine
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev                 # → http://localhost:5173
```

---

## Demo Credentials (after seeding)

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@aspatal.in` | `admin123` |
| Hospital Admin | `admin@nagpur.dgh.in` | `hospital123` |
| Doctor | `dr.sharma@nagpur.dgh.in` | `doctor123` |
| ASHA Worker | `asha.kavita@nagpur.in` | `asha123` |

---

## API Docs

See [`doc.md`](./doc.md) for full route reference, request/response schemas, and setup instructions.
