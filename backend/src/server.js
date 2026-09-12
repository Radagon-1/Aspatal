import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import passport from 'passport';

import { env } from './config/env.js';
import { configurePassport } from './config/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import hospitalRoutes from './routes/hospital.routes.js';
import doctorRoutes from './routes/doctor.routes.js';
import patientRoutes from './routes/patient.routes.js';
import visitRoutes from './routes/visit.routes.js';
import admissionRoutes from './routes/admission.routes.js';
import bedRoutes from './routes/bed.routes.js';
import referralRoutes from './routes/referral.routes.js';
import followUpRoutes from './routes/followup.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import triageRoutes from './routes/triage.routes.js';
import ashaRoutes from './routes/asha.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';

const app = express();

// ─── Global Middleware ─────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Passport
configurePassport(passport);
app.use(passport.initialize());

// ─── Health Check ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'aspatal-backend',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// ─── API Routes ────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/admissions', admissionRoutes);
app.use('/api/beds', bedRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/followups', followUpRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/triage', triageRoutes);
app.use('/api/asha', ashaRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ─── Teleconsultation placeholder ──────────────────────────
// Scalable hook: When ready, mount teleconsultation routes here:
// import teleconsultationRoutes from './routes/teleconsultation.routes.js';
// app.use('/api/teleconsultation', teleconsultationRoutes);

// ─── Error Handling ────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start Server ──────────────────────────────────────────
const PORT = env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🏥 Aspatal backend running on port ${PORT} [${env.NODE_ENV}]`);
});

export default app;
