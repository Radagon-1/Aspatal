import { Router } from 'express';
import {
  createReferral, getReferral, getReferralsByPatient,
  getReferralsByHospital, updateReferralStatus, getReferralStats,
} from '../controllers/referral.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/patient/:patientId', authenticate, getReferralsByPatient);
router.get('/hospital/:hospitalId', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR'), getReferralsByHospital);
router.get('/stats/:hospitalId', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN'), getReferralStats);
router.get('/:id', authenticate, getReferral);

router.post('/', authenticate, authorize('ADMIN', 'DOCTOR'), createReferral);
router.patch('/:id/status', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR'), updateReferralStatus);

export default router;
