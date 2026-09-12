import { Router } from 'express';
import {
  createPatient, getPatients, getPatient, updatePatient,
  getPatientHistory, searchPatients, getHighRiskPatients,
} from '../controllers/patient.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'ASHA_WORKER'), getPatients);
router.get('/high-risk', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR'), getHighRiskPatients);
router.get('/search', authenticate, searchPatients);
router.get('/:id', authenticate, getPatient);
router.get('/:id/history', authenticate, getPatientHistory);

router.post('/', authenticate, createPatient);
router.put('/:id', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'ASHA_WORKER'), updatePatient);

export default router;
