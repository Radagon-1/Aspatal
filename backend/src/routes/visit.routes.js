import { Router } from 'express';
import {
  createVisit, getVisit, getVisitsByPatient, getVisitsByDoctor, updateVisit,
} from '../controllers/visit.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/patient/:patientId', authenticate, getVisitsByPatient);
router.get('/doctor/:doctorId', authenticate, authorize('ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR'), getVisitsByDoctor);
router.get('/:id', authenticate, getVisit);

router.post('/', authenticate, authorize('ADMIN', 'DOCTOR'), createVisit);
router.put('/:id', authenticate, authorize('ADMIN', 'DOCTOR'), updateVisit);

export default router;
