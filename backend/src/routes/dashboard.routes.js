import { Router } from 'express';
import {
  getHospitalDashboardStats, getSystemStats, getFacilityComparison,
} from '../controllers/dashboard.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Admin: system-wide stats
router.get('/system', authenticate, authorize('ADMIN'), getSystemStats);

// Hospital-level dashboard
router.get('/hospital/:hospitalId', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR'), getHospitalDashboardStats);

// Compare facilities (Admin only)
router.get('/compare', authenticate, authorize('ADMIN'), getFacilityComparison);

export default router;
