import { Router } from 'express';
import {
  admitPatient, dischargePatient, getAdmission, getAdmissionsByHospital,
  getActiveAdmissions, transferPatient,
} from '../controllers/admission.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/hospital/:hospitalId', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR'), getAdmissionsByHospital);
router.get('/hospital/:hospitalId/active', authenticate, getActiveAdmissions);
router.get('/:id', authenticate, getAdmission);

router.post('/', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR'), admitPatient);
router.patch('/:id/discharge', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR'), dischargePatient);
router.patch('/:id/transfer', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR'), transferPatient);

export default router;
